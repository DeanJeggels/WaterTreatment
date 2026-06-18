import { describe, it, expect } from 'vitest';
import { defaultInputs } from '../src/inputs';
import { runAutoDesign, AutoDesignValidationError } from '../src/run';
import type { DesignInputs } from '../src/inputs';

function validInputs(): DesignInputs {
  const inp = defaultInputs('General');
  inp.meta.projectName = 'Komani WWTP';
  inp.designFlowM3d = 10000;
  inp.siteAreaM2 = 20000;
  return inp;
}

describe('runAutoDesign stages 1-5 (T2.3)', () => {
  it('produces graph, results, boq and a compliance verdict', () => {
    const r = runAutoDesign(validInputs());
    expect(r.graph.nodes.length).toBeGreaterThan(0);
    expect(r.results.nodeResults['node-influent']).toBeDefined();
    expect(r.boq.grandTotal).toBeGreaterThan(0);
    expect(typeof r.compliance.pass).toBe('boolean');
    expect(Object.keys(r.compliance.perParameter).length).toBeGreaterThan(0);
  });

  it('throws AutoDesignValidationError on invalid inputs', () => {
    const inp = validInputs();
    inp.peakFactor = 0.5;
    expect(() => runAutoDesign(inp)).toThrow(AutoDesignValidationError);
  });

  it('is deterministic: same inputs -> byte-identical results JSON', () => {
    const a = runAutoDesign(validInputs());
    const b = runAutoDesign(validInputs());
    expect(JSON.stringify(a.results)).toBe(JSON.stringify(b.results));
    expect(JSON.stringify(a.boq)).toBe(JSON.stringify(b.boq));
    expect(JSON.stringify(a.compliance)).toBe(JSON.stringify(b.compliance));
  });

  it('every sized unit traces back to a node in the graph', () => {
    const r = runAutoDesign(validInputs());
    for (const node of r.graph.nodes) {
      expect(r.results.nodeResults[node.id]).toBeDefined();
    }
  });

  it('the influent node carries the design flow into the simulation', () => {
    const inp = validInputs();
    inp.designFlowM3d = 15000;
    const r = runAutoDesign(inp);
    expect(r.graph.nodes.find((n) => n.data.unitType === 'influent')!.data.parameters.flow).toBe(15000);
  });

  it('stage 6: instantiates objects, none for stream boundaries, all traceable [T3.4]', () => {
    const r = runAutoDesign(validInputs(), { flowsheetId: 'fs-xyz' });
    expect(r.objects.length).toBeGreaterThan(0);
    // No object materialises the influent/effluent stream boundaries.
    const boundaryNodeIds = r.graph.nodes
      .filter((n) => n.data.unitType === 'influent' || n.data.unitType === 'effluent')
      .map((n) => n.id);
    for (const o of r.objects) {
      expect(boundaryNodeIds).not.toContain(o.sourceCalc!.nodeId);
      // Every object traces back to a real simulated node.
      expect(r.results.nodeResults[o.sourceCalc!.nodeId]).toBeDefined();
      expect(o.sourceCalc!.flowsheetId).toBe('fs-xyz');
    }
  });

  it('stage 6 is deterministic (objects snapshot-stable)', () => {
    expect(JSON.stringify(runAutoDesign(validInputs()).objects)).toBe(
      JSON.stringify(runAutoDesign(validInputs()).objects),
    );
  });

  it('stage 7: every object has a non-default placement and a layout block [T4.5]', () => {
    const r = runAutoDesign(validInputs());
    expect(r.objects.every((o) => o.placement.location.x !== 0 || o.placement.location.y !== 0)).toBe(true);
    expect(Array.isArray(r.layout.violations)).toBe(true);
    expect(r.layout.rulesApplied.length).toBeGreaterThan(0);
    expect(r.layout.siteBoundary.length).toBeGreaterThan(2);
  });

  it('stage 7 is deterministic (layout + placements byte-identical)', () => {
    expect(JSON.stringify(runAutoDesign(validInputs()).layout)).toBe(
      JSON.stringify(runAutoDesign(validInputs()).layout),
    );
  });
});
