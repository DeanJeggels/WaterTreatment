/**
 * buildGraph — turn a ProcessTopology into the SAME {nodes,edges} shape the
 * flowsheet-store addNode builds, so it inherits the entire tested sim -> BoQ ->
 * compliance chain. Pure config + parameter seeding; no engineering math (the
 * units compute their own sizing from the propagated flow).
 *
 * The MVP graph is a DAG (main water line + a sludge branch off the
 * clarifier/MBR). Recycle lines (RAS / internal MLR) are a Phase 2 refinement.
 */
import { unitDefinitions, type UnitType } from '@repo/sim-engine';
import type { FlowsheetNodeLite } from '@repo/sim-engine';
import type { DesignInputs } from './inputs';
import type { ProcessTopology } from './select-train';

export interface AutoDesignNodeData {
  unitType: UnitType;
  label: string;
  parameters: Record<string, number>;
  position: { x: number; y: number };
}

export interface AutoDesignNode {
  id: string;
  type: UnitType;
  data: AutoDesignNodeData;
}

export interface AutoDesignEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
}

export interface FlowsheetGraph {
  nodes: AutoDesignNode[];
  edges: AutoDesignEdge[];
}

const nodeId = (unitType: UnitType): string => `node-${unitType}`;

/** Clean-water (main-line) output handle for a unit. */
function mainOutputHandle(unitType: UnitType): string {
  if (unitType === 'secondary_clarifier') return 'overflow';
  if (unitType === 'mbr') return 'permeate';
  return 'out';
}

/** Sludge/solids output handle for a unit. */
function sludgeOutputHandle(unitType: UnitType): string {
  if (unitType === 'secondary_clarifier') return 'underflow';
  if (unitType === 'mbr') return 'reject';
  if (unitType === 'thickener') return 'thickened';
  return 'out';
}

/** Seed the influent node parameters from the form (units reconciled to sim-engine). */
function influentParameters(input: DesignInputs): Record<string, number> {
  const inf = input.influent;
  const defaults = { ...unitDefinitions.influent.defaultParameters };
  return {
    ...defaults,
    flow: input.designFlowM3d,
    COD: inf.COD,
    sCOD: inf.sCOD,
    // BOD5 estimated from COD when not supplied (typical municipal ratio ~0.45).
    BOD5: inf.BOD5 ?? Math.round(inf.COD * 0.45),
    TKN: inf.TKN,
    NH3N: inf.NH3N,
    NO3N: 0,
    TP: inf.TP,
    TSS: inf.TSS,
    VSS: inf.VSS ?? Math.round(inf.TSS * 0.8),
    pH: inf.pH ?? defaults.pH ?? 7.2,
    // Form alkalinity is mg/L CaCO3; sim-engine influent expects mmol/L (÷50).
    alkalinity: inf.alkalinity !== undefined ? inf.alkalinity / 50 : (defaults.alkalinity ?? 5),
    DO: 0,
    temperature: inf.temperature ?? defaults.temperature ?? 20,
  };
}

export function buildGraph(topology: ProcessTopology, input: DesignInputs): FlowsheetGraph {
  const nodes: AutoDesignNode[] = [];
  const edges: AutoDesignEdge[] = [];

  // ---- nodes ----
  topology.mainLine.forEach((unitType, i) => {
    nodes.push({
      id: nodeId(unitType),
      type: unitType,
      data: {
        unitType,
        label: unitDefinitions[unitType].label,
        parameters:
          unitType === 'influent'
            ? influentParameters(input)
            : { ...unitDefinitions[unitType].defaultParameters },
        position: { x: i * 200, y: 0 },
      },
    });
  });
  topology.sludgeLine.forEach((unitType, i) => {
    nodes.push({
      id: nodeId(unitType),
      type: unitType,
      data: {
        unitType,
        label: unitDefinitions[unitType].label,
        parameters: { ...unitDefinitions[unitType].defaultParameters },
        position: { x: (topology.mainLine.length - 2 + i) * 200, y: 180 },
      },
    });
  });

  const edge = (source: UnitType, sourceHandle: string, target: UnitType): AutoDesignEdge => ({
    id: `e-${source}-${sourceHandle}-${target}`,
    source: nodeId(source),
    target: nodeId(target),
    sourceHandle,
    targetHandle: 'in',
  });

  // ---- main-line edges ----
  for (let i = 0; i < topology.mainLine.length - 1; i++) {
    const source = topology.mainLine[i]!;
    const target = topology.mainLine[i + 1]!;
    edges.push(edge(source, mainOutputHandle(source), target));
  }

  // ---- sludge-line edges (off the clarifier / MBR sludge handle) ----
  if (topology.sludgeLine.length > 0) {
    const separation = topology.mainLine.find((u) => u === 'secondary_clarifier' || u === 'mbr');
    let upstream: UnitType | undefined = separation;
    for (const sludgeUnit of topology.sludgeLine) {
      if (upstream) edges.push(edge(upstream, sludgeOutputHandle(upstream), sludgeUnit));
      upstream = sludgeUnit;
    }
  }

  return { nodes, edges };
}

/** Adapt the graph nodes to the BoQ aggregator's lite shape. */
export function toFlowsheetNodeLites(graph: FlowsheetGraph): FlowsheetNodeLite[] {
  return graph.nodes.map((n) => ({ id: n.id, type: n.data.unitType, parameters: n.data.parameters }));
}
