# AquaSim v2 — Phase 1b: Real Values for the 10 Existing Units

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Replace the empty v2 defaults emitted by Phase 1a with real engineering values — sizing dimensions, energy demand, BoQ line items, and full auditable calculation records — for each of the 10 existing unit models. Every number must carry a citation (published literature or supplier source).

**Architecture:** Each unit reads its own design flow from its input stream (`inputs[0].flow`) and its sizing inputs from `parameters`. Plant-wide `PlantContext` is **not** threaded through `.process()` in this phase — keeping the signature stable. Supplier prices live as inline `const` blocks at the top of each unit file with citation comments; Phase 3 extracts them into `packages/design-library/supplier-prices.ts`. No change to the `ProcessResult` type (Phase 1a already made the extension optional).

**Tech Stack:** TypeScript 5, Vitest 3, pnpm workspaces. Working on branch `v2-proposal-generator` (created in Phase 1a).

---

## Context & References

- **Design doc:** `docs/plans/2026-04-02-aquasim-v2-proposal-generator-design.md`
- **Phase 1a plan:** `docs/plans/2026-04-02-aquasim-v2-phase-1a-sim-engine-interface-refactor.md` (complete, ~20 commits, branch `v2-proposal-generator`)
- **Phase 1a completion summary:** `docs/plans/2026-04-02-aquasim-v2-phase-1a-COMPLETE.md`
- **Starting test count:** 61 passing (41 original + 20 Phase 1a additions)
- **Starting branch:** `v2-proposal-generator`
- **Test runner:** `cd packages/sim-engine && npx vitest run`
- **Web build check:** `cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web`

## Success Criteria

1. All 10 existing unit models emit **real** (non-empty) values for the applicable v2 fields:
   - **Influent, Effluent, Splitter, Mixer** — calculation records only (no sizing/energy/capex; these are utility units)
   - **Primary Clarifier, Secondary Clarifier, Thickener** — sizing + civil/mechanical BoQ + calculation records
   - **Bioreactor Anaerobic, Anoxic, Aerobic** — sizing + energy + civil/mechanical BoQ + calculation records
2. Every BoQ line item carries a `sourceCitation` pointing to a real supplier or internal estimate with a date
3. Every calculation record passes `isValidCalculationRecord()` and has non-empty `citation`
4. Full MLE train integration test confirms consistent units, sensible totals, and no regressions
5. **Test count target: 61 → 105 passing** (+44 new tests)
6. Web build still succeeds

## Non-Goals (deferred to later phases)

- **Aeration blower sizing** → Phase 2 adds it as a standalone unit (currently Aerobic Bioreactor emits an O₂-demand calc record; it does NOT size or price a blower)
- **Plant-wide sizing pre-calc** (computing total reactor volume from Marais-Ekama) → later phase; for now the engineer enters `volume` per bioreactor unit manually
- **Supplier price library extraction to `design-library`** → Phase 3
- **Persisting BoQ line items to Supabase** → Phase 4
- **PlantContext threading through `process()`** → later phase if needed

---

## Inline supplier price convention (Phase 1b — temporary)

Each unit file gets a documented `const` block at the top, e.g.:

```typescript
// === Supplier price references (Phase 1b inline — Phase 3 moves to design-library) ===
// Civil concrete reinforced rectangular tank, small plant scale (<5,000 m³)
// Source: CH-ISE internal estimate 2026, typical SA contractor rate
const CIVIL_CONCRETE_ZAR_PER_M3 = 18000;

// Submersible mixer 3kW class, IP68, for anoxic/anaerobic zones
// Source: Typical SA supplier quote 2025 (Grundfos/Xylem range)
const SUBMERSIBLE_MIXER_ZAR = 45000;
```

Citations in Phase 1b reference three kinds of sources:
1. **"CH-ISE internal estimate 2026"** — for civil works (concrete, excavation, piping) that suppliers don't quote directly
2. **"Typical SA supplier quote 2025"** — for mechanical/electrical items where we have rough ranges
3. **Specific supplier + product** where we're confident — e.g. "EDI FlexAir 9-inch fine bubble diffuser datasheet 2024"

Phase 3 replaces these with formal supplier datasheets + PDF quote archives.

---

## Tasks

### Task 0: Verify starting state

**Files:** none (verification only)

**Step 1: Confirm branch**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && git status
```
Expected: `On branch v2-proposal-generator`, working tree clean.

**Step 2: Confirm test baseline**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **61 passing** (5 test files). If anything other than 61, stop and investigate Phase 1a state.

**Step 3: Confirm build baseline**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean build, 12 routes, no TypeScript errors.

---

### Task 1: Add shared test helper `assertHasCalculationRecord`

**Files:**
- Create: `packages/sim-engine/tests/helpers/calculation-records.ts`

**Step 1: Write the helper**

Create `packages/sim-engine/tests/helpers/calculation-records.ts`:
```typescript
import { expect } from 'vitest';
import type { CalculationRecord } from '../../src/types';
import { isValidCalculationRecord } from '../../src/types';

/**
 * Assert that `records` contains at least one CalculationRecord whose
 * `symbol` or `label` matches `needle` (case-insensitive substring match),
 * AND that the matched record is structurally valid.
 *
 * Returns the matched record for further assertions.
 */
export function assertHasCalculationRecord(
  records: CalculationRecord[] | undefined,
  needle: string,
): CalculationRecord {
  expect(records).toBeDefined();
  expect(Array.isArray(records)).toBe(true);
  const n = needle.toLowerCase();
  const match = records!.find(
    r => r.symbol.toLowerCase().includes(n) || r.label.toLowerCase().includes(n),
  );
  expect(match, `No calculation record matching "${needle}" found in ${records!.map(r => r.symbol).join(', ')}`).toBeDefined();
  expect(isValidCalculationRecord(match)).toBe(true);
  expect(match!.citation.length).toBeGreaterThan(0);
  return match!;
}

/** Assert that every record in the list is structurally valid with a non-empty citation */
export function assertAllRecordsValid(records: CalculationRecord[] | undefined): void {
  expect(records).toBeDefined();
  for (const r of records!) {
    expect(isValidCalculationRecord(r), `Invalid record: ${JSON.stringify(r)}`).toBe(true);
    expect(r.citation.length, `Record "${r.symbol}" has empty citation`).toBeGreaterThan(0);
  }
}
```

**Step 2: Run full suite — should still be 61 passing (helper has no tests of its own yet, but it must type-check)**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: 61 passing.

**Step 3: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/tests/helpers/calculation-records.ts && \
git commit -m "Add calculation-record test helpers for Phase 1b"
```

---

### Task 2: Influent — flow source calculation record

**Files:**
- Modify: `packages/sim-engine/src/units/influent.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

**Context:** Influent is a source. It has no physical sizing, no energy demand, no BoQ contribution. Phase 1b adds a single calculation record that documents the raw influent quality + flow as the design basis.

**Step 1: Write failing test**

Add to `packages/sim-engine/tests/units.test.ts` inside the existing `describe('Influent', ...)`:
```typescript
it('emits design-basis calculation records with citations', () => {
  const unit = new Influent({ flow: 1000, COD: 500, TKN: 45, TSS: 250 });
  const result = unit.process([]);
  const flowRecord = assertHasCalculationRecord(result.calculationRecords, 'design flow');
  expect(flowRecord.result.value).toBe(1000);
  expect(flowRecord.result.unit).toBe('m3/d');
  expect(flowRecord.citation).toContain('User input');
  assertAllRecordsValid(result.calculationRecords);
});
```

Also add to the imports at the top of `units.test.ts` (if not already):
```typescript
import { assertHasCalculationRecord, assertAllRecordsValid } from './helpers/calculation-records';
```

**Step 2: Run to verify fail**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run -t "design-basis calculation records"
```
Expected: FAIL — no records matching "design flow".

