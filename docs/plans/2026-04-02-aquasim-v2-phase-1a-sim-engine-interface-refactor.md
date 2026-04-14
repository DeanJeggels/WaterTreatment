# AquaSim v2 — Phase 1a: Sim-Engine Interface Refactor

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Extend `ProcessResult` with optional `sizing`, `energy`, `consumables`, `capex`, `calculationRecords`, and `warnings` fields so that every unit model can emit defensible engineering data alongside the existing water-quality streams. All 10 existing units are updated to populate these fields with empty-but-valid defaults. All 41 existing tests continue to pass unchanged. New tests verify the shape of the extended outputs.

**Architecture:** Non-breaking extension of the existing class-based `ProcessUnit` interface. New fields are added as **optional** properties on `ProcessResult`, then filled in on every existing unit with empty-but-valid defaults (zero kW, empty BoQ, no calculation records). No changes to the graph simulator, topological sort, or any call-site that reads `outputs` or `metadata`. This phase is pure plumbing — it establishes the v2 contract without yet populating it with real sizing/energy/capex math.

**Tech Stack:** TypeScript 5, Vitest 3, pnpm workspaces, Turborepo. The `packages/sim-engine` package is a pure TS library with no runtime dependencies.

---

## Context & References

- **Design doc:** `docs/plans/2026-04-02-aquasim-v2-proposal-generator-design.md` (committed as `c8c9376`)
- **Existing types:** `packages/sim-engine/src/types.ts` defines `WaterQuality`, `ProcessResult`, `ProcessUnit`, etc.
- **Existing units:** `packages/sim-engine/src/units/{influent,effluent,primary-clarifier,secondary-clarifier,bioreactor-aerobic,bioreactor-anoxic,bioreactor-anaerobic,splitter,mixer,thickener}.ts`
- **Existing tests:** `packages/sim-engine/tests/{units.test.ts,simulator.test.ts}` — 41 tests total
- **Test runner:** `cd packages/sim-engine && npx vitest run`
- **Build check:** `cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web` (must still pass)

## Success Criteria (for this phase)

1. `packages/sim-engine/src/types.ts` exports new types: `Dimension`, `CalculationRecord`, `BoQLineItem`, `ConsumableItem`, `UnitOutputs`, `PlantContext`
2. `ProcessResult` has optional `sizing`, `energy`, `consumables`, `capex`, `calculationRecords`, `warnings` fields
3. All 10 existing unit models populate all 6 new fields with empty-but-valid defaults
4. `packages/sim-engine/tests/units.test.ts` contains a new section with tests verifying the shape of the extended outputs for each unit
5. All 41 original tests continue to pass without modification
6. Total test count: **41 original + 10 new shape tests = 51 passing**
7. Web build still succeeds without modification

## Non-Goals (deferred to Phase 1b)

- Real sizing values (reactor volume, clarifier area, etc.) — units emit `{}` for `sizing`
- Real energy values — units emit `installedKW: 0, dailyKWh: 0`
- Real capex/BoQ line items — units emit `{lineItems: [], total: 0}`
- Real calculation records with equations and citations — units emit `[]`
- Graph simulator changes — simulator passes the extended `ProcessResult` through unchanged
- Any UI changes

---

## Tasks

### Task 0: Setup and baseline verification

**Files:** none (verification only)

**Step 1: Confirm current git state is clean**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && git status
```

Expected: `On branch main`, `nothing to commit, working tree clean` (or only untracked files unrelated to sim-engine).

**Step 2: Create and checkout feature branch**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && git checkout -b v2-proposal-generator
```

Expected: `Switched to a new branch 'v2-proposal-generator'`

**Step 3: Run baseline sim-engine tests**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```

Expected: `Test Files 2 passed (2)`, `Tests 41 passed (41)`. If anything other than 41 passing, stop and investigate.

**Step 4: Run baseline web build**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```

Expected: clean build, 12 routes. Record the output so we can diff against it at the end.

---

### Task 1: Add `Dimension` type

**Files:**
- Create: `packages/sim-engine/src/types/dimension.ts`
- Modify: `packages/sim-engine/src/types.ts` (re-export)

**Step 1: Create the new types directory**

Run:
```bash
mkdir -p /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine/src/types
```

**Step 2: Write the `Dimension` type**

Create `packages/sim-engine/src/types/dimension.ts`:
```typescript
/** A physical dimension: a numeric value with a unit string */
export interface Dimension {
  value: number;
  unit: string;
}
```

**Step 3: Re-export from `types.ts`**

Add to the top of `packages/sim-engine/src/types.ts`:
```typescript
export type { Dimension } from './types/dimension';
```

**Step 4: Run TypeScript compilation via test runner**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```

Expected: Still 41 tests passing. If anything fails, stop and fix the type import.

**Step 5: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/src/types/dimension.ts packages/sim-engine/src/types.ts && \
git commit -m "Add Dimension type for sim-engine v2"
```

---

### Task 2: Add `CalculationRecord` type with shape validator

**Files:**
- Create: `packages/sim-engine/src/types/calculation-record.ts`
- Create: `packages/sim-engine/tests/calculation-record.test.ts`
- Modify: `packages/sim-engine/src/types.ts`

