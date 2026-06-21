import { describe, it, expect } from 'vitest';
import {
  recogniseMleTrain,
  basisFromTrain,
  delegateMleDesign,
} from '../src/graph/recognise-mle-train';
import type { GraphNode, GraphEdge } from '../src/graph/topological-sort';

// Helper: build a graph node with the { unitType, parameters } data shape the
// simulator expects.
function node(id: string, unitType: string, parameters: Record<string, number> = {}): GraphNode {
  return { id, type: 'unit', data: { unitType, parameters } };
}

function edge(
  id: string,
  source: string,
  target: string,
  recycleRatio?: number,
): GraphEdge {
  const e: GraphEdge = { id, source, target, sourceHandle: 'out', targetHandle: 'in' };
  if (recycleRatio !== undefined) e.recycleRatio = recycleRatio;
  return e;
}

describe('recogniseMleTrain — MLE-MBR train', () => {
  // influent -> anoxic -> aerobic -> mbr -> effluent, plus IMLR recycle
  // aerobic -> anoxic with recycleRatio 4.
  const nodes: GraphNode[] = [
    node('inf', 'influent', { flow: 70, COD: 900 }),
    node('anox', 'bioreactor_anoxic'),
    node('aer', 'bioreactor_aerobic'),
    node('mbr', 'mbr'),
    node('eff', 'effluent'),
  ];
  const edges: GraphEdge[] = [
    edge('e1', 'inf', 'anox'),
    edge('e2', 'anox', 'aer'),
    edge('e3', 'aer', 'mbr'),
    edge('e4', 'mbr', 'eff'),
    edge('imlr', 'aer', 'anox', 4),
  ];

  const train = recogniseMleTrain(nodes, edges);

  it('matches with config MLE_MBR and mbr true', () => {
    expect(train.matched).toBe(true);
    expect(train.config).toBe('MLE_MBR');
    expect(train.mbr).toBe(true);
  });

  it('identifies the correct node ids', () => {
    expect(train.influentNodeId).toBe('inf');
    expect(train.anoxicNodeId).toBe('anox');
    expect(train.aerobicNodeId).toBe('aer');
    expect(train.separatorNodeId).toBe('mbr');
    expect(train.effluentNodeId).toBe('eff');
  });

  it('builds a basis from the drawn influent block', () => {
    const basis = basisFromTrain(nodes, edges, train);
    expect(basis).not.toBeNull();
    expect(basis!.adwfM3d).toBe(70);
    expect(basis!.codMgL).toBe(900);
    expect(basis!.nitrogenRemoval).toBe(true);
    expect(basis!.mbrRequired).toBe(true);
    expect(basis!.dischargeStandard).toBe('Special');
    expect(basis!.phosphorusRemoval).toBe(false);
  });

  it('delegates to designMleMbr and returns the spreadsheet design', () => {
    const { train: t, design } = delegateMleDesign(nodes, edges);
    expect(t.matched).toBe(true);
    expect(t.config).toBe('MLE_MBR');
    expect(design).not.toBeNull();
    expect(design!.reactor.aerobicVolumeM3).toBeGreaterThan(0);
    expect(design!.effluent.ammoniaMgL).toBeGreaterThanOrEqual(0);
    // MBR config -> the design includes the membrane.
    expect(design!.mbr.included).toBe(true);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(recogniseMleTrain(nodes, edges))).toBe(
      JSON.stringify(recogniseMleTrain(nodes, edges)),
    );
  });
});

describe('recogniseMleTrain — MLE (secondary clarifier, no MBR)', () => {
  const nodes: GraphNode[] = [
    node('inf', 'influent', { flow: 120, COD: 750 }),
    node('anox', 'bioreactor_anoxic'),
    node('aer', 'bioreactor_aerobic'),
    node('clar', 'secondary_clarifier'),
    node('eff', 'effluent'),
  ];
  const edges: GraphEdge[] = [
    edge('e1', 'inf', 'anox'),
    edge('e2', 'anox', 'aer'),
    edge('e3', 'aer', 'clar'),
    edge('e4', 'clar', 'eff'),
    edge('imlr', 'aer', 'anox', 4),
  ];

  it('matches with config MLE and mbr false', () => {
    const train = recogniseMleTrain(nodes, edges);
    expect(train.matched).toBe(true);
    expect(train.config).toBe('MLE');
    expect(train.mbr).toBe(false);
    expect(train.separatorNodeId).toBe('clar');
  });

  it('basis uses General discharge standard and mbrRequired false', () => {
    const train = recogniseMleTrain(nodes, edges);
    const basis = basisFromTrain(nodes, edges, train);
    expect(basis!.mbrRequired).toBe(false);
    expect(basis!.dischargeStandard).toBe('General');
  });
});

