/**
 * Recognise an MLE / MLE-MBR treatment train drawn on the flowsheet canvas and,
 * when the topology matches, delegate sizing to the validated `designMleMbr`
 * generator (a deterministic Marais-Ekama / WRC TT-16/84 replication of
 * docs/WWTP Design.xlsm). The drawn blocks supply only the design basis
 * (influent flow + COD, anoxic-zone presence, MBR vs clarifier); every
 * engineering number returned is the EXACT spreadsheet value mapped back onto
 * the recognised nodes.
 *
 * Topology recognised (walking forward from the influent, ignoring recycle
 * back-edges):
 *
 *   influent -> (bioreactor_anoxic) -> bioreactor_aerobic -> (mbr | secondary_clarifier) -> effluent
 *
 * with an IMLR (a-recycle) edge carrying a recycleRatio from the aerobic node
 * back to the anoxic node when an anoxic zone is present. `config` is 'MLE_MBR'
 * when the separator is an mbr, otherwise 'MLE'. No clocks, no randomness:
 * same graph -> same recognition.
 */
import type { GraphNode, GraphEdge } from './topological-sort';
import { designMleMbr } from '../design/mle-mbr';
import type { MleMbrBasis, MleMbrDesign, MleMbrConstants, MembraneModel, LandUse, DischargeStandard } from '../design/mle-mbr';

// Canonical unit types this recogniser matches against. Held as a co-located
// const so the string literals are never re-typed inline in the matching logic.
const UNIT = {
  influent: 'influent',
  anaerobic: 'bioreactor_anaerobic',
  anoxic: 'bioreactor_anoxic',
  aerobic: 'bioreactor_aerobic',
  mbr: 'mbr',
  clarifier: 'secondary_clarifier',
  effluent: 'effluent',
} as const;

// Default basis values used when the drawn blocks do not carry them. These are
// the design-spec defaults (high-veld site) and are overridable per call.
const BASIS_DEFAULTS = {
  tminC: 15,
  tmaxC: 25,
  elevationM: 1700,
  membraneModel: 'megavision' as MembraneModel,
  landUse: 'residential' as LandUse,
} as const;

export interface RecognisedTrain {
  matched: boolean;
  config: 'MLE' | 'MLE_MBR' | 'UCT' | 'UCT_MBR' | null;
  influentNodeId?: string;
  anaerobicNodeId?: string;
  anoxicNodeId?: string;
  aerobicNodeId?: string;
  separatorNodeId?: string;
  effluentNodeId?: string;
  mbr: boolean;
  reason: string;
}

export interface TrainBasisOverrides {
  tminC?: number;
  tmaxC?: number;
  elevationM?: number;
  membraneModel?: 'megavision' | 'memstar';
  landUse?: string;
}

function unitTypeOf(node: GraphNode): string {
  return (node.data as { unitType?: unknown }).unitType as string;
}

function parametersOf(node: GraphNode): Record<string, number> {
  const params = (node.data as { parameters?: unknown }).parameters;
  return (params && typeof params === 'object' ? params : {}) as Record<string, number>;
}

/**
 * Recognise the MLE / MLE-MBR topology. Walks forward from the single influent
 * node following forward (non-recycle) edges and checks each hop is the expected
 * unit type. Recycle edges are those carrying a `recycleRatio` (the drawn IMLR
 * line) and are excluded from the forward walk.
 */