**Step 1: Write the failing test**

Create `packages/sim-engine/tests/calculation-record.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { isValidCalculationRecord } from '../src/types/calculation-record';

describe('CalculationRecord', () => {
  it('accepts a fully-populated valid record', () => {
    const record = {
      label: 'Aerobic volume',
      symbol: 'Va',
      equation: 'Va = Vt × (1 − fxt)',
      inputs: {
        Vt: { value: 250, unit: 'm3', source: 'total reactor volume' },
        fxt: { value: 0.25, unit: '', source: 'selected anoxic fraction' },
      },
      result: { value: 187.5, unit: 'm3' },
      citation: 'Ekama (1984) WRC TT-16/84, eq 4.12',
    };
    expect(isValidCalculationRecord(record)).toBe(true);
  });

  it('rejects a record missing the equation', () => {
    const record = {
      label: 'X',
      symbol: 'x',
      inputs: {},
      result: { value: 0, unit: '' },
      citation: 'nowhere',
    };
    expect(isValidCalculationRecord(record)).toBe(false);
  });

  it('rejects a record missing the citation', () => {
    const record = {
      label: 'X',
      symbol: 'x',
      equation: 'x = 0',
      inputs: {},
      result: { value: 0, unit: '' },
    };
    expect(isValidCalculationRecord(record)).toBe(false);
  });
});
```

**Step 2: Run the test to verify it fails**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run tests/calculation-record.test.ts
```

Expected: FAIL — `Cannot find module '../src/types/calculation-record'` or similar.

**Step 3: Write the minimal implementation**

Create `packages/sim-engine/src/types/calculation-record.ts`:
```typescript
/**
 * A single auditable engineering calculation. Every derived number in a
 * proposal should be rendered from one of these so it can be traced back
 * to an equation, inputs, and a cited reference.
 */
export interface CalculationRecord {
  /** Human-readable name, e.g. "Aerobic volume" */
  label: string;
  /** Mathematical symbol, e.g. "Va" */
  symbol: string;
  /** Equation in rendered form, e.g. "Va = Vt × (1 − fxt)" */
  equation: string;
  /** Named inputs to the equation, each with value, unit, and source */
  inputs: Record<string, { value: number; unit: string; source: string }>;
  /** The computed result */
  result: { value: number; unit: string };
  /** Bibliographic citation, e.g. "Ekama (1984) WRC TT-16/84, eq 4.12" */
  citation: string;
}

/** Runtime shape check — useful in tests and validation layers */
export function isValidCalculationRecord(r: unknown): r is CalculationRecord {
  if (typeof r !== 'object' || r === null) return false;
  const rec = r as Record<string, unknown>;
  return (
    typeof rec.label === 'string' &&
    typeof rec.symbol === 'string' &&
    typeof rec.equation === 'string' &&
    typeof rec.inputs === 'object' && rec.inputs !== null &&
    typeof rec.result === 'object' && rec.result !== null &&
    typeof (rec.result as { value: unknown }).value === 'number' &&
    typeof (rec.result as { unit: unknown }).unit === 'string' &&
    typeof rec.citation === 'string'
  );
}
```

**Step 4: Add re-export in `types.ts`**

Add to `packages/sim-engine/src/types.ts` (near the top, after the `Dimension` re-export):
```typescript
export type { CalculationRecord } from './types/calculation-record';
export { isValidCalculationRecord } from './types/calculation-record';
```

**Step 5: Run the test to verify it passes**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run tests/calculation-record.test.ts
```

Expected: 3 tests passing.

**Step 6: Run full test suite to confirm nothing regressed**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```

Expected: 44 passing (41 original + 3 new).

**Step 7: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/src/types/calculation-record.ts \
        packages/sim-engine/tests/calculation-record.test.ts \
        packages/sim-engine/src/types.ts && \
git commit -m "Add CalculationRecord type with runtime validator"
```

---

### Task 3: Add `BoQLineItem` type

**Files:**
- Create: `packages/sim-engine/src/types/boq-line-item.ts`
- Create: `packages/sim-engine/tests/boq-line-item.test.ts`
- Modify: `packages/sim-engine/src/types.ts`

**Step 1: Write the failing test**

Create `packages/sim-engine/tests/boq-line-item.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { isValidBoQLineItem, BOQ_CATEGORIES } from '../src/types/boq-line-item';

describe('BoQLineItem', () => {
  it('exports the 5 valid categories', () => {
    expect(BOQ_CATEGORIES).toEqual([
      'civil', 'mechanical', 'electrical', 'chemicals', 'instrumentation',
    ]);
  });

  it('accepts a valid line item', () => {
    const item = {
      category: 'mechanical',
      description: 'Fine screen 3mm ROTAMAT Ro5',
      quantity: 1,
      unit: 'ea',
      unitPriceZar: 450000,
      sourceCitation: 'Huber ROTAMAT quote 2025',
    };
    expect(isValidBoQLineItem(item)).toBe(true);
  });

  it('rejects an item with an unknown category', () => {
    const item = {
      category: 'plumbing',
      description: 'x',
      quantity: 1,
      unit: 'ea',
      unitPriceZar: 100,
      sourceCitation: 'x',
    };
    expect(isValidBoQLineItem(item)).toBe(false);
  });

  it('rejects an item missing a source citation', () => {
    const item = {
      category: 'mechanical',
      description: 'x',
      quantity: 1,
      unit: 'ea',
      unitPriceZar: 100,
    };
    expect(isValidBoQLineItem(item)).toBe(false);
  });
});
```