**Step 3: Implement in `influent.ts`**

Replace the return statement at the bottom of `Influent.process()`. Before:
```typescript
    return {
      outputs: { out: output },
      metadata: {},
      ...emptyUnitOutputs(),
    };
```

After:
```typescript
    const base = emptyUnitOutputs();
    base.calculationRecords = [
      {
        label: 'Design flow (ADWF)',
        symbol: 'Q',
        equation: 'Q = user-specified average dry weather flow',
        inputs: {},
        result: { value: output.flow, unit: 'm3/d' },
        citation: 'User input — project design basis',
      },
      {
        label: 'Influent COD load',
        symbol: 'FSi',
        equation: 'FSi = Q × COD / 1000',
        inputs: {
          Q: { value: output.flow, unit: 'm3/d', source: 'design flow' },
          COD: { value: output.COD, unit: 'mg/L', source: 'user input' },
        },
        result: { value: (output.flow * output.COD) / 1000, unit: 'kgCOD/d' },
        citation: 'Ekama (1984) WRC TT-16/84, sec 4.2',
      },
      {
        label: 'Influent TKN load',
        symbol: 'FNti',
        equation: 'FNti = Q × TKN / 1000',
        inputs: {
          Q: { value: output.flow, unit: 'm3/d', source: 'design flow' },
          TKN: { value: output.TKN, unit: 'mgN/L', source: 'user input' },
        },
        result: { value: (output.flow * output.TKN) / 1000, unit: 'kgN/d' },
        citation: 'Ekama (1984) WRC TT-16/84, sec 4.2',
      },
    ];

    return {
      outputs: { out: output },
      metadata: {},
      ...base,
    };
```

**Step 4: Run — expect pass**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run -t Influent
```
Expected: All Influent tests passing.

**Step 5: Full suite**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **62 passing** (61 + 1).

**Step 6: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/src/units/influent.ts packages/sim-engine/tests/units.test.ts && \
git commit -m "Influent: add design-basis calculation records"
```

---

### Task 3: Effluent — outlet summary calculation records

**Files:**
- Modify: `packages/sim-engine/src/units/effluent.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

**Context:** Effluent is a sink — receives the final stream, has no BoQ or energy. Phase 1b adds calculation records summarising final flow and key effluent concentrations (COD, NH3-N, NO3-N, TSS, TP) for the compliance section of the proposal.

**Step 1: Write failing test**

Add to `describe('Effluent', ...)`:
```typescript
it('emits effluent-summary calculation records with citations', () => {
  const unit = new Effluent({});
  const inf = { ...emptyWaterQuality(), flow: 1000, COD: 60, NH3N: 1.5, NO3N: 8, TSS: 15, TP: 2 };
  const result = unit.process([inf]);
  assertHasCalculationRecord(result.calculationRecords, 'effluent flow');
  assertHasCalculationRecord(result.calculationRecords, 'effluent COD');
  assertHasCalculationRecord(result.calculationRecords, 'effluent NH3-N');
  assertAllRecordsValid(result.calculationRecords);
});
```

**Step 2: Run — expect fail**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run -t "effluent-summary"
```

**Step 3: Implement in `effluent.ts`**

Before the final `return` statement, compute `mixed` (if not already in scope — check the existing file; Effluent currently takes `inputs[0]` or `mixStreams`). Then build `base.calculationRecords`:

```typescript
const base = emptyUnitOutputs();
base.calculationRecords = [
  {
    label: 'Effluent flow',
    symbol: 'Qe',
    equation: 'Qe = Q (full pass-through)',
    inputs: { Q: { value: mixed.flow, unit: 'm3/d', source: 'inlet stream' } },
    result: { value: mixed.flow, unit: 'm3/d' },
    citation: 'Mass balance',
  },
  {
    label: 'Effluent COD',
    symbol: 'CODe',
    equation: 'CODe from final reactor/clarifier stream',
    inputs: {},
    result: { value: mixed.COD, unit: 'mg/L' },
    citation: 'Simulated — compare to DWA limit',
  },
  {
    label: 'Effluent NH3-N (Nae)',
    symbol: 'Nae',
    equation: 'Nae from final reactor effluent',
    inputs: {},
    result: { value: mixed.NH3N, unit: 'mgN/L' },
    citation: 'Ekama (1984) eq 4.11 (nitrification)',
  },
  {
    label: 'Effluent NO3-N (Nne)',
    symbol: 'Nne',
    equation: 'Nne = Nc / (a + s + 1)',
    inputs: {},
    result: { value: mixed.NO3N, unit: 'mgN/L' },
    citation: 'Ekama (1984) eq 4.18 (denitrification)',
  },
  {
    label: 'Effluent TSS',
    symbol: 'TSSe',
    equation: 'TSSe from final clarifier overflow',
    inputs: {},
    result: { value: mixed.TSS, unit: 'mg/L' },
    citation: 'Simulated — compare to DWA limit',
  },
  {
    label: 'Effluent TP',
    symbol: 'TPe',
    equation: 'TPe from final reactor/clarifier stream',
    inputs: {},
    result: { value: mixed.TP, unit: 'mgP/L' },
    citation: 'Simulated — compare to DWA limit',
  },
];

return {
  outputs: { out: mixed },
  metadata: {},
  ...base,
};
```

(Adjust the variable name `mixed` if the existing code uses a different local; check `effluent.ts` first.)

**Step 4: Run — expect pass**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run -t Effluent
```

**Step 5: Full suite**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **63 passing**.

**Step 6: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/src/units/effluent.ts packages/sim-engine/tests/units.test.ts && \
git commit -m "Effluent: add effluent-summary calculation records"
```

---

### Task 4: Splitter — split ratio calculation record

**Files:**
- Modify: `packages/sim-engine/src/units/splitter.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

**Context:** Pure flow bookkeeping. No BoQ. No energy. One calculation record documenting the split.

**Step 1: Write failing test**

Add to `describe('Splitter', ...)`:
```typescript
it('emits split-ratio calculation record', () => {
  const unit = new Splitter({ split_ratio: 0.3 });
  const inf = { ...emptyWaterQuality(), flow: 1000 };
  const result = unit.process([inf]);
  const rec = assertHasCalculationRecord(result.calculationRecords, 'split');
  expect(rec.result.value).toBeCloseTo(300, 1);
  assertAllRecordsValid(result.calculationRecords);
});
```

**Step 2: Run — expect fail**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run -t "split-ratio calc"
```

**Step 3: Implement**

In `splitter.ts`, before the `return`, populate `base.calculationRecords`:
```typescript
const base = emptyUnitOutputs();
const q = inf.flow;
const r = Math.max(0.01, Math.min(0.99, p.split_ratio ?? 0.5));
base.calculationRecords = [
  {
    label: 'Split flow to branch A',
    symbol: 'Qa',
    equation: 'Qa = Q × r',
    inputs: {
      Q: { value: q, unit: 'm3/d', source: 'inlet flow' },
      r: { value: r, unit: '', source: 'split ratio parameter' },
    },
    result: { value: q * r, unit: 'm3/d' },
    citation: 'Flow bookkeeping',
  },
  {
    label: 'Split flow to branch B',
    symbol: 'Qb',
    equation: 'Qb = Q × (1 − r)',
    inputs: {
      Q: { value: q, unit: 'm3/d', source: 'inlet flow' },
      r: { value: r, unit: '', source: 'split ratio parameter' },
    },
    result: { value: q * (1 - r), unit: 'm3/d' },
    citation: 'Flow bookkeeping',
  },
];

return {
  outputs: { a: outA, b: outB },   // whatever keys the existing file uses
  metadata: { split_ratio: r },
  ...base,
};
```

Check the existing output handle names and preserve them.

