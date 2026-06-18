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
});