**Step 2: Run the test to verify it fails**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run tests/boq-line-item.test.ts
```

Expected: FAIL — module not found.

**Step 3: Write the implementation**

Create `packages/sim-engine/src/types/boq-line-item.ts`:
```typescript
export const BOQ_CATEGORIES = [
  'civil',
  'mechanical',
  'electrical',
  'chemicals',
  'instrumentation',
] as const;

export type BoQCategory = typeof BOQ_CATEGORIES[number];

/** A single line in a Bill of Quantities — one priced item */
export interface BoQLineItem {
  category: BoQCategory;
  description: string;
  quantity: number;
  unit: string;               // 'm3', 'ea', 'kW', 'L/month'
  unitPriceZar: number;
  /** Bibliographic/supplier citation for the unit price */
  sourceCitation: string;
  /** If the engineer overrode a seeded price, the reason */
  overrideReason?: string;
}

export function isValidBoQLineItem(item: unknown): item is BoQLineItem {
  if (typeof item !== 'object' || item === null) return false;
  const i = item as Record<string, unknown>;
  return (
    BOQ_CATEGORIES.includes(i.category as BoQCategory) &&
    typeof i.description === 'string' &&
    typeof i.quantity === 'number' &&
    typeof i.unit === 'string' &&
    typeof i.unitPriceZar === 'number' &&
    typeof i.sourceCitation === 'string'
  );
}
```

**Step 4: Re-export from `types.ts`**

Add to `packages/sim-engine/src/types.ts`:
```typescript
export type { BoQLineItem, BoQCategory } from './types/boq-line-item';
export { BOQ_CATEGORIES, isValidBoQLineItem } from './types/boq-line-item';
```

**Step 5: Run the tests**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```

Expected: 48 tests passing (44 + 4 new).

**Step 6: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/src/types/boq-line-item.ts \
        packages/sim-engine/tests/boq-line-item.test.ts \
        packages/sim-engine/src/types.ts && \
git commit -m "Add BoQLineItem type with category enum"
```

---

### Task 4: Add `ConsumableItem` type

**Files:**
- Create: `packages/sim-engine/src/types/consumable-item.ts`
- Modify: `packages/sim-engine/src/types.ts`

**Step 1: Write the type**

Create `packages/sim-engine/src/types/consumable-item.ts`:
```typescript
/** A daily consumable (chemical, media, etc.) used by a unit */
export interface ConsumableItem {
  /** e.g. "Polymer (cationic)" or "Alum (50%)" */
  item: string;
  /** Daily consumption rate */
  daily: number;
  /** Unit of consumption, e.g. "L/day" | "kg/day" | "ea/month" */
  unit: string;
  /** Bibliographic/supplier citation for the dosing assumption */
  citation: string;
}
```

**Step 2: Re-export**

Add to `packages/sim-engine/src/types.ts`:
```typescript
export type { ConsumableItem } from './types/consumable-item';
```

**Step 3: Run tests**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```

Expected: 48 passing (no new tests yet; this type is a data interface only).

**Step 4: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/src/types/consumable-item.ts packages/sim-engine/src/types.ts && \
git commit -m "Add ConsumableItem type"
```

---

### Task 5: Add `PlantContext` type

**Files:**
- Create: `packages/sim-engine/src/types/plant-context.ts`
- Modify: `packages/sim-engine/src/types.ts`

**Step 1: Write the type**

Create `packages/sim-engine/src/types/plant-context.ts`:
```typescript
/**
 * Plant-level environmental and design context, shared across all units.
 * Populated once per simulation run and passed to every unit's process() call.
 */
export interface PlantContext {
  /** Ambient temperature range at the site, °C */
  ambientTemperature: { min: number; max: number };
  /** Site elevation above sea level, m — used for aeration pressure correction */
  siteElevation: number;
  /** Which DWA discharge standard the effluent must meet */
  dischargeStandard: 'General' | 'Special';
  /** Design flows, m³/d */
  designFlows: { adwf: number; awwf: number; pwwf: number };
}

/** A minimal valid PlantContext for tests and defaults */
export function defaultPlantContext(): PlantContext {
  return {
    ambientTemperature: { min: 15, max: 25 },
    siteElevation: 1700,                    // Johannesburg default
    dischargeStandard: 'General',
    designFlows: { adwf: 1000, awwf: 1100, pwwf: 2750 },
  };
}
```

**Step 2: Re-export**

Add to `packages/sim-engine/src/types.ts`:
```typescript
export type { PlantContext } from './types/plant-context';
export { defaultPlantContext } from './types/plant-context';
```

**Step 3: Run tests**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```

Expected: 48 passing.

