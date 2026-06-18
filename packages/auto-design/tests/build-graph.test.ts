import { describe, it, expect } from 'vitest';
import { defaultInputs } from '../src/inputs';
import { selectTrain } from '../src/select-train';
import { buildGraph } from '../src/build-graph';

function mleGraph() {
  const inp = defaultInputs('General');
  inp.meta.projectName = 'Test';
  inp.designFlowM3d = 12000;
  const topology = selectTrain({ plantType: 'MLE', pRemoval: true });
  return { graph: buildGraph(topology, inp), topology, inp };
}

describe('buildGraph (T2.2)', () => {
  it('emits one node per train unit', () => {
    const { graph, topology } = mleGraph();
    expect(graph.nodes).toHaveLength(topology.units.length);
    expect(graph.nodes.map((n) => n.data.unitType)).toEqual(topology.units);
  });

  it('seeds the influent node with the design flow + influent quality', () => {
    const { graph, inp } = mleGraph();
    const influent = graph.nodes.find((n) => n.data.unitType === 'influent')!;
    expect(influent.data.parameters.flow).toBe(12000);
    expect(influent.data.parameters.COD).toBe(inp.influent.COD);
    expect(influent.data.parameters.NH3N).toBe(inp.influent.NH3N);
  });

  it('is a valid DAG: every non-influent node has an inbound edge', () => {
    const { graph } = mleGraph();
    const targets = new Set(graph.edges.map((e) => e.target));
    for (const n of graph.nodes) {
      if (n.data.unitType === 'influent') continue;
      expect(targets.has(n.id)).toBe(true);
    }
  });

  it('routes clean water off the clarifier overflow and sludge off the underflow', () => {
    const { graph } = mleGraph();
    const clarifierOut = graph.edges.filter((e) => e.source === 'node-secondary_clarifier');
    const handles = clarifierOut.map((e) => e.sourceHandle).sort();
    expect(handles).toContain('overflow'); // main line continues
    expect(handles).toContain('underflow'); // sludge line
  });

  it('connects the sludge line clarifier -> thickener -> dewatering', () => {
    const { graph } = mleGraph();
    expect(graph.edges).toContainEqual(
      expect.objectContaining({ source: 'node-secondary_clarifier', target: 'node-thickener', sourceHandle: 'underflow' }),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({ source: 'node-thickener', target: 'node-dewatering', sourceHandle: 'thickened' }),
    );
  });

  it('MBR train wires the permeate to the main line and reject to sludge', () => {
    const inp = defaultInputs('General');
    const graph = buildGraph(selectTrain({ plantType: 'MBR', pRemoval: false }), inp);
    expect(graph.edges).toContainEqual(
      expect.objectContaining({ source: 'node-mbr', sourceHandle: 'permeate' }),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({ source: 'node-mbr', target: 'node-thickener', sourceHandle: 'reject' }),
    );
  });

  it('is deterministic', () => {
    expect(mleGraph().graph).toEqual(mleGraph().graph);
  });
});