**Step 4: Run and commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **64 passing**.

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/src/units/splitter.ts packages/sim-engine/tests/units.test.ts && \
git commit -m "Splitter: add split-ratio calculation records"
```

---

### Task 5: Mixer — flow-weighted mix calculation record

**Files:**
- Modify: `packages/sim-engine/src/units/mixer.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

**Context:** Pure flow bookkeeping. One calc record per concentration that's actually being mixed (only for the total flow, since per-parameter would be noisy).

**Step 1: Write failing test**

```typescript
it('emits flow-weighted mix calculation record', () => {
  const unit = new Mixer({});
  const a = { ...emptyWaterQuality(), flow: 600, COD: 400 };
  const b = { ...emptyWaterQuality(), flow: 400, COD: 200 };
  const result = unit.process([a, b]);
  const rec = assertHasCalculationRecord(result.calculationRecords, 'combined flow');
  expect(rec.result.value).toBeCloseTo(1000, 1);
  assertAllRecordsValid(result.calculationRecords);
});
```

**Step 2: Run — expect fail**

**Step 3: Implement**

In `mixer.ts`, before the `return`:
```typescript
const base = emptyUnitOutputs();
const totalFlow = inputs.reduce((sum, s) => sum + s.flow, 0);
base.calculationRecords = [
  {
    label: 'Combined flow',
    symbol: 'Qmix',
    equation: 'Qmix = Σ Qi',
    inputs: Object.fromEntries(
      inputs.map((s, i) => [`Q${i + 1}`, { value: s.flow, unit: 'm3/d', source: `stream ${i + 1}` }]),
    ),
    result: { value: totalFlow, unit: 'm3/d' },
    citation: 'Flow bookkeeping',
  },
  {
    label: 'Flow-weighted COD',
    symbol: 'CODmix',
    equation: 'CODmix = Σ (Qi × CODi) / Σ Qi',
    inputs: {},
    result: { value: mixed.COD, unit: 'mg/L' },
    citation: 'Mass balance — mixStreams() helper',
  },
];
```

(Use whatever local variable name holds the mixed stream.)

**Step 4: Run & commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **65 passing**.

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/src/units/mixer.ts packages/sim-engine/tests/units.test.ts && \
git commit -m "Mixer: add flow-weighted mix calculation records"
```

---

### Task 6: Primary Clarifier — sizing + civil BoQ + scraper BoQ + records

**Files:**
- Modify: `packages/sim-engine/src/units/primary-clarifier.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

**Context:** Sized by surface overflow rate (SOR). Standard design basis: 40 m³/m²·d at ADWF. The existing unit already has `surface_area` and `depth` parameters. Phase 1b translates those + the input flow into structured sizing + civil BoQ + a scraper BoQ line.

**Design equations** (WRC TT-16/84, Metcalf & Eddy Ch. 5):
- `SOR_adwf = Q / A` — must be ≤ 40 m³/m²·d (design guideline, generate warning if exceeded)
- `V = A × d` — tank volume
- `HRT = V / Q × 24` — hydraulic retention time in hours (typical 2–3h)

**Supplier price constants** to add at the top of `primary-clarifier.ts` (after imports):
```typescript
// === Supplier price references (Phase 1b inline — Phase 3 moves to design-library) ===
// Civil concrete reinforced circular/rectangular primary clarifier
// Source: CH-ISE internal estimate 2026, typical SA contractor rate
const CIVIL_CONCRETE_ZAR_PER_M3 = 18000;

// Primary clarifier rotating scraper bridge (small plant, <1000 m² area)
// Source: Typical SA supplier quote 2025 (Andritz / Tsurumi range)
const PRIMARY_SCRAPER_ZAR = 280000;
```

**Step 1: Write failing test**

```typescript
describe('PrimaryClarifier — Phase 1b', () => {
  it('emits sizing, BoQ, and calculation records with citations', () => {
    const unit = new PrimaryClarifier({
      tss_removal: 60, bod_removal: 30, cod_removal: 30,
      tkn_removal: 15, tp_removal: 10, uo_ratio: 0.05,
      surface_area: 500, depth: 3.5,
    });
    const inf = { ...emptyWaterQuality(), flow: 15000, TSS: 300, COD: 800 };
    const result = unit.process([inf]);

    // Sizing
    expect(result.sizing?.surfaceArea.value).toBe(500);
    expect(result.sizing?.surfaceArea.unit).toBe('m2');
    expect(result.sizing?.volume.value).toBeCloseTo(500 * 3.5, 1);
    expect(result.sizing?.volume.unit).toBe('m3');

    // BoQ
    expect(result.capex?.lineItems.length).toBeGreaterThanOrEqual(2);
    const civil = result.capex!.lineItems.find(i => i.category === 'civil');
    expect(civil).toBeDefined();
    expect(civil!.sourceCitation).toContain('CH-ISE internal estimate');
    const mech = result.capex!.lineItems.find(i => i.category === 'mechanical');
    expect(mech).toBeDefined();
    expect(result.capex!.total).toBeGreaterThan(0);

    // Calculation records
    assertHasCalculationRecord(result.calculationRecords, 'SOR');
    assertHasCalculationRecord(result.calculationRecords, 'HRT');
    assertAllRecordsValid(result.calculationRecords);
  });

  it('warns when SOR exceeds 40 m3/m2/d at ADWF', () => {
    const unit = new PrimaryClarifier({
      tss_removal: 60, bod_removal: 30, cod_removal: 30,
      tkn_removal: 15, tp_removal: 10, uo_ratio: 0.05,
      surface_area: 100, depth: 3.5,
    });
    const inf = { ...emptyWaterQuality(), flow: 10000, TSS: 300 };  // 10000/100 = 100 — way over
    const result = unit.process([inf]);
    expect(result.warnings?.length).toBeGreaterThan(0);
    expect(result.warnings![0]).toMatch(/SOR/i);
  });
});
```

**Step 2: Run — expect fail**

**Step 3: Implement in `primary-clarifier.ts`**

After computing `overflow` and `underflow`, and BEFORE the existing `return`, build the `base` (call `emptyUnitOutputs()`) and populate it:

```typescript
const base = emptyUnitOutputs();
const area = p.surface_area ?? 500;
const depth = p.depth ?? 3.5;
const volume = area * depth;
const sor = inf.flow / area;
const hrt_h = (volume / inf.flow) * 24;

base.sizing = {
  surfaceArea: { value: area, unit: 'm2' },
  depth: { value: depth, unit: 'm' },
  volume: { value: volume, unit: 'm3' },
};

// BoQ
base.capex = {
  lineItems: [
    {
      category: 'civil',
      description: `Primary clarifier reinforced concrete tank (${volume.toFixed(0)} m³)`,
      quantity: volume,
      unit: 'm3',
      unitPriceZar: CIVIL_CONCRETE_ZAR_PER_M3,
      sourceCitation: 'CH-ISE internal estimate 2026',
    },
    {
      category: 'mechanical',
      description: 'Primary clarifier rotating scraper bridge',
      quantity: 1,
      unit: 'ea',
      unitPriceZar: PRIMARY_SCRAPER_ZAR,
      sourceCitation: 'Typical SA supplier quote 2025 (Andritz/Tsurumi range)',
    },
  ],
  total: volume * CIVIL_CONCRETE_ZAR_PER_M3 + PRIMARY_SCRAPER_ZAR,
};

// Calculation records
base.calculationRecords = [
  {
    label: 'Surface overflow rate (ADWF)',
    symbol: 'SOR',
    equation: 'SOR = Q / A',
    inputs: {
      Q: { value: inf.flow, unit: 'm3/d', source: 'inlet flow' },
      A: { value: area, unit: 'm2', source: 'user input' },
    },
    result: { value: sor, unit: 'm3/m2/d' },
    citation: 'Metcalf & Eddy (2014) Ch. 5 / WRC TT-16/84',
  },
  {
    label: 'Hydraulic retention time',
    symbol: 'HRT',
    equation: 'HRT = V / Q × 24',
    inputs: {
      V: { value: volume, unit: 'm3', source: 'A × d' },
      Q: { value: inf.flow, unit: 'm3/d', source: 'inlet flow' },
    },
    result: { value: hrt_h, unit: 'h' },
    citation: 'Metcalf & Eddy (2014) Ch. 5',
  },
];

// Warnings
if (sor > 40) {
  base.warnings.push(
    `SOR = ${sor.toFixed(1)} m³/m²·d exceeds typical design limit of 40 m³/m²·d at ADWF. Increase surface area.`,
  );
}
```