**Step 4: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/src/types/plant-context.ts packages/sim-engine/src/types.ts && \
git commit -m "Add PlantContext type with default factory"
```

---

### Task 6: Add `UnitOutputs` type and `emptyUnitOutputs()` factory

**Files:**
- Create: `packages/sim-engine/src/types/unit-outputs.ts`
- Create: `packages/sim-engine/tests/unit-outputs.test.ts`
- Modify: `packages/sim-engine/src/types.ts`

**Step 1: Write the failing test**

Create `packages/sim-engine/tests/unit-outputs.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { emptyUnitOutputs } from '../src/types/unit-outputs';

describe('emptyUnitOutputs', () => {
  it('returns an object with all 6 extended fields populated with empty defaults', () => {
    const o = emptyUnitOutputs();
    expect(o.sizing).toEqual({});
    expect(o.energy.installedKW).toBe(0);
    expect(o.energy.dailyKWh).toBe(0);
    expect(o.energy.records).toEqual([]);
    expect(o.consumables).toEqual([]);
    expect(o.capex.lineItems).toEqual([]);
    expect(o.capex.total).toBe(0);
    expect(o.calculationRecords).toEqual([]);
    expect(o.warnings).toEqual([]);
  });

  it('returns a fresh object each call (no shared references)', () => {
    const a = emptyUnitOutputs();
    const b = emptyUnitOutputs();
    a.warnings.push('test');
    expect(b.warnings).toEqual([]);
  });
});
```

**Step 2: Run to verify fail**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run tests/unit-outputs.test.ts
```

Expected: FAIL — module not found.

**Step 3: Write the implementation**

Create `packages/sim-engine/src/types/unit-outputs.ts`:
```typescript
import type { Dimension } from './dimension';
import type { CalculationRecord } from './calculation-record';
import type { BoQLineItem } from './boq-line-item';
import type { ConsumableItem } from './consumable-item';

/**
 * The extended engineering outputs of a unit — sizing, energy, consumables,
 * BoQ line items, and the full calculation trail. Attached to ProcessResult
 * via optional fields, so existing code that reads only `outputs` and
 * `metadata` continues to work unchanged.
 */
export interface UnitOutputs {
  /** Physical dimensions derived during sizing, e.g. { volume: {value:250, unit:'m3'} } */
  sizing: Record<string, Dimension>;
  /** Energy demand summary + calculation records */
  energy: {
    installedKW: number;
    dailyKWh: number;
    records: CalculationRecord[];
  };
  /** Consumables (chemicals, media) — daily rates */
  consumables: ConsumableItem[];
  /** Bill of Quantities contribution from this unit */
  capex: {
    lineItems: BoQLineItem[];
    total: number;
  };
  /** All auditable sizing/derivation equations for this unit */
  calculationRecords: CalculationRecord[];
  /** Warnings flagged during calculation (rule-of-thumb violations, etc.) */
  warnings: string[];
}

/** Factory for an empty-but-valid UnitOutputs (used by all v1 units during migration) */
export function emptyUnitOutputs(): UnitOutputs {
  return {
    sizing: {},
    energy: { installedKW: 0, dailyKWh: 0, records: [] },
    consumables: [],
    capex: { lineItems: [], total: 0 },
    calculationRecords: [],
    warnings: [],
  };
}
```

**Step 4: Re-export**

Add to `packages/sim-engine/src/types.ts`:
```typescript
export type { UnitOutputs } from './types/unit-outputs';
export { emptyUnitOutputs } from './types/unit-outputs';
```

**Step 5: Run the new test**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run tests/unit-outputs.test.ts
```

Expected: 2 passing.

**Step 6: Run the full suite**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```

Expected: 50 passing (48 + 2 new).

**Step 7: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/src/types/unit-outputs.ts \
        packages/sim-engine/tests/unit-outputs.test.ts \
        packages/sim-engine/src/types.ts && \
git commit -m "Add UnitOutputs type and emptyUnitOutputs factory"
```

---

### Task 7: Extend `ProcessResult` with optional v2 fields

**Files:**
- Modify: `packages/sim-engine/src/types.ts` (lines 19-23 currently define `ProcessResult`)

**Step 1: Locate the current `ProcessResult` definition**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
grep -n "ProcessResult" packages/sim-engine/src/types.ts
```

Expected: `ProcessResult` is an interface around line 20.

**Step 2: Update the `ProcessResult` interface to include the extended fields as optional**

Replace the existing `ProcessResult` definition with:
```typescript
/**
 * Result from processing a unit — the existing `outputs` and `metadata`
 * fields are kept for backward compatibility. The new optional fields
 * (sizing, energy, consumables, capex, calculationRecords, warnings)
 * are the v2 extension — populated with empty defaults by all existing
 * units during Phase 1a, with real values to follow in Phase 1b.
 */
export interface ProcessResult {
  outputs: Record<string, WaterQuality>;
  metadata: Record<string, number>;
  /** v2 — sizing dimensions */
  sizing?: Record<string, Dimension>;
  /** v2 — energy demand */
  energy?: {
    installedKW: number;
    dailyKWh: number;
    records: CalculationRecord[];
  };
  /** v2 — daily consumables */
  consumables?: ConsumableItem[];
  /** v2 — Bill of Quantities contribution */
  capex?: {
    lineItems: BoQLineItem[];
    total: number;
  };
  /** v2 — full auditable calculation trail */
  calculationRecords?: CalculationRecord[];
  /** v2 — warnings raised during calculation */
  warnings?: string[];
}
```

