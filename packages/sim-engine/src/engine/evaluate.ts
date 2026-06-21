/**
 * Headless plant-evaluation engine (Phase 3 boundary).
 *
 * evaluatePlant(graphDefinition) -> { sizedPlant, effluentStream, CAPEX, OPEX,
 * footprint, ... }. Pure and deterministic (no clocks, no randomness, no UI,
 * no Supabase/LLM), callable repeatedly. This is the single seam the optimizer
 * (Phase 4) plugs into: it composes the connected stream solver, the BoQ engine,
 * the energy/OPEX roll-up, the footprint estimate, the mass-balance ledger,
 * effluent compliance, and the MLE/MBR design delegate into one result.
 */
import type { GraphNode, GraphEdge } from '../graph/topological-sort';
import type { WaterQuality, DischargeStandards, UnitType, Dimension } from '../types';
import { mixStreams } from '../types';
import { simulate } from '../graph/simulator';
import { aggregateBoQ } from '../boq/aggregator';
import type { FlowsheetNodeLite } from '../boq/aggregator';
import { computeMassBalanceLedger } from '../graph/mass-balance';
import type { MassBalanceLedger } from '../graph/mass-balance';
import { checkCompliance } from '../units/effluent';
import { delegateMleDesign } from '../graph/recognise-mle-train';
import type { RecognisedTrain, TrainBasisOverrides } from '../graph/recognise-mle-train';
import type { MleMbrDesign } from '../design/mle-mbr';

export interface GraphDefinition {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Optional target discharge standards to score the effluent against. */
  standards?: DischargeStandards;
}

export interface EvaluateOptions {
  /** Electricity tariff for OPEX, ZAR/kWh. */
  energyTariffZarPerKwh?: number;
  /** Operating days per year for OPEX annualisation. */
  operatingDaysPerYear?: number;
  /** Tank depth (m) used to convert a tank volume to plan area when no surface area is reported. */
  defaultTankDepthM?: number;
  /** Gross-site / net-equipment plan-area multiplier (aisles, bunds, access). */
  footprintSpacingFactor?: number;
  /** Overrides passed to the MLE/MBR design delegate when a train is recognised. */
  delegateOverrides?: TrainBasisOverrides;
}

const DEFAULTS: Required<Omit<EvaluateOptions, 'delegateOverrides'>> = {
  energyTariffZarPerKwh: 2.2,
  operatingDaysPerYear: 365,
  defaultTankDepthM: 4.5,
  footprintSpacingFactor: 2.5,
};

export interface PlantEvaluation {
  converged: boolean;
  iterations: number;
  /** Plant-wide COD closure indicator from the solver. */
  massBalanceErrorCod: number;
  /** Combined plant effluent (flow-weighted mix of all effluent-node inflows), or null. */
  effluentStream: WaterQuality | null;
  compliance: Record<string, { value: number; limit: number; pass: boolean }> | null;
  compliancePass: boolean | null;
  /** Total capital cost, ZAR. */
  capexZar: number;
  capexByCategory: Record<string, number>;
  /** Installed/utilised electrical energy, kWh/day. */
  energyKwhPerDay: number;
  /** Annual operating cost (energy), ZAR/year. */
  opexZarPerYear: number;
  /** Estimated gross site footprint, m². */
  footprintM2: number;
  /** Sized geometry of every block that reports it. */
  sizedPlant: Record<string, Record<string, Dimension>>;
  ledger: MassBalanceLedger;
  /** MLE/MBR topology recognition for the delegate path. */
  recognisedTrain: RecognisedTrain;
  /** Exact whole-reactor design when the train is recognised (else null). */
  delegatedDesign: MleMbrDesign | null;
  warnings: string[];
}

const unitTypeOf = (n: GraphNode): UnitType => (n.data as { unitType: UnitType }).unitType;
const paramsOf = (n: GraphNode): Record<string, number> =>
  (n.data as { parameters?: Record<string, number> }).parameters ?? {};

/** Plan area (m²) a sized block occupies on site. */
function planAreaFromSizing(sizing: Record<string, Dimension>, defaultDepthM: number): number {
  if (sizing.surfaceArea) return sizing.surfaceArea.value;
  const depth = sizing.depth?.value ?? defaultDepthM;
  if (sizing.volume && depth > 0) return sizing.volume.value / depth;
  return 0;
}

/**
 * Evaluate a complete plant from its graph definition. Deterministic and UI-free.
 */
export function evaluatePlant(graph: GraphDefinition, options: EvaluateOptions = {}): PlantEvaluation {
  const o = { ...DEFAULTS, ...options };
  const { nodes, edges } = graph;

  const results = simulate(nodes, edges);

  // Combined effluent stream: flow-weighted mix of everything entering effluent nodes.
  const effluentNodeIds = new Set(nodes.filter(n => unitTypeOf(n) === 'effluent').map(n => n.id));
  const effStreams = edges
    .filter(e => effluentNodeIds.has(e.target))
    .map(e => results.edgeResults[e.id])
    .filter((s): s is WaterQuality => !!s && s.flow > 0);
  const effluentStream = effStreams.length > 0 ? mixStreams(effStreams) : null;

  // Compliance against target standards.
  let compliance: PlantEvaluation['compliance'] = null;
  let compliancePass: boolean | null = null;
  if (graph.standards && effluentStream) {
    compliance = checkCompliance(effluentStream, graph.standards);
    compliancePass = Object.values(compliance).every(c => c.pass);
  }

  // CAPEX via the BoQ engine.
  const liteNodes: FlowsheetNodeLite[] = nodes.map(n => ({ id: n.id, type: unitTypeOf(n), parameters: paramsOf(n) }));
  const boq = aggregateBoQ(liteNodes, results.nodeResults);

  // OPEX from electrical energy + total energy/day.
  let energyKwhPerDay = 0;
  for (const r of Object.values(results.nodeResults)) {
    if (r.energy?.dailyKWh) energyKwhPerDay += r.energy.dailyKWh;
  }
  const opexZarPerYear = energyKwhPerDay * o.operatingDaysPerYear * o.energyTariffZarPerKwh;

  // Footprint: sum each sized block's plan area, then a gross-site spacing factor.
  let netFootprint = 0;
  const sizedPlant: Record<string, Record<string, Dimension>> = {};
  for (const [id, r] of Object.entries(results.nodeResults)) {
    if (r.sizing) {
      sizedPlant[id] = r.sizing;
      netFootprint += planAreaFromSizing(r.sizing, o.defaultTankDepthM);
    }
  }
  const footprintM2 = netFootprint * o.footprintSpacingFactor;

  const ledger = computeMassBalanceLedger(nodes, edges, results);
  const { train, design } = delegateMleDesign(nodes, edges, options.delegateOverrides);

  const warnings: string[] = [...(results.warnings ?? [])];
  for (const r of Object.values(results.nodeResults)) {
    if (r.warnings) warnings.push(...r.warnings);
  }

  return {
    converged: results.converged,
    iterations: results.iterations,
    massBalanceErrorCod: results.massBalanceError,
    effluentStream,
    compliance,
    compliancePass,
    capexZar: boq.grandTotal,
    capexByCategory: boq.subtotalsByCategory,
    energyKwhPerDay,
    opexZarPerYear,
    footprintM2,
    sizedPlant,
    ledger,
    recognisedTrain: train,
    delegatedDesign: design,
    warnings,
  };
}