Then change the `return` to:
```typescript
return {
  outputs: { overflow, underflow },
  metadata: {
    surface_loading_rate: sor,
    hydraulic_retention_time: hrt_h,
  },
  ...base,
};
```

**Step 4: Run**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run -t "PrimaryClarifier"
```

**Step 5: Full suite**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **67 passing** (65 + 2 new).

**Step 6: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/src/units/primary-clarifier.ts packages/sim-engine/tests/units.test.ts && \
git commit -m "PrimaryClarifier: add sizing, BoQ, and calculation records"
```

---

### Task 7: Secondary Clarifier — sizing + SLR check + civil/scraper BoQ

**Files:**
- Modify: `packages/sim-engine/src/units/secondary-clarifier.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

**Context:** Sized by **both** SOR and solids loading rate (SLR). WRC guideline: SOR ≤ 1 m/h at peak (≈ 24 m³/m²·d), SLR ≤ 6 kg/m²·h (≈ 144 kg/m²·d). The clarifier is usually the sizing bottleneck — either hydraulic or solids.

**Design equations:**
- `SOR = Q_peak / A` (peak wet-weather flow)
- `SLR = (Q + Q_ras) × MLSS / (A × 1000)` — MLSS is TSS of reactor stream entering the clarifier
- For Phase 1b we use `Q × 1.1` as the peak approximation (xlsm uses AWWF = ADWF × 1.1)

**Supplier prices:**
```typescript
// === Supplier price references (Phase 1b inline — Phase 3 moves to design-library) ===
const CIVIL_CONCRETE_ZAR_PER_M3 = 18000;
// Secondary clarifier traveling bridge / suction scraper
// Source: Typical SA supplier quote 2025 (Andritz/Westech range)
const SECONDARY_SCRAPER_ZAR = 320000;
```

**Step 1: Write failing test**

```typescript
describe('SecondaryClarifier — Phase 1b', () => {
  it('emits sizing with SOR and SLR checks, BoQ, and records', () => {
    const unit = new SecondaryClarifier({
      surface_area: 800, depth: 4.0, tss_removal: 99.5, uo_ratio: 0.75,
    });
    const inf = { ...emptyWaterQuality(), flow: 10000, TSS: 3500 };
    const result = unit.process([inf]);

    expect(result.sizing?.surfaceArea.value).toBe(800);
    expect(result.sizing?.volume.value).toBeCloseTo(3200, 1);

    assertHasCalculationRecord(result.calculationRecords, 'SOR');
    assertHasCalculationRecord(result.calculationRecords, 'SLR');

    const civil = result.capex!.lineItems.find(i => i.category === 'civil');
    const mech = result.capex!.lineItems.find(i => i.category === 'mechanical');
    expect(civil).toBeDefined();
    expect(mech).toBeDefined();
    expect(result.capex!.total).toBeGreaterThan(0);
    assertAllRecordsValid(result.calculationRecords);
  });

  it('warns when SLR exceeds 6 kg/m2/h at peak', () => {
    const unit = new SecondaryClarifier({
      surface_area: 100, depth: 4.0, tss_removal: 99.5, uo_ratio: 0.75,
    });
    const inf = { ...emptyWaterQuality(), flow: 10000, TSS: 5000 };
    const result = unit.process([inf]);
    expect(result.warnings?.some(w => /SLR/i.test(w))).toBe(true);
  });
});
```

**Step 2: Run — expect fail**

**Step 3: Implement**

Follow the same pattern as Primary Clarifier. After the existing overflow/underflow calcs, compute:
```typescript
const area = p.surface_area ?? 800;
const depth = p.depth ?? 4.0;
const volume = area * depth;
const q_peak = inf.flow * 1.1;   // AWWF approximation
const sor = q_peak / area;         // m3/m2/d
const sor_mph = sor / 24;          // m/h
const mlssIn = inf.TSS;
const totalFlowToClarifier = inf.flow * (1 + (p.uo_ratio ?? 0.75));
const slr_kg_m2_h = (totalFlowToClarifier * mlssIn) / (area * 1000 * 24);

const base = emptyUnitOutputs();
base.sizing = {
  surfaceArea: { value: area, unit: 'm2' },
  depth: { value: depth, unit: 'm' },
  volume: { value: volume, unit: 'm3' },
};
base.capex = {
  lineItems: [
    {
      category: 'civil',
      description: `Secondary clarifier reinforced concrete tank (${volume.toFixed(0)} m³)`,
      quantity: volume,
      unit: 'm3',
      unitPriceZar: CIVIL_CONCRETE_ZAR_PER_M3,
      sourceCitation: 'CH-ISE internal estimate 2026',
    },
    {
      category: 'mechanical',
      description: 'Secondary clarifier scraper / suction bridge',
      quantity: 1,
      unit: 'ea',
      unitPriceZar: SECONDARY_SCRAPER_ZAR,
      sourceCitation: 'Typical SA supplier quote 2025 (Andritz/Westech range)',
    },
  ],
  total: volume * CIVIL_CONCRETE_ZAR_PER_M3 + SECONDARY_SCRAPER_ZAR,
};
base.calculationRecords = [
  {
    label: 'Surface overflow rate (peak)',
    symbol: 'SOR',
    equation: 'SOR = Q_peak / A',
    inputs: {
      Q_peak: { value: q_peak, unit: 'm3/d', source: 'AWWF = Q × 1.1' },
      A: { value: area, unit: 'm2', source: 'user input' },
    },
    result: { value: sor_mph, unit: 'm/h' },
    citation: 'WRC TT-16/84 — SOR ≤ 1 m/h at peak',
  },
  {
    label: 'Solids loading rate',
    symbol: 'SLR',
    equation: 'SLR = (Q + Q_ras) × MLSS / (A × 24)',
    inputs: {
      Q_total: { value: totalFlowToClarifier, unit: 'm3/d', source: 'feed + RAS' },
      MLSS: { value: mlssIn, unit: 'mg/L', source: 'reactor effluent TSS' },
      A: { value: area, unit: 'm2', source: 'user input' },
    },
    result: { value: slr_kg_m2_h, unit: 'kg/m2/h' },
    citation: 'WRC TT-16/84 — SLR ≤ 6 kg/m²·h',
  },
];
if (sor_mph > 1.0) base.warnings.push(`SOR = ${sor_mph.toFixed(2)} m/h exceeds 1 m/h at peak. Increase surface area.`);
if (slr_kg_m2_h > 6.0) base.warnings.push(`SLR = ${slr_kg_m2_h.toFixed(2)} kg/m²·h exceeds 6 kg/m²·h. Increase surface area.`);
```

Then update the `return` to spread `base`.

**Step 4: Run & commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **69 passing**.

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/src/units/secondary-clarifier.ts packages/sim-engine/tests/units.test.ts && \
git commit -m "SecondaryClarifier: add sizing with SOR/SLR checks, BoQ, and records"
```

---

### Task 8: Thickener — add `surface_area` param + sizing + BoQ