Also add imports at the top of `types.ts` (they may need to come *before* the `ProcessResult` definition):
```typescript
import type { Dimension } from './types/dimension';
import type { CalculationRecord } from './types/calculation-record';
import type { BoQLineItem } from './types/boq-line-item';
import type { ConsumableItem } from './types/consumable-item';
```

**Step 3: Run the full test suite to confirm no regressions**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```

Expected: 50 passing. The 41 original tests must still pass because all new fields are optional and no existing code reads them.

**Step 4: Run the web build to confirm downstream consumers are unaffected**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```

Expected: Clean build, 12 routes. If TypeScript errors in `apps/web`, investigate whether `ProcessResult` is consumed there.

**Step 5: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/src/types.ts && \
git commit -m "Extend ProcessResult with optional v2 fields (non-breaking)"
```

---

### Task 8: Update `src/index.ts` to re-export new types

**Files:**
- Modify: `packages/sim-engine/src/index.ts`

**Step 1: Read the current `index.ts`**

Current content (lines 1-14) exports from `./types`:
```typescript
export type {
  WaterQuality, ProcessResult, ProcessUnit, HandleDef, UnitDefinition,
  ParameterField, UnitType, DischargeStandards, SimulationResults,
} from './types';
export { emptyWaterQuality, mixStreams } from './types';
```

**Step 2: Add the new v2 type exports**

Replace the type export block with:
```typescript
// v1 types (existing)
export type {
  WaterQuality, ProcessResult, ProcessUnit, HandleDef, UnitDefinition,
  ParameterField, UnitType, DischargeStandards, SimulationResults,
} from './types';
export { emptyWaterQuality, mixStreams } from './types';

// v2 types (new for proposal generator)
export type {
  Dimension,
  CalculationRecord,
  BoQLineItem,
  BoQCategory,
  ConsumableItem,
  UnitOutputs,
  PlantContext,
} from './types';
export {
  isValidCalculationRecord,
  BOQ_CATEGORIES,
  isValidBoQLineItem,
  emptyUnitOutputs,
  defaultPlantContext,
} from './types';
```

**Step 3: Run tests**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```

Expected: 50 passing.

**Step 4: Run web build**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```

Expected: Clean build, 12 routes.

**Step 5: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/src/index.ts && \
git commit -m "Export v2 types from sim-engine index"
```

---

### Task 9: Create test helper `assertValidV2Outputs`

**Files:**
- Create: `packages/sim-engine/tests/helpers/v2-outputs.ts`

**Step 1: Write the helper**

Create `packages/sim-engine/tests/helpers/v2-outputs.ts`:
```typescript
import { expect } from 'vitest';
import type { ProcessResult } from '../../src/types';

/**
 * Assert that a ProcessResult has the 6 v2 extension fields populated
 * (with empty-but-valid defaults during Phase 1a). This is the shape
 * contract that every existing unit must satisfy after the refactor.
 */
export function assertValidV2Outputs(result: ProcessResult): void {
  expect(result.sizing).toBeDefined();
  expect(typeof result.sizing).toBe('object');

  expect(result.energy).toBeDefined();
  expect(result.energy!.installedKW).toBeTypeOf('number');
  expect(result.energy!.dailyKWh).toBeTypeOf('number');
  expect(Array.isArray(result.energy!.records)).toBe(true);

  expect(Array.isArray(result.consumables)).toBe(true);

  expect(result.capex).toBeDefined();
  expect(Array.isArray(result.capex!.lineItems)).toBe(true);
  expect(result.capex!.total).toBeTypeOf('number');

  expect(Array.isArray(result.calculationRecords)).toBe(true);
  expect(Array.isArray(result.warnings)).toBe(true);
}
```

**Step 2: Run tests (no new tests yet, just confirming nothing broken)**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```

Expected: 50 passing.

**Step 3: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/tests/helpers/v2-outputs.ts && \
git commit -m "Add assertValidV2Outputs test helper"
```

---

### Tasks 10–19: Update each of the 10 existing unit models to emit v2 defaults

Each of the next 10 tasks follows the same pattern for one unit. The pattern:

1. Write a new test in `units.test.ts` that asserts the unit's `process()` result passes `assertValidV2Outputs`
2. Run the new test — it should fail because the existing unit doesn't emit v2 fields
3. Update the unit's `process()` method to spread `emptyUnitOutputs()` into the returned `ProcessResult`
4. Run the test — it should pass
5. Confirm the full suite still passes (no regression)
6. Commit

Units are updated in order of simplicity:
- Task 10: Influent
- Task 11: Effluent
- Task 12: Splitter
- Task 13: Mixer
- Task 14: Primary Clarifier
- Task 15: Thickener
- Task 16: Secondary Clarifier
- Task 17: Bioreactor Anaerobic
- Task 18: Bioreactor Anoxic
- Task 19: Bioreactor Aerobic

---

### Task 10: Update `Influent` to emit v2 defaults

**Files:**
- Modify: `packages/sim-engine/src/units/influent.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

**Step 1: Locate existing Influent tests**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
grep -n "Influent" packages/sim-engine/tests/units.test.ts
```

**Step 2: Add a new v2 shape test near the existing Influent tests**