describe('recogniseMleTrain — non-matching graphs', () => {
  it('influent -> effluent does not match', () => {
    const nodes: GraphNode[] = [
      node('inf', 'influent', { flow: 70, COD: 900 }),
      node('eff', 'effluent'),
    ];
    const edges: GraphEdge[] = [edge('e1', 'inf', 'eff')];
    const train = recogniseMleTrain(nodes, edges);
    expect(train.matched).toBe(false);
    expect(train.config).toBeNull();
    expect(train.reason.length).toBeGreaterThan(0);

    const { design } = delegateMleDesign(nodes, edges);
    expect(design).toBeNull();
  });

  it('anoxic present but missing the IMLR recycle still matches (sizes itself) and nudges to draw it', () => {
    const nodes: GraphNode[] = [
      node('inf', 'influent', { flow: 70, COD: 900 }),
      node('anox', 'bioreactor_anoxic'),
      node('aer', 'bioreactor_aerobic'),
      node('mbr', 'mbr'),
      node('eff', 'effluent'),
    ];
    const edges: GraphEdge[] = [
      edge('e1', 'inf', 'anox'),
      edge('e2', 'anox', 'aer'),
      edge('e3', 'aer', 'mbr'),
      edge('e4', 'mbr', 'eff'),
      // no IMLR recycle edge — still recognised for sizing
    ];
    const train = recogniseMleTrain(nodes, edges);
    expect(train.matched).toBe(true);
    expect(train.config).toBe('MLE_MBR');
    expect(train.reason).toContain('IMLR'); // nudge to draw the recycle line
  });

  it('recognises a realistic train with in-line headworks + tertiary (skips them)', () => {
    // influent -> pumping -> screen -> grit -> EQ -> anoxic -> aerobic -> mbr -> UV -> effluent, + IMLR
    const nodes: GraphNode[] = [
      node('inf', 'influent', { flow: 5000, COD: 700 }),
      node('pump', 'inlet_pumping'),
      node('scr', 'screen'),
      node('grit', 'grit_removal'),
      node('eq', 'equalisation_tank'),
      node('anox', 'bioreactor_anoxic'),
      node('aer', 'bioreactor_aerobic'),
      node('mbr', 'mbr'),
      node('uv', 'uv_disinfection'),
      node('eff', 'effluent'),
    ];
    const edges: GraphEdge[] = [
      edge('e1', 'inf', 'pump'), edge('e2', 'pump', 'scr'), edge('e3', 'scr', 'grit'),
      edge('e4', 'grit', 'eq'), edge('e5', 'eq', 'anox'), edge('e6', 'anox', 'aer'),
      edge('e7', 'aer', 'mbr'), edge('e8', 'mbr', 'uv'), edge('e9', 'uv', 'eff'),
      edge('imlr', 'aer', 'anox', 4),
    ];
    const train = recogniseMleTrain(nodes, edges);
    expect(train.matched).toBe(true);
    expect(train.config).toBe('MLE_MBR');
    expect(train.anoxicNodeId).toBe('anox');
    expect(train.aerobicNodeId).toBe('aer');
    expect(train.separatorNodeId).toBe('mbr');
    const { design } = delegateMleDesign(nodes, edges);
    expect(design?.reactor.anoxicVolumeM3).toBeGreaterThan(0);
  });

  it('basisFromTrain returns null for an unmatched train', () => {
    const train = recogniseMleTrain(
      [node('inf', 'influent', { flow: 70, COD: 900 }), node('eff', 'effluent')],
      [edge('e1', 'inf', 'eff')],
    );
    expect(basisFromTrain([], [], train)).toBeNull();
  });
});
