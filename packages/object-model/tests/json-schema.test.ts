import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { designPackageJSONSchema } from '../src/json-schema';

const ARTIFACT = fileURLToPath(new URL('../schema/design-package.schema.json', import.meta.url));

describe('published JSON Schema (T7.1)', () => {
  it('exposes the package top-level shape', () => {
    const schema = designPackageJSONSchema();
    const props = (schema.properties ?? {}) as Record<string, unknown>;
    for (const key of ['schemaVersion', 'meta', 'objects', 'layout', 'boq', 'compliance', 'totals', 'provenance']) {
      expect(props[key]).toBeDefined();
    }
  });

  it('matches the committed artifact (regenerate if missing; fail on drift)', () => {
    const generated = JSON.stringify(designPackageJSONSchema(), null, 2) + '\n';
    if (!existsSync(ARTIFACT)) {
      writeFileSync(ARTIFACT, generated);
    }
    expect(readFileSync(ARTIFACT, 'utf8')).toBe(generated);
  });
});