At the bottom of the Influent `describe` block in `packages/sim-engine/tests/units.test.ts`, add:
```typescript
import { assertValidV2Outputs } from './helpers/v2-outputs';

// ... inside describe('Influent', () => {
  it('emits v2 extended outputs (empty defaults in Phase 1a)', () => {
    const unit = new Influent({ flow: 1000, COD: 500, TSS: 250 });
    const result = unit.process([]);
    assertValidV2Outputs(result);
  });
```

(The import goes at the top of the file, alongside existing imports, not inside the describe.)

**Step 3: Run the new test — expect it to fail**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && \
npx vitest run -t "emits v2 extended outputs"
```

Expected: FAIL — `result.sizing` is undefined because Influent doesn't emit it yet.

**Step 4: Update `Influent.process()` to return v2 defaults**

In `packages/sim-engine/src/units/influent.ts`, change the return statement at the bottom of `process()`:

From:
```typescript
return {
  outputs: { out: output },
  metadata: {},
};
```

To:
```typescript
return {
  outputs: { out: output },
  metadata: {},
  ...emptyUnitOutputs(),
};
```

And add the import at the top of the file:
```typescript
import { emptyUnitOutputs } from '../types';
```

**Step 5: Run the Influent tests — they should all pass**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && \
npx vitest run -t Influent
```

Expected: All Influent tests passing, including the new v2 shape test.

**Step 6: Run the full suite to confirm no regressions**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```

Expected: 51 passing (50 + 1 new Influent shape test).

**Step 7: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/src/units/influent.ts packages/sim-engine/tests/units.test.ts && \
git commit -m "Influent: emit v2 empty outputs"
```

---

### Task 11: Update `Effluent` to emit v2 defaults

**Files:**
- Modify: `packages/sim-engine/src/units/effluent.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

Follow the exact same pattern as Task 10:

**Step 1: Add a new v2 shape test in the `Effluent` describe block:**
```typescript
it('emits v2 extended outputs (empty defaults in Phase 1a)', () => {
  const unit = new Effluent({});
  const input = { ...emptyWaterQuality(), flow: 500, COD: 50 };
  const result = unit.process([input]);
  assertValidV2Outputs(result);
});
```

(Ensure `emptyWaterQuality` is imported from `../src/types` at the top of `units.test.ts` if not already.)

**Step 2: Run — expect fail.**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && \
npx vitest run -t "Effluent.*v2 extended"
```

Expected: FAIL.

**Step 3: Update `Effluent.process()` to spread `emptyUnitOutputs()` into the returned result** (same pattern as Influent — add the import and spread into the return).

**Step 4: Run — expect pass.**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && \
npx vitest run -t Effluent
```

Expected: All Effluent tests passing.

**Step 5: Run the full suite**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```

Expected: 52 passing.