export function recogniseMleTrain(nodes: GraphNode[], edges: GraphEdge[]): RecognisedTrain {
  const noMatch = (reason: string): RecognisedTrain => ({ matched: false, config: null, mbr: false, reason });

  const nodeById = new Map<string, GraphNode>(nodes.map((n) => [n.id, n]));

  const influents = nodes.filter((n) => unitTypeOf(n) === UNIT.influent);
  if (influents.length !== 1) {
    return noMatch(`Expected exactly 1 influent node, found ${influents.length}.`);
  }
  const influent = influents[0];
  if (!influent) return noMatch('Influent node could not be resolved.');

  // Forward edges are every drawn edge WITHOUT a recycleRatio (the IMLR recycle
  // line carries the ratio and must not be followed as a forward hop).
  const forwardEdges = edges.filter((e) => e.recycleRatio === undefined);

  // The "product" outlet handles that carry the main treated stream forward. When a
  // unit also branches a sludge/reject line (clarifier underflow, MBR reject,
  // thickener/dewatering), the walk follows the product handle and ignores the
  // sludge branch — so a realistic plant with a sludge line is still a linear train.
  const PRODUCT_HANDLES = new Set(['out', 'permeate', 'overflow', 'main', 'effluent']);

  const forwardEdgesFrom = (nodeId: string): GraphEdge[] =>
    forwardEdges.filter((e) => e.source === nodeId && nodeById.has(e.target));

  const step = (fromId: string, label: string): { id: string; node: GraphNode } | { error: string } => {
    const outs = forwardEdgesFrom(fromId);
    if (outs.length === 0) return { error: `${label} has no forward successor.` };
    let chosen: GraphEdge | undefined;
    if (outs.length === 1) {
      chosen = outs[0];
    } else {
      // Fan-out: follow the single product-line edge, ignoring sludge/reject branches.
      const product = outs.filter((e) => PRODUCT_HANDLES.has(e.sourceHandle));
      if (product.length === 1) chosen = product[0];
      else return { error: `${label} fans out to ${outs.length} forward lines with no single product outlet; not a linear train.` };
    }
    const node = chosen ? nodeById.get(chosen.target) : undefined;
    if (!chosen || !node) return { error: `${label} points to a missing node.` };
    return { id: chosen.target, node };
  };

  // Single-output pre/post-treatment units that sit in line but are not part of the
  // biological core. The walk steps PAST them so a realistic train with headworks
  // (pumping, screening, grit, equalisation) or tertiary polishing (UV, dosing) is
  // still recognised and sized by the delegate. (Primary clarifiers branch a sludge
  // line, so they are not skippable here.)
  const PASSTHROUGH = new Set(['inlet_pumping', 'screen', 'grit_removal', 'equalisation_tank', 'uv_disinfection', 'chemical_dosing']);
  const stepCore = (fromId: string, label: string): { id: string; node: GraphNode } | { error: string } => {
    let cur = fromId;
    for (let guard = 0; guard < 24; guard++) {
      const s = step(cur, label);
      if ('error' in s) return s;
      if (PASSTHROUGH.has(unitTypeOf(s.node))) { cur = s.id; continue; }
      return s;
    }
    return { error: `${label}: too many in-line pre-treatment units.` };
  };

  // Walk the biological core forward (skipping headworks): the reactor sequence is
  //   [anaerobic (UCT/EBPR)] -> [anoxic (N removal)] -> aerobic -> separator.
  // Anaerobic and anoxic zones are each optional; the aerobic reactor is required.
  let anaerobicNodeId: string | undefined;
  let anoxicNodeId: string | undefined;
  let aerobicId: string | undefined;

  let cur = stepCore(influent.id, 'Influent');
  if ('error' in cur) return noMatch(cur.error);

  // Optional leading anaerobic (EBPR) zone — the UCT defining feature.
  if (unitTypeOf(cur.node) === UNIT.anaerobic) {
    anaerobicNodeId = cur.id;
    cur = stepCore(cur.id, 'Anaerobic reactor');
    if ('error' in cur) return noMatch(cur.error);
  }
  // Optional anoxic (denitrification) zone.
  if (unitTypeOf(cur.node) === UNIT.anoxic) {
    anoxicNodeId = cur.id;
    cur = stepCore(cur.id, 'Anoxic reactor');
    if ('error' in cur) return noMatch(cur.error);
  }
  // Aerobic reactor — required.
  if (unitTypeOf(cur.node) === UNIT.aerobic) {
    aerobicId = cur.id;
  } else {
    const after = anaerobicNodeId || anoxicNodeId ? '' : ' after influent';
    return noMatch(`Expected an aerobic reactor in the train, found '${unitTypeOf(cur.node)}'${after}.`);
  }

  // Hop: aerobic -> separator (mbr or secondary_clarifier).
  const sep = stepCore(aerobicId, 'Aerobic reactor');
  if ('error' in sep) return noMatch(sep.error);
  const sepType = unitTypeOf(sep.node);
  const isMbr = sepType === UNIT.mbr;
  if (!isMbr && sepType !== UNIT.clarifier) {
    return noMatch(`Expected an mbr or secondary_clarifier after the aerobic reactor, found '${sepType}'.`);
  }

  // Hop: separator -> effluent (skipping any tertiary polishing).
  const eff = stepCore(sep.id, 'Separator');
  if ('error' in eff) return noMatch(eff.error);
  if (unitTypeOf(eff.node) !== UNIT.effluent) {
    return noMatch(`Expected effluent after the separator, found '${unitTypeOf(eff.node)}'.`);
  }

  // An MLE train normally carries an IMLR (a-recycle) line from the aerobic back to
  // the anoxic. We recognise the train for SIZING even when it has not been drawn yet
  // (the design models the a-recycle internally); the reason flags it so the UI can
  // nudge the user to draw the recycle line for accurate denitrification in the stream
  // sim. The drag-and-link train sizes itself either way.
  const hasImlr = anoxicNodeId !== undefined
    && edges.some((e) => e.recycleRatio !== undefined && e.source === aerobicId && e.target === anoxicNodeId);
  const imlrNote = anoxicNodeId && !hasImlr ? ' (draw an IMLR a-recycle aerobic -> anoxic for full nitrate return)' : '';
  // UCT r-recycle: mixed liquor from the anoxic zone back to the anaerobic zone
  // (nitrate-free, to protect P-release). Recognise the train either way; nudge if absent.
  const hasRRecycle = anaerobicNodeId !== undefined && anoxicNodeId !== undefined
    && edges.some((e) => e.recycleRatio !== undefined && e.source === anoxicNodeId && e.target === anaerobicNodeId);
  const rNote = anaerobicNodeId && anoxicNodeId && !hasRRecycle ? ' (draw a UCT r-recycle anoxic -> anaerobic to keep the anaerobic zone nitrate-free)' : '';

  const isUct = anaerobicNodeId !== undefined;
  const config = isUct ? (isMbr ? 'UCT_MBR' : 'UCT') : (isMbr ? 'MLE_MBR' : 'MLE');
  const label = isUct ? (isMbr ? 'UCT-MBR' : 'UCT') : (isMbr ? 'MLE-MBR' : 'MLE');
  const sequence = `influent -> ${anaerobicNodeId ? 'anaerobic -> ' : ''}${anoxicNodeId ? 'anoxic -> ' : ''}aerobic -> ${isMbr ? 'mbr' : 'secondary_clarifier'} -> effluent`;

  return {
    matched: true,
    config,
    influentNodeId: influent.id,
    anaerobicNodeId,
    anoxicNodeId,
    aerobicNodeId: aerobicId,
    separatorNodeId: sep.id,
    effluentNodeId: eff.id,
    mbr: isMbr,
    reason: `Matched ${label} train: ${sequence}.${imlrNote}${rNote}`,
  };
}