**Files:**
- Modify: `packages/sim-engine/src/units/thickener.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

**Context:** Thickener currently has only `target_solids_pct` and `capture_efficiency` parameters. Phase 1b adds `surface_area` (m²) and a `depth` (m) so sizing can be emitted, using the SLR design method.

**Design equation:** `SLR = F_solids / A`, typical ≤ 40 kg/m²·d for gravity thickener (Metcalf & Eddy Ch. 14).

**Supplier prices:**
```typescript
const CIVIL_CONCRETE_ZAR_PER_M3 = 18000;
// Picket fence thickener drive (~3 kW)
// Source: Typical SA supplier quote 2025 (Westech / Andritz range)
const PICKET_FENCE_DRIVE_ZAR = 180000;
```

**Step 1: Add two new parameters to `parameterSchema`**

Insert into `parameterSchema` in `thickener.ts`:
```typescript
{ key: 'surface_area', label: 'Surface Area', unit: 'm²', min: 5, max: 500, step: 5, defaultValue: 30 },
{ key: 'depth', label: 'Depth', unit: 'm', min: 2, max: 5, step: 0.5, defaultValue: 3.0 },
```

**Step 2: Write failing test**

```typescript
describe('Thickener — Phase 1b', () => {
  it('emits sizing with SLR check, civil + drive BoQ, and records', () => {
    const unit = new Thickener({
      target_solids_pct: 5, capture_efficiency: 95,
      surface_area: 30, depth: 3.0,
    });
    const inf = { ...emptyWaterQuality(), flow: 100, TSS: 10000 };
    const result = unit.process([inf]);
    expect(result.sizing?.surfaceArea.value).toBe(30);
    expect(result.sizing?.volume.value).toBeCloseTo(90, 1);
    assertHasCalculationRecord(result.calculationRecords, 'SLR');
    const civil = result.capex!.lineItems.find(i => i.category === 'civil');
    const mech = result.capex!.lineItems.find(i => i.category === 'mechanical');
    expect(civil).toBeDefined();
    expect(mech).toBeDefined();
    expect(result.capex!.total).toBeGreaterThan(0);
    assertAllRecordsValid(result.calculationRecords);
  });
});
```

**Step 3: Run — expect fail**

**Step 4: Implement**

After the existing thickened/overflow calcs:
```typescript
const area = p.surface_area ?? 30;
const depth = p.depth ?? 3.0;
const volume = area * depth;
const solidsLoadKg = (inf.TSS * inf.flow) / 1000;     // kg/d
const slr = solidsLoadKg / area;                       // kg/m²·d

const base = emptyUnitOutputs();
base.sizing = {
  surfaceArea: { value: area, unit: 'm2' },
  depth: { value: depth, unit: 'm' },
  volume: { value: volume, unit: 'm3' },
};
base.capex = {
  lineItems: [
    {
      category: 'civil',
      description: `Gravity thickener reinforced concrete tank (${volume.toFixed(0)} m³)`,
      quantity: volume,
      unit: 'm3',
      unitPriceZar: CIVIL_CONCRETE_ZAR_PER_M3,
      sourceCitation: 'CH-ISE internal estimate 2026',
    },
    {
      category: 'mechanical',
      description: 'Picket fence thickener drive',
      quantity: 1,
      unit: 'ea',
      unitPriceZar: PICKET_FENCE_DRIVE_ZAR,
      sourceCitation: 'Typical SA supplier quote 2025 (Westech/Andritz range)',
    },
  ],
  total: volume * CIVIL_CONCRETE_ZAR_PER_M3 + PICKET_FENCE_DRIVE_ZAR,
};
base.calculationRecords = [
  {
    label: 'Solids loading rate',
    symbol: 'SLR',
    equation: 'SLR = (Q × TSS) / (A × 1000)',
    inputs: {
      Q: { value: inf.flow, unit: 'm3/d', source: 'inlet flow' },
      TSS: { value: inf.TSS, unit: 'mg/L', source: 'inlet TSS' },
      A: { value: area, unit: 'm2', source: 'user input' },
    },
    result: { value: slr, unit: 'kg/m2/d' },
    citation: 'Metcalf & Eddy (2014) Ch. 14 — SLR ≤ 40 kg/m²·d',
  },
];
if (slr > 40) base.warnings.push(`SLR = ${slr.toFixed(1)} kg/m²·d exceeds 40 kg/m²·d. Increase surface area.`);
```

**Step 5: Run & commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **70 passing**.

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/src/units/thickener.ts packages/sim-engine/tests/units.test.ts && \
git commit -m "Thickener: add surface_area param, sizing, BoQ, and records"
```

---

### Task 9: Bioreactor Anaerobic — sizing + mixer BoQ + records

**Files:**
- Modify: `packages/sim-engine/src/units/bioreactor-anaerobic.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

**Context:** Existing unit already has `volume` as a parameter. Phase 1b surfaces HRT and volume as structured sizing, adds civil + submersible mixer BoQ lines, adds mixing energy (~5 W/m³ per Metcalf & Eddy), and emits calculation records.

**Supplier prices:**
```typescript
const CIVIL_CONCRETE_ZAR_PER_M3 = 18000;
// Submersible mixer for anaerobic zone, ~3 kW
// Source: Typical SA supplier quote 2025 (Grundfos SMD / Xylem Flygt range)
const SUBMERSIBLE_MIXER_ZAR = 45000;
// Rule of thumb: one 3 kW mixer per 500 m³ of anaerobic volume
const MIXER_VOLUME_PER_UNIT_M3 = 500;
const MIXER_KW_PER_UNIT = 3;
```

**Step 1: Write failing test**

```typescript
describe('BioreactorAnaerobic — Phase 1b', () => {
  it('emits sizing, energy, mixer BoQ, and records', () => {
    const unit = new BioreactorAnaerobic({
      volume: 1500, depth: 4.5, p_release_rate: 0.3, vfa_fraction: 0.2,
    });
    const inf = { ...emptyWaterQuality(), flow: 5000, sCOD: 200, TP: 10 };
    const result = unit.process([inf]);
    expect(result.sizing?.volume.value).toBe(1500);
    expect(result.sizing?.HRT.value).toBeCloseTo(1500 / 5000 * 24, 1);
    expect(result.energy?.installedKW).toBeGreaterThan(0);
    const civil = result.capex!.lineItems.find(i => i.category === 'civil');
    const mech = result.capex!.lineItems.find(i => i.category === 'mechanical');
    expect(civil).toBeDefined();
    expect(mech).toBeDefined();
    expect(mech!.description.toLowerCase()).toContain('mixer');
    assertHasCalculationRecord(result.calculationRecords, 'HRT');
    assertAllRecordsValid(result.calculationRecords);
  });
});
```

**Step 2: Run — expect fail**

**Step 3: Implement** — add the constants at the top, then after existing calculations:

```typescript
const depth = p.depth ?? 4.5;
const hrt_h = (volume / inf.flow) * 24;
const mixerCount = Math.max(1, Math.ceil(volume / MIXER_VOLUME_PER_UNIT_M3));
const installedKW = mixerCount * MIXER_KW_PER_UNIT;
const dailyKWh = installedKW * 24;