**Step 6: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/src/units/effluent.ts packages/sim-engine/tests/units.test.ts && \
git commit -m "Effluent: emit v2 empty outputs"
```

---

### Task 12: Update `Splitter` — same pattern

**Files:** `packages/sim-engine/src/units/splitter.ts`, `packages/sim-engine/tests/units.test.ts`

1. Add v2 shape test in `describe('Splitter', ...)`:
   ```typescript
   it('emits v2 extended outputs (empty defaults in Phase 1a)', () => {
     const unit = new Splitter({ split_ratio: 0.5 });
     const input = { ...emptyWaterQuality(), flow: 1000 };
     const result = unit.process([input]);
     assertValidV2Outputs(result);
   });
   ```
2. Run — fail.
3. Update `Splitter.process()` to spread `emptyUnitOutputs()` in the return. Import `emptyUnitOutputs` from `../types`.
4. Run — pass.
5. Run full suite — 53 passing.
6. Commit: `git commit -m "Splitter: emit v2 empty outputs"`

---

### Task 13: Update `Mixer` — same pattern

**Files:** `packages/sim-engine/src/units/mixer.ts`, `packages/sim-engine/tests/units.test.ts`

1. Add v2 shape test in `describe('Mixer', ...)`:
   ```typescript
   it('emits v2 extended outputs (empty defaults in Phase 1a)', () => {
     const unit = new Mixer({});
     const a = { ...emptyWaterQuality(), flow: 500, COD: 400 };
     const b = { ...emptyWaterQuality(), flow: 500, COD: 200 };
     const result = unit.process([a, b]);
     assertValidV2Outputs(result);
   });
   ```
2. Run — fail.
3. Update `Mixer.process()` to spread `emptyUnitOutputs()`.
4. Run — pass.
5. Full suite: 54 passing.
6. Commit: `git commit -m "Mixer: emit v2 empty outputs"`

---

### Task 14: Update `PrimaryClarifier` — same pattern

**Files:** `packages/sim-engine/src/units/primary-clarifier.ts`, `packages/sim-engine/tests/units.test.ts`

1. Add v2 shape test in `describe('PrimaryClarifier', ...)`:
   ```typescript
   it('emits v2 extended outputs (empty defaults in Phase 1a)', () => {
     const unit = new PrimaryClarifier({ removal_efficiency_TSS: 0.6 });
     const input = { ...emptyWaterQuality(), flow: 1000, TSS: 300 };
     const result = unit.process([input]);
     assertValidV2Outputs(result);
   });
   ```
2. Run — fail.
3. Update `PrimaryClarifier.process()` to spread `emptyUnitOutputs()`.
4. Run — pass.
5. Full suite: 55 passing.
6. Commit: `git commit -m "PrimaryClarifier: emit v2 empty outputs"`

---

### Task 15: Update `Thickener` — same pattern

**Files:** `packages/sim-engine/src/units/thickener.ts`, `packages/sim-engine/tests/units.test.ts`

1. Add v2 shape test in `describe('Thickener', ...)`:
   ```typescript
   it('emits v2 extended outputs (empty defaults in Phase 1a)', () => {
     const unit = new Thickener({});
     const input = { ...emptyWaterQuality(), flow: 100, TSS: 10000 };
     const result = unit.process([input]);
     assertValidV2Outputs(result);
   });
   ```
2. Run — fail.
3. Update `Thickener.process()` to spread `emptyUnitOutputs()`.
4. Run — pass.
5. Full suite: 56 passing.
6. Commit: `git commit -m "Thickener: emit v2 empty outputs"`

---

### Task 16: Update `SecondaryClarifier` — same pattern

**Files:** `packages/sim-engine/src/units/secondary-clarifier.ts`, `packages/sim-engine/tests/units.test.ts`

1. Add v2 shape test.
2. Run — fail.
3. Update `.process()`.
4. Run — pass.
5. Full suite: 57 passing.
6. Commit: `git commit -m "SecondaryClarifier: emit v2 empty outputs"`

---

### Task 17: Update `BioreactorAnaerobic` — same pattern

**Files:** `packages/sim-engine/src/units/bioreactor-anaerobic.ts`, `packages/sim-engine/tests/units.test.ts`

1. Add v2 shape test.
2. Run — fail.
3. Update `.process()`.
4. Run — pass.
5. Full suite: 58 passing.
6. Commit: `git commit -m "BioreactorAnaerobic: emit v2 empty outputs"`

---

### Task 18: Update `BioreactorAnoxic` — same pattern

**Files:** `packages/sim-engine/src/units/bioreactor-anoxic.ts`, `packages/sim-engine/tests/units.test.ts`

1. Add v2 shape test.
2. Run — fail.
3. Update `.process()`.
4. Run — pass.
5. Full suite: 59 passing.
6. Commit: `git commit -m "BioreactorAnoxic: emit v2 empty outputs"`

---

### Task 19: Update `BioreactorAerobic` — same pattern

**Files:** `packages/sim-engine/src/units/bioreactor-aerobic.ts`, `packages/sim-engine/tests/units.test.ts`

1. Add v2 shape test.
2. Run — fail.
3. Update `.process()`.
4. Run — pass.
5. Full suite: 60 passing.
6. Commit: `git commit -m "BioreactorAerobic: emit v2 empty outputs"`

---

### Task 20: Full-train integration test for v2 outputs

**Files:**
- Modify: `packages/sim-engine/tests/simulator.test.ts`

**Step 1: Add an integration test that runs a full MLE train and asserts every node's result passes `assertValidV2Outputs`**

In `packages/sim-engine/tests/simulator.test.ts`, add a new `describe` block (or extend an existing one):
```typescript
import { assertValidV2Outputs } from './helpers/v2-outputs';

describe('v2 outputs — full train', () => {
  it('every node in a simulated MLE train emits v2 outputs', () => {
    // Reuse the existing MLE train fixture from the file — or build a minimal one:
    //   Influent → BioreactorAnoxic → BioreactorAerobic → SecondaryClarifier → Effluent
    //   with a recycle edge from SecondaryClarifier.underflow → BioreactorAnoxic
    // After simulate(), every node's nodeResults[nodeId] should pass the shape check.
    const results = simulate(mleGraph);   // existing helper or fixture
    for (const [nodeId, nodeResult] of Object.entries(results.nodeResults)) {
      // nodeResult is the ProcessResult shape; assertValidV2Outputs takes ProcessResult.
      assertValidV2Outputs(nodeResult as any);
    }
  });
});
```

If there's no existing `mleGraph` fixture, reuse the one from the closest existing integration test in `simulator.test.ts`.

**Step 2: Run — expect pass (because all 10 units now emit v2 defaults)**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && \
npx vitest run -t "v2 outputs"
```

Expected: PASS.

**Step 3: Run the full suite**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```

Expected: **61 passing**.

**Step 4: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/tests/simulator.test.ts && \
git commit -m "Add integration test: full MLE train emits v2 outputs"
```

---

### Task 21: Final verification — tests, build, type check

**Files:** none (verification only)

**Step 1: Run full sim-engine test suite**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```

Expected: **61 passing (41 original + 20 new)**. If any number is wrong, stop and investigate.

**Step 2: Run sim-engine type check**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx tsc --noEmit
```

Expected: Zero errors.

**Step 3: Run the web app build**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```

Expected: Clean build, 12 routes, zero TypeScript errors. `apps/web` consumes `sim-engine` exports — this verifies the extension didn't break anything downstream.

**Step 4: Review the branch diff**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && git log main..v2-proposal-generator --oneline
```

Expected: ~20 commits (one per task), each with a clear message.

---