/**
 * Build the `MleMbrBasis` for a recognised train from the drawn blocks. Flow and
 * COD come from the influent node's parameters; nitrogen removal is implied by
 * the anoxic zone; MBR follows the recognised separator. The remaining basis
 * fields fall back to design-spec defaults (overridable). Returns null when the
 * train did not match.
 */
export function basisFromTrain(
  nodes: GraphNode[],
  edges: GraphEdge[],
  train: RecognisedTrain,
  overrides?: TrainBasisOverrides,
): MleMbrBasis | null {
  if (!train.matched || !train.influentNodeId) return null;

  const nodeById = new Map<string, GraphNode>(nodes.map((n) => [n.id, n]));
  const influent = nodeById.get(train.influentNodeId);
  if (!influent) return null;

  const params = parametersOf(influent);
  const adwfM3d = Number(params.flow ?? 0);
  const codMgL = Number(params.COD ?? 0);
  const nitrogenRemoval = train.anoxicNodeId !== undefined;
  const phosphorusRemoval = train.anaerobicNodeId !== undefined;
  const mbrRequired = train.mbr;
  const dischargeStandard: DischargeStandard = mbrRequired ? 'Special' : 'General';

  // Carry the DRAWN sizing through to the design as constant overrides, so the
  // delegated design reflects what the engineer set on the blocks (SRT/MLSS on the
  // aerobic, anoxic mass fraction on the anoxic, a-recycle on the IMLR line). When
  // a block omits a value the design-spec default applies.
  const aerParams = train.aerobicNodeId ? parametersOf(nodeById.get(train.aerobicNodeId)!) : {};
  const anxParams = train.anoxicNodeId ? parametersOf(nodeById.get(train.anoxicNodeId)!) : {};
  const anaParams = train.anaerobicNodeId ? parametersOf(nodeById.get(train.anaerobicNodeId)!) : {};
  const imlrEdge = train.anoxicNodeId
    ? edges.find((e) => e.recycleRatio !== undefined && e.source === train.aerobicNodeId && e.target === train.anoxicNodeId)
    : undefined;

  const sizingOverrides: Partial<MleMbrConstants> = {};
  if (aerParams.srt) sizingOverrides.sludgeAgeDays = Number(aerParams.srt);
  if (aerParams.mlss) sizingOverrides.mlssMgL = Number(aerParams.mlss);
  if (anxParams.anoxic_fraction) sizingOverrides.anoxicMassFraction = Number(anxParams.anoxic_fraction);
  if (anaParams.anaerobic_fraction) sizingOverrides.anaerobicMassFraction = Number(anaParams.anaerobic_fraction);
  if (imlrEdge?.recycleRatio) sizingOverrides.aRecycle = Number(imlrEdge.recycleRatio);

  return {
    adwfM3d,
    codMgL,
    tminC: overrides?.tminC ?? BASIS_DEFAULTS.tminC,
    tmaxC: overrides?.tmaxC ?? BASIS_DEFAULTS.tmaxC,
    elevationM: overrides?.elevationM ?? BASIS_DEFAULTS.elevationM,
    nitrogenRemoval,
    phosphorusRemoval,
    dischargeStandard,
    mbrRequired,
    membraneModel: overrides?.membraneModel ?? BASIS_DEFAULTS.membraneModel,
    landUse: (overrides?.landUse ?? BASIS_DEFAULTS.landUse) as LandUse,
    overrides: Object.keys(sizingOverrides).length > 0 ? sizingOverrides : undefined,
  };
}

/**
 * Recognise the drawn train and, when matched, delegate its sizing to
 * `designMleMbr`. Returns the recognition result plus the full design (or null
 * when the topology did not match or the influent carries no usable basis).
 */
export function delegateMleDesign(
  nodes: GraphNode[],
  edges: GraphEdge[],
  overrides?: TrainBasisOverrides,
): { train: RecognisedTrain; design: MleMbrDesign | null } {
  const train = recogniseMleTrain(nodes, edges);
  if (!train.matched) return { train, design: null };

  const basis = basisFromTrain(nodes, edges, train, overrides);
  if (!basis) return { train, design: null };

  return { train, design: designMleMbr(basis) };
}