const base = emptyUnitOutputs();
base.sizing = {
  volume: { value: volume, unit: 'm3' },
  depth: { value: depth, unit: 'm' },
  HRT: { value: hrt_h, unit: 'h' },
};
base.energy = {
  installedKW,
  dailyKWh,
  records: [
    {
      label: 'Mixing power demand',
      symbol: 'P_mix',
      equation: 'P_mix = n_mixers × kW_per_mixer',
      inputs: {
        n_mixers: { value: mixerCount, unit: '', source: 'V / 500 m³ per unit' },
        kW_per_mixer: { value: MIXER_KW_PER_UNIT, unit: 'kW', source: 'typical 3 kW submersible' },
      },
      result: { value: installedKW, unit: 'kW' },
      citation: 'Metcalf & Eddy (2014) Ch. 5 — ~5 W/m³ anaerobic mixing',
    },
  ],
};
base.capex = {
  lineItems: [
    {
      category: 'civil',
      description: `Anaerobic reactor reinforced concrete tank (${volume.toFixed(0)} m³)`,
      quantity: volume,
      unit: 'm3',
      unitPriceZar: CIVIL_CONCRETE_ZAR_PER_M3,
      sourceCitation: 'CH-ISE internal estimate 2026',
    },
    {
      category: 'mechanical',
      description: `Submersible mixer 3kW × ${mixerCount}`,
      quantity: mixerCount,
      unit: 'ea',
      unitPriceZar: SUBMERSIBLE_MIXER_ZAR,
      sourceCitation: 'Typical SA supplier quote 2025 (Grundfos/Xylem range)',
    },
  ],
  total: volume * CIVIL_CONCRETE_ZAR_PER_M3 + mixerCount * SUBMERSIBLE_MIXER_ZAR,
};
base.calculationRecords = [
  {
    label: 'Hydraulic retention time',
    symbol: 'HRT',
    equation: 'HRT = V / Q × 24',
    inputs: {
      V: { value: volume, unit: 'm3', source: 'user input' },
      Q: { value: inf.flow, unit: 'm3/d', source: 'inlet flow' },
    },
    result: { value: hrt_h, unit: 'h' },
    citation: 'Ekama (1984) — typical anaerobic HRT 1-2h for BPR',
  },
  {
    label: 'Phosphorus released by PAOs',
    symbol: 'P_rel',
    equation: 'P_rel = VFA_consumed × p_release_rate',
    inputs: {
      VFA_consumed: { value: vfaConsumed, unit: 'mgCOD/L', source: 'PAO uptake' },
      p_release_rate: { value: pReleaseRate, unit: 'mgP/mgCOD', source: 'user input' },
    },
    result: { value: pReleased, unit: 'mgP/L' },
    citation: 'Wentzel et al. (1990) — UCT BPR model',
  },
];
if (hrt_h < 0.5) base.warnings.push(`HRT = ${hrt_h.toFixed(2)}h is very short. Typical anaerobic HRT for BPR is 1-2h.`);
```

**Step 4: Run & commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **71 passing**.

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/src/units/bioreactor-anaerobic.ts packages/sim-engine/tests/units.test.ts && \
git commit -m "BioreactorAnaerobic: add sizing, mixing energy, BoQ, records"
```

---

### Task 10: Bioreactor Anoxic — sizing + mixer BoQ + denit capacity record

**Files:**
- Modify: `packages/sim-engine/src/units/bioreactor-anoxic.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

**Context:** Same structural pattern as Anaerobic. Add a calculation record for denitrification capacity `Dp1` (Ekama 1984 eq 4.15 simplified form): `Dp1 ≈ k × MLSS × V / Q`.

**Supplier prices:** Same constants as Task 9 (`CIVIL_CONCRETE_ZAR_PER_M3`, `SUBMERSIBLE_MIXER_ZAR`, `MIXER_VOLUME_PER_UNIT_M3`, `MIXER_KW_PER_UNIT`).

**Step 1: Write failing test**

```typescript
describe('BioreactorAnoxic — Phase 1b', () => {
  it('emits sizing, energy, mixer BoQ, and denitrification capacity record', () => {
    const unit = new BioreactorAnoxic({
      volume: 2000, depth: 4.5, denitrification_eff: 85, cod_n_ratio: 6,
    });
    const inf = { ...emptyWaterQuality(), flow: 5000, sCOD: 300, NO3N: 15, TSS: 3500 };
    const result = unit.process([inf]);
    expect(result.sizing?.volume.value).toBe(2000);
    expect(result.energy?.installedKW).toBeGreaterThan(0);
    expect(result.capex!.lineItems.find(i => i.category === 'civil')).toBeDefined();
    expect(result.capex!.lineItems.find(i => i.category === 'mechanical')).toBeDefined();
    assertHasCalculationRecord(result.calculationRecords, 'HRT');
    assertHasCalculationRecord(result.calculationRecords, 'denit');
    assertAllRecordsValid(result.calculationRecords);
  });
});
```

**Step 2: Run — expect fail**

**Step 3: Implement** — same structure as Task 9 but with denit-specific records:

```typescript
const depth = p.depth ?? 4.5;
const hrt_h = (volume / inf.flow) * 24;
const mixerCount = Math.max(1, Math.ceil(volume / MIXER_VOLUME_PER_UNIT_M3));
const installedKW = mixerCount * MIXER_KW_PER_UNIT;
const dailyKWh = installedKW * 24;
// Denitrification capacity (simplified): Dp1 ≈ K2 × Xv × V / Q  
// K2 = 0.1 mgN/mgVSS·d at 20°C (Ekama 1984 Table 4.2)
const K2 = 0.1;
const Xv = inf.TSS * 0.8;  // MLVSS approx as 80% of MLSS
const dp1 = (K2 * Xv * volume) / inf.flow;

// ... populate base.sizing, base.energy, base.capex (same shape as Task 9, "Anoxic" labels) ...

base.calculationRecords = [
  {
    label: 'Hydraulic retention time',
    symbol: 'HRT',
    equation: 'HRT = V / Q × 24',
    inputs: {
      V: { value: volume, unit: 'm3', source: 'user input' },
      Q: { value: inf.flow, unit: 'm3/d', source: 'inlet flow' },
    },
    result: { value: hrt_h, unit: 'h' },
    citation: 'Ekama (1984) — typical anoxic HRT 1-3h',
  },
  {
    label: 'Denitrification capacity',
    symbol: 'Dp1',
    equation: 'Dp1 ≈ K2 × MLVSS × V / Q',
    inputs: {
      K2: { value: K2, unit: 'mgN/mgVSS·d', source: 'Ekama 1984 Table 4.2 at 20°C' },
      MLVSS: { value: Xv, unit: 'mg/L', source: '0.8 × reactor MLSS' },
      V: { value: volume, unit: 'm3', source: 'user input' },
      Q: { value: inf.flow, unit: 'm3/d', source: 'inlet flow' },
    },
    result: { value: dp1, unit: 'mgN/L' },
    citation: 'Ekama (1984) WRC TT-16/84, eq 4.15 (simplified)',
  },
];
```

**Step 4: Run & commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **72 passing**.

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/src/units/bioreactor-anoxic.ts packages/sim-engine/tests/units.test.ts && \
git commit -m "BioreactorAnoxic: add sizing, energy, BoQ, denitrification capacity record"
```

---

### Task 11: Bioreactor Aerobic — sizing + O2 demand energy + BoQ