### Task 22: Write phase summary and commit

**Files:**
- Create: `docs/plans/2026-04-02-aquasim-v2-phase-1a-COMPLETE.md`

**Step 1: Write a short completion summary**

Create `docs/plans/2026-04-02-aquasim-v2-phase-1a-COMPLETE.md`:
```markdown
# Phase 1a Complete — Sim-Engine Interface Refactor

**Completed:** YYYY-MM-DD
**Branch:** v2-proposal-generator
**Commits:** ~20 (see `git log main..v2-proposal-generator`)

## What shipped
- 6 new types (`Dimension`, `CalculationRecord`, `BoQLineItem`, `ConsumableItem`, `UnitOutputs`, `PlantContext`)
- 3 helper functions (`isValidCalculationRecord`, `isValidBoQLineItem`, `emptyUnitOutputs`, `defaultPlantContext`)
- Extended `ProcessResult` with 6 optional v2 fields (non-breaking)
- All 10 existing unit models emit v2 empty defaults
- 61 passing tests (41 original + 20 new)
- Web build clean

## Next: Phase 1b
Fill in real sizing/energy/capex values for each of the 10 existing units.
Draft plan: `docs/plans/YYYY-MM-DD-aquasim-v2-phase-1b-existing-unit-depth.md`
```

**Step 2: Commit the summary**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add docs/plans/2026-04-02-aquasim-v2-phase-1a-COMPLETE.md && \
git commit -m "Phase 1a complete — sim-engine v2 interface ready"
```

**Step 3: Do NOT merge to main yet.** Phase 1a is a foundation on top of which 1b, 2, 3… are built. The `v2-proposal-generator` branch stays long-lived until the full rebuild is ready or you decide to merge incrementally.

---

## Summary of commits expected for Phase 1a

| # | Task | Commit message |
|---|---|---|
| 0 | Setup | (no commit — branch only) |
| 1 | Dimension | `Add Dimension type for sim-engine v2` |
| 2 | CalculationRecord | `Add CalculationRecord type with runtime validator` |
| 3 | BoQLineItem | `Add BoQLineItem type with category enum` |
| 4 | ConsumableItem | `Add ConsumableItem type` |
| 5 | PlantContext | `Add PlantContext type with default factory` |
| 6 | UnitOutputs | `Add UnitOutputs type and emptyUnitOutputs factory` |
| 7 | Extend ProcessResult | `Extend ProcessResult with optional v2 fields (non-breaking)` |
| 8 | Update index exports | `Export v2 types from sim-engine index` |
| 9 | Test helper | `Add assertValidV2Outputs test helper` |
| 10 | Influent | `Influent: emit v2 empty outputs` |
| 11 | Effluent | `Effluent: emit v2 empty outputs` |
| 12 | Splitter | `Splitter: emit v2 empty outputs` |
| 13 | Mixer | `Mixer: emit v2 empty outputs` |
| 14 | PrimaryClarifier | `PrimaryClarifier: emit v2 empty outputs` |
| 15 | Thickener | `Thickener: emit v2 empty outputs` |
| 16 | SecondaryClarifier | `SecondaryClarifier: emit v2 empty outputs` |
| 17 | BioreactorAnaerobic | `BioreactorAnaerobic: emit v2 empty outputs` |
| 18 | BioreactorAnoxic | `BioreactorAnoxic: emit v2 empty outputs` |
| 19 | BioreactorAerobic | `BioreactorAerobic: emit v2 empty outputs` |
| 20 | Integration test | `Add integration test: full MLE train emits v2 outputs` |
| 22 | Phase summary | `Phase 1a complete — sim-engine v2 interface ready` |

Expected total: ~20 commits, ~61 passing tests, clean build, branch `v2-proposal-generator` ready for Phase 1b.

---

## Follow-up phases (not this plan)

Each phase gets its own plan document, written and committed at the start of that phase:

| Phase | Deliverable | Draft plan file |
|---|---|---|
| **1b** | Fill real sizing/energy/capex on existing 10 units | `2026-04-??-aquasim-v2-phase-1b-existing-unit-depth.md` |
| **2** | Add 9 new unit models (screens, grit, EQ, MBR, blower, dewatering, dosing, UV, inlet pumping) | `2026-04-??-aquasim-v2-phase-2-new-units.md` |
| **3** | BoQ engine + `design-library` package with supplier prices | `2026-04-??-aquasim-v2-phase-3-boq-engine.md` |
| **4** | Supabase migrations (`boq_line_items`, `project_proposals`, ALTERs) | `2026-04-??-aquasim-v2-phase-4-schema-migrations.md` |
| **5** | UI design system overhaul (ui-ux-pro-max) | `2026-04-??-aquasim-v2-phase-5-ui-system.md` |
| **6** | Inspector redesign with inline calculation records | `2026-04-??-aquasim-v2-phase-6-inspector.md` |
| **7** | Proposal view + PDF generation (browser print) | `2026-04-??-aquasim-v2-phase-7-proposal-view.md` |
| **8** | Landing page positioning rewrite | `2026-04-??-aquasim-v2-phase-8-landing-page.md` |
| **9** | Merge to main + deploy | `2026-04-??-aquasim-v2-phase-9-cutover.md` |
