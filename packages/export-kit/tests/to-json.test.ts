import { describe, it, expect } from 'vitest';
import { parseDesignPackage } from '@repo/object-model';
import { defaultInputs, runAutoDesign, assembleDesignPackage } from '@repo/auto-design';
import { toJSON } from '../src/to-json';

function pkg() {
  const inp = defaultInputs('General');
  inp.meta.projectName = 'Komani WWTP';
  inp.designFlowM3d = 10000;
  inp.siteAreaM2 = 40000;
  return assembleDesignPackage(runAutoDesign(inp, { flowsheetId: 'fs-1' }), {
    projectId: 'p-1',
    flowsheetId: 'fs-1',
    generatedAt: '2026-06-18T09:00:00Z',
  });
}

describe('toJSON (T6.1)', () => {
  it('re-parses via parseDesignPackage and keeps schemaVersion', () => {
    const json = toJSON(pkg());
    const reparsed = parseDesignPackage(JSON.parse(json));
    expect(reparsed.schemaVersion).toBe('1.0.0');
    expect(reparsed.objects.length).toBeGreaterThan(0);
  });

  it('is deterministic for a fixed package', () => {
    expect(toJSON(pkg())).toBe(toJSON(pkg()));
  });
});
