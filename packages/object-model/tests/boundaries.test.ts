/**
 * BOUNDARY GUARD (T0.4) — mechanically enforces the hard constraint that the
 * four new headless packages never import Supabase or any LLM SDK. This is how
 * "AI never performs/guesses engineering math" is enforced in CI: the calc/
 * geometry/layout/export packages physically cannot reach a model or the DB.
 *
 * Only apps/web may touch Supabase. Lives in object-model (the foundational
 * package) and scans all four src trees, so it runs in the standard test gate.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGES_DIR = fileURLToPath(new URL('../..', import.meta.url)); // .../packages
const GUARDED_PACKAGES = ['object-model', 'layout-engine', 'auto-design', 'export-kit'];

// Forbidden module specifiers. Exact names + namespace/prefix matches.
const FORBIDDEN_EXACT = new Set(['ai', 'openai', 'langchain', 'cohere-ai', 'openai-edge', 'replicate']);
const FORBIDDEN_PREFIXES = ['@supabase/', '@anthropic-ai/', '@ai-sdk/', '@langchain/', '@google/generative'];

function listTsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listTsFiles(full));
    else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

function importSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const patterns = [
    /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]/g, // import/export ... from 'x'
    /import\s*['"]([^'"]+)['"]/g, // side-effect import 'x'
    /(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // require('x') / import('x')
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) specs.push(m[1]!);
  }
  return specs;
}

function isForbidden(spec: string): boolean {
  return FORBIDDEN_EXACT.has(spec) || FORBIDDEN_PREFIXES.some((p) => spec.startsWith(p));
}

describe('package boundaries (T0.4)', () => {
  for (const pkg of GUARDED_PACKAGES) {
    it(`@repo/${pkg} src imports no Supabase or LLM SDK`, () => {
      const srcDir = join(PACKAGES_DIR, pkg, 'src');
      const offenders: string[] = [];
      for (const file of listTsFiles(srcDir)) {
        for (const spec of importSpecifiers(readFileSync(file, 'utf8'))) {
          if (isForbidden(spec)) offenders.push(`${file.replace(PACKAGES_DIR, '')}: imports '${spec}'`);
        }
      }
      expect(offenders).toEqual([]);
    });
  }

  it('the guard actually detects a forbidden specifier (self-test)', () => {
    expect(isForbidden('@supabase/supabase-js')).toBe(true);
    expect(isForbidden('openai')).toBe(true);
    expect(isForbidden('@anthropic-ai/sdk')).toBe(true);
    expect(isForbidden('ai')).toBe(true);
    expect(isForbidden('@repo/sim-engine')).toBe(false);
    expect(isForbidden('zod')).toBe(false);
    expect(importSpecifiers("import { x } from '@supabase/ssr';")).toContain('@supabase/ssr');
    expect(importSpecifiers("const a = require('openai')")).toContain('openai');
  });
});