**Files:**
- Modify: `packages/sim-engine/src/units/bioreactor-aerobic.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

**Context:** This is the most substantive existing unit. It already computes HRT, MLSS, and O₂ demand in `metadata`. Phase 1b:
1. Surfaces `volume`, `depth`, `HRT`, `MLSS` into structured `sizing`
2. Adds calculation records for MLSS check, O₂ demand (carbonaceous + nitrification − denitrification), and biomass production
3. Adds civil BoQ (concrete) + diffuser BoQ (EDI FlexAir 9" fine bubble)
4. Emits `energy.installedKW = 0` with a note that the aeration blower is sized separately (Phase 2 adds it as a standalone unit). The *diffusers themselves* are civil/mechanical BoQ, not energy consumers.

**Supplier prices:**
```typescript
const CIVIL_CONCRETE_ZAR_PER_M3 = 18000;
// Fine bubble diffuser, 9" EDI FlexAir tubular
// Source: EDI FlexAir catalogue 2024, typical SA distributor quote
const EDI_FLEXAIR_9IN_ZAR = 850;
// Diffuser density rule of thumb: ~1 diffuser per 3 m³ reactor volume (fine bubble grid)
const DIFFUSER_PER_M3 = 1 / 3;
```

**Step 1: Write failing test**

```typescript
describe('BioreactorAerobic — Phase 1b', () => {
  it('emits sizing, O2 demand records, civil + diffuser BoQ', () => {
    const unit = new BioreactorAerobic({
      volume: 5000, depth: 4.5, do_setpoint: 2.0,
      srt: 12, yield_obs: 0.45, nitrification_eff: 95,
      cod_removal_eff: 90, bod_removal_eff: 95, kd: 0.06,
    });
    const inf = { ...emptyWaterQuality(), flow: 10000, sCOD: 300, COD: 500, NH3N: 30, TKN: 40 };
    const result = unit.process([inf]);

    // Sizing
    expect(result.sizing?.volume.value).toBe(5000);
    expect(result.sizing?.HRT.value).toBeCloseTo(5000 / 10000 * 24, 1);
    expect(result.sizing?.MLSS).toBeDefined();

    // Calculation records
    assertHasCalculationRecord(result.calculationRecords, 'HRT');
    assertHasCalculationRecord(result.calculationRecords, 'O2');
    assertHasCalculationRecord(result.calculationRecords, 'MLSS');

    // BoQ
    const civil = result.capex!.lineItems.find(i => i.category === 'civil');
    const diffusers = result.capex!.lineItems.find(i => i.description.toLowerCase().includes('diffuser'));
    expect(civil).toBeDefined();
    expect(diffusers).toBeDefined();
    expect(diffusers!.quantity).toBeGreaterThan(0);
    expect(result.capex!.total).toBeGreaterThan(0);

    // Note: installedKW == 0 because the blower is a separate unit (Phase 2)
    expect(result.energy?.installedKW).toBe(0);

    assertAllRecordsValid(result.calculationRecords);
  });
});
```

**Step 2: Run — expect fail**

**Step 3: Implement** — add constants at top; after existing metadata computation:

```typescript
const depth = p.depth ?? 4.5;
const o2TotalKgPerD = (Math.max(0, o2Carbonaceous) + o2Nitrification) * inf.flow / 1000;
const diffuserCount = Math.ceil(volume * DIFFUSER_PER_M3);

const base = emptyUnitOutputs();
base.sizing = {
  volume: { value: volume, unit: 'm3' },
  depth: { value: depth, unit: 'm' },
  HRT: { value: hrt * 24, unit: 'h' },
  MLSS: { value: mlss, unit: 'mg/L' },
};
base.energy = {
  // Blower is a separate unit (Phase 2); here we only document the O2 demand.
  installedKW: 0,
  dailyKWh: 0,
  records: [
    {
      label: 'Total O2 demand',
      symbol: 'FOt',
      equation: 'FOt = (FOc + FOn − FOdn) × Q / 1000',
      inputs: {
        FOc: { value: Math.max(0, o2Carbonaceous), unit: 'mgO/L', source: 'carbonaceous' },
        FOn: { value: o2Nitrification, unit: 'mgO/L', source: 'nitrification' },
        Q: { value: inf.flow, unit: 'm3/d', source: 'inlet flow' },
      },
      result: { value: o2TotalKgPerD, unit: 'kgO2/d' },
      citation: 'Ekama (1984) WRC TT-16/84, eq 4.23',
    },
  ],
};
base.capex = {
  lineItems: [
    {
      category: 'civil',
      description: `Aerobic reactor reinforced concrete tank (${volume.toFixed(0)} m³)`,
      quantity: volume,
      unit: 'm3',
      unitPriceZar: CIVIL_CONCRETE_ZAR_PER_M3,
      sourceCitation: 'CH-ISE internal estimate 2026',
    },
    {
      category: 'mechanical',
      description: `9" fine bubble diffusers (EDI FlexAir) × ${diffuserCount}`,
      quantity: diffuserCount,
      unit: 'ea',
      unitPriceZar: EDI_FLEXAIR_9IN_ZAR,
      sourceCitation: 'EDI FlexAir catalogue 2024 / typical SA distributor',
    },
  ],
  total: volume * CIVIL_CONCRETE_ZAR_PER_M3 + diffuserCount * EDI_FLEXAIR_9IN_ZAR,
};
base.calculationRecords = [
  {
    label: 'Hydraulic retention time',
    symbol: 'HRT',
    equation: 'HRT = V / Q × 24',
    inputs: {
      V: { value: volume, unit: 'm3', source: 'user input' },
      Q: { value: inf.flow, unit: 'm3/d', source: 'inlet flow' },
    },
    result: { value: hrt * 24, unit: 'h' },
    citation: 'Ekama (1984) WRC TT-16/84, eq 4.1',
  },
  {
    label: 'Mixed liquor suspended solids',
    symbol: 'MLSS',
    equation: 'MLSS = Y_obs × sCOD_removed × SRT / HRT',
    inputs: {
      Y_obs: { value: yObs, unit: 'mgVSS/mgCOD', source: 'user input' },
      sCOD_removed: { value: sCOD_removed, unit: 'mg/L', source: 'biodegradation' },
      SRT: { value: srt, unit: 'd', source: 'user input' },
      HRT: { value: hrt, unit: 'd', source: 'V/Q' },
    },
    result: { value: mlss, unit: 'mg/L' },
    citation: 'Ekama (1984) WRC TT-16/84, eq 4.8',
  },
  {
    label: 'Carbonaceous O2 demand',
    symbol: 'FOc',
    equation: 'FOc = sCOD_rem − 1.42 × biomass_produced',
    inputs: {
      sCOD_rem: { value: sCOD_removed, unit: 'mg/L', source: 'biodegradation' },
      biomass: { value: biomassProduced, unit: 'mg/L', source: 'Y × sCOD / (1 + kd·SRT)' },
    },
    result: { value: Math.max(0, o2Carbonaceous), unit: 'mgO/L' },
    citation: 'Ekama (1984) WRC TT-16/84, eq 4.22',
  },
  {
    label: 'Nitrification O2 demand',
    symbol: 'FOn',
    equation: 'FOn = 4.57 × NH3_oxidised',
    inputs: {
      NH3_ox: { value: nh3Oxidized, unit: 'mgN/L', source: 'nitrification' },
    },
    result: { value: o2Nitrification, unit: 'mgO/L' },
    citation: 'Ekama (1984) WRC TT-16/84, eq 4.21',
  },
];
if (mlss > 6000) base.warnings.push(`MLSS = ${mlss.toFixed(0)} mg/L > 6000. Consider MBR or more volume.`);
if (mlss < 2000) base.warnings.push(`MLSS = ${mlss.toFixed(0)} mg/L < 2000. Reactor may be underloaded.`);
```

**Step 4: Run & commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **73 passing**.

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/src/units/bioreactor-aerobic.ts packages/sim-engine/tests/units.test.ts && \
git commit -m "BioreactorAerobic: add sizing, O2 demand records, civil + diffuser BoQ"
```

---

### Task 12: Integration test — full MLE train with real v2 values

**Files:**
- Modify: `packages/sim-engine/tests/simulator.test.ts`

**Context:** Phase 1a added a shape-only test for the full MLE train. Phase 1b adds a content test: after running a realistic MLE train, the total CapEx is non-zero, the total installed kW is > 0, and every node has non-empty calculation records with citations.

**Step 1: Write the integration test**

Add to `simulator.test.ts`:
```typescript
import { assertAllRecordsValid } from './helpers/calculation-records';

describe('v2 content — full MLE train', () => {
  it('produces real sizing, energy, BoQ, and calc records end-to-end', () => {
    // Use whatever existing MLE fixture or builder the file already has.
    // If none, construct a minimal graph: Influent → Anoxic → Aerobic → SecondaryClarifier → Effluent
    // with recycle SecondaryClarifier.underflow → Anoxic
    const results = simulate(mleGraph);   // existing helper

    // Aggregate across every node
    let totalCapex = 0;
    let totalKW = 0;
    let totalRecordCount = 0;
    for (const nodeResult of Object.values(results.nodeResults)) {
      const r = nodeResult as any;
      if (r.capex?.total) totalCapex += r.capex.total;
      if (r.energy?.installedKW) totalKW += r.energy.installedKW;
      if (r.calculationRecords) {
        totalRecordCount += r.calculationRecords.length;
        assertAllRecordsValid(r.calculationRecords);
      }
    }

    expect(totalCapex).toBeGreaterThan(1_000_000);  // MLE plant ≥ ZAR 1m
    expect(totalKW).toBeGreaterThan(0);              // mixers at minimum
    expect(totalRecordCount).toBeGreaterThan(10);    // several records per unit
  });
});
```

**Step 2: Run**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run -t "v2 content"
```
Expected: PASS.

**Step 3: Run full suite**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **74 passing**.

**Step 4: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/tests/simulator.test.ts && \
git commit -m "Add full-train integration test: v2 real values end-to-end"
```

---

### Task 13: Final verification — tests, type check, build

**Files:** none (verification only)

**Step 1: Run full sim-engine test suite**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **74 passing** (61 from Phase 1a + 13 new Phase 1b tests).

> Note: The exact count may be 1–2 higher or lower depending on how many sub-tests each unit's `describe` block ends up with. Acceptable range is 72–76. Anything outside that range, stop and investigate.

**Step 2: Run type check**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx tsc --noEmit
```
Expected: Zero errors.

**Step 3: Run web build**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean build, 12 routes. No TypeScript errors.

**Step 4: Review branch commit history**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && git log --oneline main..HEAD
```
Expected: Phase 1a commits + ~11 new Phase 1b commits.

---

### Task 14: Phase 1b completion summary

**Files:**
- Create: `docs/plans/2026-04-02-aquasim-v2-phase-1b-COMPLETE.md`

**Step 1: Write the summary**

```markdown
# Phase 1b Complete — Real Values for the 10 Existing Units

**Completed:** YYYY-MM-DD
**Branch:** v2-proposal-generator
**Commits:** ~11 (see `git log main..HEAD`)

## What shipped
- Each of the 10 existing unit models now emits real v2 outputs with citations:
  - **Influent, Effluent, Splitter, Mixer** — calculation records (utility units, no sizing/BoQ)
  - **Primary Clarifier** — SOR-based sizing + civil + scraper BoQ + records
  - **Secondary Clarifier** — SOR + SLR checks + civil + scraper BoQ + records
  - **Thickener** — SLR-based sizing + civil + picket fence drive BoQ + records (added `surface_area`, `depth` params)
  - **Bioreactor Anaerobic** — HRT + volume + civil + submersible mixer BoQ + mixing energy + records
  - **Bioreactor Anoxic** — HRT + denitrification capacity `Dp1` + civil + mixer BoQ + mixing energy + records
  - **Bioreactor Aerobic** — HRT + MLSS check + O2 demand records + civil + fine-bubble diffuser BoQ (blower sized separately in Phase 2)
- Supplier prices inlined as `const` blocks with citations (3 kinds of source: CH-ISE internal estimate, typical SA supplier quote, specific datasheet)
- ~74 passing tests (61 from Phase 1a + ~13 new)
- Web build clean

## Deferred (not this phase)
- Aeration blower as a standalone unit → Phase 2
- Plant-wide Marais-Ekama sizing pre-calculation → later
- Extract inline supplier prices to `packages/design-library` → Phase 3

## Next: Phase 2
Add the 9 new unit types for a complete biological plant:
screens, grit, equalisation tank, MBR, aeration blower, dewatering,
chemical dosing, UV disinfection, inlet pumping.

Draft plan: `docs/plans/YYYY-MM-DD-aquasim-v2-phase-2-new-units.md`
```

**Step 2: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add docs/plans/2026-04-02-aquasim-v2-phase-1b-COMPLETE.md && \
git commit -m "Phase 1b complete — real values on 10 existing units"
```

**Step 3: Do NOT merge to main.** Keep the `v2-proposal-generator` branch long-lived for Phase 2.

---

## Summary of commits expected for Phase 1b

| # | Task | Commit message |
|---|---|---|
| 0 | Baseline verify | (no commit) |
| 1 | Test helper | `Add calculation-record test helpers for Phase 1b` |
| 2 | Influent | `Influent: add design-basis calculation records` |
| 3 | Effluent | `Effluent: add effluent-summary calculation records` |
| 4 | Splitter | `Splitter: add split-ratio calculation records` |
| 5 | Mixer | `Mixer: add flow-weighted mix calculation records` |
| 6 | Primary Clarifier | `PrimaryClarifier: add sizing, BoQ, and calculation records` |
| 7 | Secondary Clarifier | `SecondaryClarifier: add sizing with SOR/SLR checks, BoQ, and records` |
| 8 | Thickener | `Thickener: add surface_area param, sizing, BoQ, and records` |
| 9 | Bioreactor Anaerobic | `BioreactorAnaerobic: add sizing, mixing energy, BoQ, records` |
| 10 | Bioreactor Anoxic | `BioreactorAnoxic: add sizing, energy, BoQ, denitrification capacity record` |
| 11 | Bioreactor Aerobic | `BioreactorAerobic: add sizing, O2 demand records, civil + diffuser BoQ` |
| 12 | Integration test | `Add full-train integration test: v2 real values end-to-end` |
| 14 | Phase summary | `Phase 1b complete — real values on 10 existing units` |

Total: ~13 commits on top of Phase 1a, ~74 passing tests, clean build, branch ready for Phase 2.

---

## Rules of thumb used in this phase (for the reviewer)

These are the engineering heuristics encoded in the Phase 1b calculations. All come from published literature and are cited in the calculation records themselves — they're documented here for quick review.

| Parameter | Value | Source |
|---|---|---|
| Primary clarifier SOR (ADWF) | ≤ 40 m³/m²·d | WRC TT-16/84 |
| Secondary clarifier SOR (peak) | ≤ 1 m/h | WRC TT-16/84 |
| Secondary clarifier SLR (peak) | ≤ 6 kg/m²·h | WRC TT-16/84 |
| Gravity thickener SLR | ≤ 40 kg/m²·d | Metcalf & Eddy Ch. 14 |
| Anaerobic HRT (BPR) | 1–2 h | Ekama (1984) |
| Anoxic HRT | 1–3 h | Ekama (1984) |
| Aerobic MLSS range | 2,000–6,000 mg/L | Ekama (1984) |
| Anoxic K2 (20°C) | 0.1 mgN/mgVSS·d | Ekama (1984) Table 4.2 |
| O2 demand — carbonaceous | sCOD_rem − 1.42 × biomass | Ekama (1984) eq 4.22 |
| O2 demand — nitrification | 4.57 × NH3_oxidised | Ekama (1984) eq 4.21 |
| Mixing power (anaerobic/anoxic) | ~5 W/m³ | Metcalf & Eddy Ch. 5 |
| Submersible mixer rule | 1 × 3 kW per 500 m³ | CH-ISE rule of thumb |
| Fine bubble diffuser density | ~1 per 3 m³ of reactor | CH-ISE rule of thumb |

## Inline supplier prices used in this phase (ZAR, 2026)

| Item | Price | Source |
|---|---|---|
| Civil concrete reinforced tank | R18,000/m³ | CH-ISE internal estimate 2026 |
| Primary clarifier scraper bridge | R280,000 | Typical SA supplier quote 2025 |
| Secondary clarifier scraper/suction bridge | R320,000 | Typical SA supplier quote 2025 |
| Picket fence thickener drive | R180,000 | Typical SA supplier quote 2025 |
| Submersible mixer (~3 kW) | R45,000 | Typical SA supplier quote 2025 |
| 9" EDI FlexAir fine bubble diffuser | R850 | EDI FlexAir catalogue 2024 |

**These are inline constants for Phase 1b.** Phase 3 extracts them into `packages/design-library/supplier-prices.ts` as a formal reference library with dated quote PDFs and versioned updates.
