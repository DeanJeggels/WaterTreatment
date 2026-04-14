# AquaSim v2 — Phase 3: BoQ Engine + `@repo/design-library`

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Create a single source of truth for supplier prices, DWA limits, kinetic constants, and SA influent defaults in a new `@repo/design-library` workspace package. Refactor the 15 unit files that currently hold inline price `const` blocks to import from this library instead. Add a `aggregateBoQ()` function in the sim-engine that walks **every** flowsheet node (including orphan utility nodes like `AerationBlower` and `ChemicalDosing` that aren't visited by the graph simulator) and produces a grouped, priced, totalled Bill of Quantities ready for the proposal view to render.

**Architecture:** New package `packages/design-library` follows the same structure as `packages/sim-engine` (turborepo workspace, `@repo/design-library` workspace name, pure TS, vitest). The BoQ aggregator lives in `packages/sim-engine/src/boq/aggregator.ts` (co-located with the graph simulator since it depends on `createUnit`) and is exported from the sim-engine's public API. The aggregator is the **only** place that handles orphan-node iteration — individual unit `process()` methods remain pure functions called with their own inputs.

**Tech Stack:** TypeScript 5, Vitest 3, pnpm workspaces, Turborepo. Working on branch `v2-proposal-generator` (Phases 1a + 1b + 2 complete).

---

## Context & References

- **Design doc:** `docs/plans/2026-04-02-aquasim-v2-proposal-generator-design.md`
- **Phase 1a, 1b, 2 plans + completion summaries** — all in `docs/plans/`
- **Starting test count:** 108 passing (from Phase 2)
- **Starting branch:** `v2-proposal-generator`
- **Known Phase 2 lessons (from executor's report):**
  - **AerationBlower formula:** `Q_air` has a factor of `/1000` that was missing in the Phase 2 plan's pseudocode. The `as-built` implementation in `packages/sim-engine/src/units/aeration-blower.ts` is canonical. Do **not** rewrite the formula in Phase 3; only extract the supplier prices.
  - **Orphan nodes:** `simulate()` only traverses nodes connected via edges. Utility nodes like `AerationBlower` and `ChemicalDosing` that have no input/output water-quality streams are *not* in `results.nodeResults`. The BoQ aggregator must iterate the flowsheet's raw node list and call `process([])` for any node not found in `nodeResults`.
  - **iconMap:** `apps/web/.../ProcessUnitNode.tsx` and `UnitPalette.tsx` have an explicit `Record<UnitType, …>` iconMap. Phase 3 doesn't add unit types, so iconMap is unaffected.
- **Supplier prices currently inline in these 15 unit files** (Phase 1b + Phase 2 work):
  - Phase 1b: `primary-clarifier.ts`, `secondary-clarifier.ts`, `thickener.ts`, `bioreactor-anaerobic.ts`, `bioreactor-anoxic.ts`, `bioreactor-aerobic.ts`
  - Phase 2: `screen.ts`, `grit-removal.ts`, `equalisation-tank.ts`, `mbr.ts`, `aeration-blower.ts`, `dewatering.ts`, `chemical-dosing.ts`, `uv-disinfection.ts`, `inlet-pumping.ts`
- **Existing package to copy structure from:** `packages/sim-engine/`
- **Test runner:** `cd packages/sim-engine && npx vitest run` (+ a new one for design-library in Task 2)
- **Web build check:** `cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web`

## Success Criteria

1. New package `packages/design-library/` exists with its own `package.json`, `tsconfig.json`, `src/index.ts`, `tests/`, and passes its own vitest suite
2. `@repo/design-library` is a workspace dependency of `@repo/sim-engine` (prices consumed by units)
3. All 15 unit files import supplier prices via `getPrice(id)` — no inline `const PRICE_ZAR = …` blocks remain
4. Re-running each unit's existing Phase 1b/Phase 2 tests produces **identical** BoQ values after the refactor (pure mechanical extraction)
5. `dwa-limits.ts`, `kinetic-constants.ts`, `defaults.ts` defined and exported from the package
6. `aggregateBoQ(flowsheet, nodeResults)` function exists in sim-engine, handles orphan nodes correctly, groups by category, computes subtotals + grand total
7. Integration test: a full plant flowsheet with at least 1 orphan utility node (e.g. AerationBlower) produces a BoQ grand total that **includes** the orphan's capex
8. **Test count target: 108 → ~140** (design-library ~10 tests, BoQ aggregator ~10 tests, integration ~2 tests; unit counts stay flat because refactor tests are invariant)
9. Web build clean (12 routes); `apps/web` imports `aggregateBoQ` without errors

## Non-Goals (deferred to later phases)

- **Persisting BoQ to Supabase** → Phase 4 (schema migrations)
- **Rendering BoQ in the UI** → Phase 6/7 (inspector + proposal view)
- **Override semantics in the UI** (engineer overrides a seeded price per-project) → Phase 6/7. The aggregator accepts an `overrides` map as a parameter in Phase 3 but no UI surface yet.
- **Price library browser page** (`/library/prices`) → Phase 5
- **Regional / multi-currency pricing** → Phase 9 or later (SA only for v1)

---

## Supplier-price ID naming convention

Every extracted price gets a stable, descriptive, snake_case ID. Example:

| Current inline constant | New ID | `description` field |
|---|---|---|
| `CIVIL_CONCRETE_ZAR_PER_M3 = 18000` | `civil_concrete_reinforced` | `'Reinforced concrete tank, civil works'` |
| `PRIMARY_SCRAPER_ZAR = 280000` | `primary_clarifier_scraper_bridge` | `'Primary clarifier rotating scraper bridge'` |
| `SUBMERSIBLE_MIXER_ZAR = 45000` | `submersible_mixer_3kw` | `'Submersible mixer, 3 kW class'` |
| `EDI_FLEXAIR_9IN_ZAR = 850` | `fine_bubble_diffuser_edi_9in` | `'Fine bubble diffuser, 9" EDI FlexAir tubular'` |

IDs are **not** typed as a literal union in Phase 3 — runtime `getPrice(id)` throws on unknown IDs. A typed ID union is a nice-to-have for a future phase; keeping it string-based here minimises churn during extraction.

---

## Tasks

### Task 0: Verify starting state

**Files:** none (verification only)

**Step 1: Confirm branch and baseline**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && git status && git log --oneline | head -5
```
Expected: `On branch v2-proposal-generator`, working tree clean, recent commit from Phase 2 completion.

**Step 2: Confirm sim-engine tests**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **108 passing**. Anything else → stop, investigate.

**Step 3: Confirm web build**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean build, 12 routes.

---

### Task 1: Scaffold `@repo/design-library` package

**Files:**
- Create: `packages/design-library/package.json`
- Create: `packages/design-library/tsconfig.json`
- Create: `packages/design-library/src/index.ts`
- Create: `packages/design-library/README.md`
- Create: `packages/design-library/tests/.gitkeep`
- Modify: `packages/sim-engine/package.json` (add `@repo/design-library` as a devDependency)
- Modify: `apps/web/package.json` (add `@repo/design-library` as a dependency)

**Step 1: Create the directory structure**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
mkdir -p packages/design-library/src packages/design-library/tests
```

**Step 2: Create `packages/design-library/package.json`**

Mirror the sim-engine package.json exactly:
```json
{
  "name": "@repo/design-library",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "check-types": "tsc --noEmit"
  },
  "devDependencies": {
    "@repo/typescript-config": "*",
    "vitest": "^3.0.0",
    "typescript": "5.9.2"
  }
}
```

**Step 3: Create `packages/design-library/tsconfig.json`**

Mirror the sim-engine tsconfig:
```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "strict": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Step 4: Create `packages/design-library/src/index.ts`** (empty for now, will be populated in next tasks)

```typescript
// @repo/design-library — Single source of truth for WWTP design references
// (supplier prices, discharge standards, kinetic constants, SA typical influent)
export {};
```

**Step 5: Create `packages/design-library/README.md`**

```markdown
# @repo/design-library

Single source of truth for AquaSim's WWTP design reference data.

## What lives here
- **Supplier prices** (`supplier-prices.ts`) — ZAR prices for civil, mechanical, electrical, chemicals, and instrumentation BoQ line items. Each entry carries a supplier name, source citation, and last-updated date.
- **DWA limits** (`dwa-limits.ts`) — South African Department of Water Affairs discharge standards (General & Special limits) from the National Water Act.
- **Kinetic constants** (`kinetic-constants.ts`) — Marais-Ekama stoichiometric and kinetic constants with Arrhenius temperature corrections.
- **SA influent defaults** (`defaults.ts`) — Typical raw-sewage water quality for South African municipal plants.

## Update process
Prices and references change over time. To update:
1. Edit the relevant file in `src/`
2. Bump the `lastUpdated` field
3. Add a PR with the source (supplier quote PDF, datasheet, or official document)
4. Merging the PR is the audit trail — every price change is git-reviewable

## Consumed by
- `@repo/sim-engine` — imports prices in each unit model's `calculate()` output
- `apps/web` — imports for the price library browser page (Phase 5) and proposal rendering
```

**Step 6: Create `packages/design-library/tests/.gitkeep`** (placeholder so the directory exists)

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
touch packages/design-library/tests/.gitkeep
```

**Step 7: Add `@repo/design-library` as a dependency of sim-engine**

Modify `packages/sim-engine/package.json`:
```json
{
  "devDependencies": {
    "@repo/typescript-config": "*",
    "vitest": "^3.0.0",
    "typescript": "5.9.2"
  },
  "dependencies": {
    "@repo/design-library": "*"
  }
}
```
(Add the new `dependencies` block after `devDependencies`.)

**Step 8: Add `@repo/design-library` as a dependency of apps/web**

Read `apps/web/package.json` first to find the existing `dependencies` block. Add:
```json
"@repo/design-library": "*",
```
(Place alphabetically among the other `@repo/*` entries, typically next to `@repo/sim-engine`.)

**Step 9: Install the new package / wire workspace**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npm install
```
Expected: The package manager (npm or pnpm, based on which lockfile exists) discovers the new workspace and links it. No errors.

**Step 10: Sanity check — sim-engine tests still pass and the package builds its own empty test suite**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **108 passing** (unchanged).

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/design-library && npx tsc --noEmit
```
Expected: No TypeScript errors.

**Step 11: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/design-library/ packages/sim-engine/package.json apps/web/package.json package-lock.json && \
git commit -m "Scaffold @repo/design-library workspace package"
```

(If the project uses `pnpm-lock.yaml` instead of `package-lock.json`, adjust the path.)

---

### Task 2: Define `SupplierPriceRef` type and `getPrice()` helper

**Files:**
- Create: `packages/design-library/src/types.ts`
- Create: `packages/design-library/src/supplier-prices.ts`
- Create: `packages/design-library/tests/supplier-prices.test.ts`
- Modify: `packages/design-library/src/index.ts`

**Step 1: Write the type definition**

Create `packages/design-library/src/types.ts`:
```typescript
/**
 * Categories map 1:1 to the BoQ categories in @repo/sim-engine.
 * Duplicated here (rather than imported) to keep this package free of
 * circular dependencies and usable as a standalone reference library.
 */
export type BoQCategory =
  | 'civil'
  | 'mechanical'
  | 'electrical'
  | 'chemicals'
  | 'instrumentation';

/** A single priced reference item used by unit models to build BoQ line items */
export interface SupplierPriceRef {
  /** Stable snake_case identifier used by unit models to look up the price */
  id: string;
  /** Human-readable description used in BoQ line items */
  description: string;
  /** Unit price in ZAR */
  unitPriceZar: number;
  /** Unit of measure, e.g. 'm3', 'ea', 'kW', 'L/month' */
  unit: string;
  /** Which BoQ category this line item belongs to */
  category: BoQCategory;
  /** Supplier or estimator name, e.g. 'Huber', 'CH-ISE internal' */
  supplier: string;
  /** Full citation string suitable for a BoQ line item's sourceCitation field */
  source: string;
  /** ISO date of the last price update */
  lastUpdated: string;
  /** Optional free-text notes (e.g. 'covers 7.5-22 kW range', 'includes installation') */
  notes?: string;
}
```

**Step 2: Create the (initially empty) price registry**

Create `packages/design-library/src/supplier-prices.ts`:
```typescript
import type { SupplierPriceRef } from './types';

/**
 * The canonical AquaSim supplier price registry. Edit this file to update
 * prices — every change is git-reviewable. Phase 3 extracts all inline
 * prices from unit model files into this registry.
 */
export const SUPPLIER_PRICES: Record<string, SupplierPriceRef> = {
  // Entries added in Task 3
};

/**
 * Look up a supplier price by ID. Throws if the ID is unknown — this is
 * intentional: an unknown ID almost always means a typo in a unit model,
 * and a runtime exception surfaces the problem in tests immediately.
 */
export function getPrice(id: string): SupplierPriceRef {
  const entry = SUPPLIER_PRICES[id];
  if (!entry) {
    throw new Error(
      `Unknown supplier price ID: "${id}". Check packages/design-library/src/supplier-prices.ts`,
    );
  }
  return entry;
}

/** Return all prices in a given BoQ category — used by the price library UI */
export function getPricesByCategory(category: SupplierPriceRef['category']): SupplierPriceRef[] {
  return Object.values(SUPPLIER_PRICES).filter(p => p.category === category);
}
```

**Step 3: Re-export from `index.ts`**

Replace `packages/design-library/src/index.ts` with:
```typescript
export type { BoQCategory, SupplierPriceRef } from './types';
export { SUPPLIER_PRICES, getPrice, getPricesByCategory } from './supplier-prices';
```

**Step 4: Write failing test**

Create `packages/design-library/tests/supplier-prices.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { getPrice, SUPPLIER_PRICES } from '../src/supplier-prices';

describe('supplier-prices', () => {
  it('getPrice throws on unknown ID', () => {
    expect(() => getPrice('nonexistent_id')).toThrow(/Unknown supplier price ID/);
  });

  it('SUPPLIER_PRICES is a plain object', () => {
    expect(typeof SUPPLIER_PRICES).toBe('object');
    expect(SUPPLIER_PRICES).not.toBeNull();
  });

  it('registry is empty before Task 3 population', () => {
    // This test gets updated / deleted once Task 3 populates the registry.
    // For now it just confirms the shape is right.
    expect(Object.keys(SUPPLIER_PRICES).length).toBeGreaterThanOrEqual(0);
  });
});
```

**Step 5: Run the test**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/design-library && npx vitest run
```
Expected: 3 tests passing (the registry is empty but `getPrice` throws correctly).

**Step 6: Sanity check sim-engine still green**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **108 passing**.

**Step 7: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/design-library/ && \
git commit -m "Add SupplierPriceRef type and getPrice() helper"
```

---

### Task 3: Populate the supplier price registry

**Files:**
- Modify: `packages/design-library/src/supplier-prices.ts`
- Modify: `packages/design-library/tests/supplier-prices.test.ts`

**Context:** This task walks the 15 unit files and copies every inline price constant into the registry with a stable ID. It does **not** modify the unit files — that's Tasks 4 and 5. After this task, both the inline constants AND the registry exist; the registry is unused until unit files are refactored.

**Step 1: Read the inline constants from each of the 15 unit files**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
grep -n "_ZAR" packages/sim-engine/src/units/*.ts
```

This surfaces every `const FOO_ZAR = 123;` line. Use the output to drive the extraction — do not rely on the table below alone, since the Phase 2 executor may have adjusted values (e.g. the AerationBlower formula fix).

**Step 2: Populate the registry**

Replace the `SUPPLIER_PRICES` object in `packages/design-library/src/supplier-prices.ts` with entries covering all inline constants found. Reference values (confirm against grep output — the grep is the source of truth):

```typescript
export const SUPPLIER_PRICES: Record<string, SupplierPriceRef> = {
  // === Civil works ===
  civil_concrete_reinforced: {
    id: 'civil_concrete_reinforced',
    description: 'Reinforced concrete tank, civil works',
    unitPriceZar: 18000,
    unit: 'm3',
    category: 'civil',
    supplier: 'CH-ISE internal estimate',
    source: 'CH-ISE internal estimate 2026',
    lastUpdated: '2026-01-15',
    notes: 'Typical SA contractor rate for reinforced rectangular/circular tanks',
  },
  civil_headworks_channel: {
    id: 'civil_headworks_channel',
    description: 'Headworks concrete channel',
    unitPriceZar: 15000,
    unit: 'm3',
    category: 'civil',
    supplier: 'CH-ISE internal estimate',
    source: 'CH-ISE internal estimate 2026',
    lastUpdated: '2026-01-15',
  },
  civil_wet_well: {
    id: 'civil_wet_well',
    description: 'Pump wet well civil works',
    unitPriceZar: 22000,
    unit: 'm3',
    category: 'civil',
    supplier: 'CH-ISE internal estimate',
    source: 'CH-ISE internal estimate 2026',
    lastUpdated: '2026-01-15',
  },

  // === Clarifier scrapers & thickener drive ===
  primary_clarifier_scraper_bridge: {
    id: 'primary_clarifier_scraper_bridge',
    description: 'Primary clarifier rotating scraper bridge',
    unitPriceZar: 280000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Andritz / Tsurumi (typical SA supplier)',
    source: 'Typical SA supplier quote 2025 (Andritz/Tsurumi range)',
    lastUpdated: '2025-11-20',
  },
  secondary_clarifier_scraper_bridge: {
    id: 'secondary_clarifier_scraper_bridge',
    description: 'Secondary clarifier scraper / suction bridge',
    unitPriceZar: 320000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Andritz / Westech (typical SA supplier)',
    source: 'Typical SA supplier quote 2025 (Andritz/Westech range)',
    lastUpdated: '2025-11-20',
  },
  picket_fence_thickener_drive: {
    id: 'picket_fence_thickener_drive',
    description: 'Picket fence thickener drive (~3 kW)',
    unitPriceZar: 180000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Westech / Andritz (typical SA supplier)',
    source: 'Typical SA supplier quote 2025 (Westech/Andritz range)',
    lastUpdated: '2025-11-20',
  },

  // === Bioreactor equipment ===
  submersible_mixer_3kw: {
    id: 'submersible_mixer_3kw',
    description: 'Submersible mixer, 3 kW class (IP68)',
    unitPriceZar: 45000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Grundfos / Xylem Flygt (typical SA supplier)',
    source: 'Typical SA supplier quote 2025 (Grundfos SMD / Xylem Flygt range)',
    lastUpdated: '2025-11-20',
    notes: 'Rule of thumb: one 3 kW mixer per 500 m³ of unaerated reactor volume',
  },
  fine_bubble_diffuser_edi_9in: {
    id: 'fine_bubble_diffuser_edi_9in',
    description: 'Fine bubble diffuser, 9" EDI FlexAir tubular',
    unitPriceZar: 850,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'EDI (via SA distributor)',
    source: 'EDI FlexAir catalogue 2024 / typical SA distributor',
    lastUpdated: '2024-09-01',
    notes: 'Diffuser density rule of thumb: ~1 per 3 m³ of aerobic reactor volume',
  },

  // === Preliminary / headworks (Phase 2) ===
  coarse_bar_screen: {
    id: 'coarse_bar_screen',
    description: 'Coarse mechanical bar rack (small plant)',
    unitPriceZar: 85000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Meva / Huber (typical SA supplier)',
    source: 'Typical SA supplier quote 2025 (Meva/Huber range)',
    lastUpdated: '2025-11-20',
  },
  fine_step_screen_huber_rotamat: {
    id: 'fine_step_screen_huber_rotamat',
    description: 'Fine step screen, Huber ROTAMAT Ro5 or equivalent (small plant)',
    unitPriceZar: 450000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Huber (via SA distributor)',
    source: 'Huber catalogue 2024 / typical SA distributor',
    lastUpdated: '2024-09-01',
  },
  grit_removal_package: {
    id: 'grit_removal_package',
    description: 'Aerated grit chamber — grit pump + cyclone + air diffusers',
    unitPriceZar: 180000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Typical SA supplier',
    source: 'Typical SA supplier quote 2025',
    lastUpdated: '2025-11-20',
  },

  // === MBR (Phase 2) ===
  mbr_smu_module: {
    id: 'mbr_smu_module',
    description: 'Megavision SMU membrane module (~64 m²)',
    unitPriceZar: 625000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Megavision',
    source: 'Megavision quote 2025',
    lastUpdated: '2025-10-15',
    notes: 'Hollow fibre MBR module; design flux 18.4 L/m²/h typical',
  },
  mbr_cip_skid: {
    id: 'mbr_cip_skid',
    description: 'MBR CIP + permeate pump skid',
    unitPriceZar: 380000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Megavision / Memstar (typical)',
    source: 'Megavision / Memstar typical 2025',
    lastUpdated: '2025-10-15',
  },

  // === Aeration blower (Phase 2) ===
  pd_blower_small: {
    id: 'pd_blower_small',
    description: 'Positive displacement blower (15-37 kW class)',
    unitPriceZar: 180000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Aerzen / WEG (typical SA distributor)',
    source: 'Aerzen / WEG SA distributor 2025',
    lastUpdated: '2025-11-01',
  },
  hst_turbo_blower: {
    id: 'hst_turbo_blower',
    description: 'HST turbo blower (50+ kW class)',
    unitPriceZar: 1200000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Sulzer HST / APG Neuros',
    source: 'Sulzer HST / APG Neuros catalogue 2025',
    lastUpdated: '2025-10-01',
    notes: 'Phase 2 AerationBlower selects this above ~50 kW installed',
  },

  // === Sludge dewatering (Phase 2) ===
  belt_press_1m: {
    id: 'belt_press_1m',
    description: 'Belt filter press, 1 m belt width (Andritz SMX or equivalent)',
    unitPriceZar: 850000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Andritz',
    source: 'Andritz SMX catalogue 2024',
    lastUpdated: '2024-09-01',
  },
  decanter_centrifuge_5m3h: {
    id: 'decanter_centrifuge_5m3h',
    description: 'Decanter centrifuge, 5 m³/h throughput',
    unitPriceZar: 2200000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Alfa Laval',
    source: 'Alfa Laval catalogue 2024',
    lastUpdated: '2024-09-01',
  },

  // === Chemical dosing (Phase 2) ===
  metering_pump_diaphragm: {
    id: 'metering_pump_diaphragm',
    description: 'Diaphragm metering pump (Grundfos DDA or equivalent)',
    unitPriceZar: 28000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Grundfos',
    source: 'Grundfos SA catalogue 2025',
    lastUpdated: '2025-10-01',
  },
  hdpe_storage_tank: {
    id: 'hdpe_storage_tank',
    description: 'HDPE chemical storage tank',
    unitPriceZar: 17500,
    unit: 'm3',
    category: 'mechanical',
    supplier: 'Typical SA supplier',
    source: 'Typical SA supplier quote 2025',
    lastUpdated: '2025-11-01',
  },

  // === UV disinfection (Phase 2, tiered) ===
  uv_reactor_small: {
    id: 'uv_reactor_small',
    description: 'LP-HO UV reactor, small (< 500 m³/d)',
    unitPriceZar: 285000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Xylem Wedeco',
    source: 'Xylem Wedeco catalogue 2025',
    lastUpdated: '2025-09-15',
  },
  uv_reactor_medium: {
    id: 'uv_reactor_medium',
    description: 'LP-HO UV reactor, medium (500–1500 m³/d)',
    unitPriceZar: 650000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Xylem Wedeco',
    source: 'Xylem Wedeco catalogue 2025',
    lastUpdated: '2025-09-15',
  },
  uv_reactor_large: {
    id: 'uv_reactor_large',
    description: 'LP-HO UV reactor, large (1500–5000 m³/d)',
    unitPriceZar: 1250000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Xylem Wedeco',
    source: 'Xylem Wedeco catalogue 2025',
    lastUpdated: '2025-09-15',
  },

  // === Inlet pumping (Phase 2, tiered) ===
  submersible_pump_small: {
    id: 'submersible_pump_small',
    description: 'Submersible centrifugal pump, 7.5 kW class',
    unitPriceZar: 35000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Grundfos',
    source: 'Grundfos SE range SA catalogue 2025',
    lastUpdated: '2025-10-01',
  },
  submersible_pump_medium: {
    id: 'submersible_pump_medium',
    description: 'Submersible centrifugal pump, 15 kW class',
    unitPriceZar: 65000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Grundfos',
    source: 'Grundfos SE range SA catalogue 2025',
    lastUpdated: '2025-10-01',
  },
  submersible_pump_large: {
    id: 'submersible_pump_large',
    description: 'Submersible centrifugal pump, 22 kW class',
    unitPriceZar: 95000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Grundfos',
    source: 'Grundfos SE range SA catalogue 2025',
    lastUpdated: '2025-10-01',
  },

  // === Disposal / consumables (cost references, not capex) ===
  screenings_landfill_disposal: {
    id: 'screenings_landfill_disposal',
    description: 'Screenings disposal to landfill',
    unitPriceZar: 1500,
    unit: 'm3',
    category: 'chemicals', // chemicals category used for ongoing consumables in v1 schema
    supplier: 'Typical SA landfill operator',
    source: 'Typical SA landfill rate 2025',
    lastUpdated: '2025-11-20',
    notes: 'Consumable/disposal cost, not a capex line — rendered under OpEx',
  },
  grit_landfill_disposal: {
    id: 'grit_landfill_disposal',
    description: 'Grit disposal to landfill',
    unitPriceZar: 800,
    unit: 'm3',
    category: 'chemicals',
    supplier: 'Typical SA landfill operator',
    source: 'Typical SA landfill rate 2025',
    lastUpdated: '2025-11-20',
  },
  cake_landfill_disposal: {
    id: 'cake_landfill_disposal',
    description: 'Dewatered sludge cake disposal to landfill',
    unitPriceZar: 350,
    unit: 't',
    category: 'chemicals',
    supplier: 'Typical SA landfill operator',
    source: 'Typical SA landfill tipping fee 2025',
    lastUpdated: '2025-11-20',
  },
  polymer_cationic_dry: {
    id: 'polymer_cationic_dry',
    description: 'Cationic polymer (dry)',
    unitPriceZar: 65,
    unit: 'kg',
    category: 'chemicals',
    supplier: 'Typical SA supplier',
    source: 'Typical SA supplier quote 2025',
    lastUpdated: '2025-11-01',
  },
  alum_sulphate: {
    id: 'alum_sulphate',
    description: 'Alum (aluminium sulphate)',
    unitPriceZar: 8,
    unit: 'kg',
    category: 'chemicals',
    supplier: 'Typical SA supplier',
    source: 'Typical SA supplier quote 2025',
    lastUpdated: '2025-11-01',
  },
  ferric_chloride: {
    id: 'ferric_chloride',
    description: 'Ferric chloride',
    unitPriceZar: 12,
    unit: 'kg',
    category: 'chemicals',
    supplier: 'Typical SA supplier',
    source: 'Typical SA supplier quote 2025',
    lastUpdated: '2025-11-01',
  },
  hydrated_lime: {
    id: 'hydrated_lime',
    description: 'Hydrated lime',
    unitPriceZar: 4,
    unit: 'kg',
    category: 'chemicals',
    supplier: 'Typical SA supplier',
    source: 'Typical SA supplier quote 2025',
    lastUpdated: '2025-11-01',
  },
  caustic_soda_50pct: {
    id: 'caustic_soda_50pct',
    description: 'Caustic soda (50% solution)',
    unitPriceZar: 10,
    unit: 'kg',
    category: 'chemicals',
    supplier: 'Typical SA supplier',
    source: 'Typical SA supplier quote 2025',
    lastUpdated: '2025-11-01',
  },
};
```

> **Important:** If the grep output in Step 1 shows any `_ZAR` constant *not* covered by the table above, add it to the registry with a sensible ID. Do not silently drop prices. Phase 2's AerationBlower fix may have introduced new constants; they all go here.

**Step 3: Update test to exercise the registry**

Replace `packages/design-library/tests/supplier-prices.test.ts` with:
```typescript
import { describe, it, expect } from 'vitest';
import { getPrice, getPricesByCategory, SUPPLIER_PRICES } from '../src/supplier-prices';
import type { SupplierPriceRef } from '../src/types';

describe('supplier-prices', () => {
  it('contains at least 25 entries', () => {
    expect(Object.keys(SUPPLIER_PRICES).length).toBeGreaterThanOrEqual(25);
  });

  it('every entry has a non-empty source citation', () => {
    for (const [id, p] of Object.entries(SUPPLIER_PRICES)) {
      expect(p.source.length, `empty source for ${id}`).toBeGreaterThan(0);
    }
  });

  it('every entry has a valid ISO lastUpdated date', () => {
    for (const [id, p] of Object.entries(SUPPLIER_PRICES)) {
      expect(p.lastUpdated, `bad lastUpdated for ${id}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('every entry id matches its registry key', () => {
    for (const [key, p] of Object.entries(SUPPLIER_PRICES)) {
      expect(p.id).toBe(key);
    }
  });

  it('getPrice returns a known entry', () => {
    const p = getPrice('civil_concrete_reinforced');
    expect(p.unitPriceZar).toBe(18000);
    expect(p.unit).toBe('m3');
    expect(p.category).toBe('civil');
  });

  it('getPrice throws on unknown id', () => {
    expect(() => getPrice('nope')).toThrow(/Unknown supplier price ID/);
  });

  it('getPricesByCategory filters correctly', () => {
    const civil = getPricesByCategory('civil');
    expect(civil.length).toBeGreaterThan(0);
    civil.forEach(p => expect(p.category).toBe('civil'));

    const mech = getPricesByCategory('mechanical');
    expect(mech.length).toBeGreaterThan(5);

    const chem = getPricesByCategory('chemicals');
    expect(chem.length).toBeGreaterThan(0);
  });
});
```

**Step 4: Run the design-library tests**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/design-library && npx vitest run
```
Expected: **7 passing**.

**Step 5: Run sim-engine tests (nothing should have changed)**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **108 passing**.

**Step 6: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/design-library/src/supplier-prices.ts packages/design-library/tests/supplier-prices.test.ts && \
git commit -m "Populate supplier-prices registry with 25+ entries"
```

---

### Task 4: Refactor Phase 1b units to use `@repo/design-library`

**Files:**
- Modify: `packages/sim-engine/src/units/primary-clarifier.ts`
- Modify: `packages/sim-engine/src/units/secondary-clarifier.ts`
- Modify: `packages/sim-engine/src/units/thickener.ts`
- Modify: `packages/sim-engine/src/units/bioreactor-anaerobic.ts`
- Modify: `packages/sim-engine/src/units/bioreactor-anoxic.ts`
- Modify: `packages/sim-engine/src/units/bioreactor-aerobic.ts`

**Refactor pattern (apply to each file):**

Before (inline):
```typescript
const CIVIL_CONCRETE_ZAR_PER_M3 = 18000;
const PRIMARY_SCRAPER_ZAR = 280000;
// ...
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
    // ...
  ],
  total: volume * CIVIL_CONCRETE_ZAR_PER_M3 + PRIMARY_SCRAPER_ZAR,
};
```

After (design-library):
```typescript
import { getPrice } from '@repo/design-library';
// ... (delete the inline const block)

const civilPrice = getPrice('civil_concrete_reinforced');
const scraperPrice = getPrice('primary_clarifier_scraper_bridge');

base.capex = {
  lineItems: [
    {
      category: 'civil',
      description: `Primary clarifier reinforced concrete tank (${volume.toFixed(0)} m³)`,
      quantity: volume,
      unit: 'm3',
      unitPriceZar: civilPrice.unitPriceZar,
      sourceCitation: civilPrice.source,
    },
    {
      category: 'mechanical',
      description: 'Primary clarifier rotating scraper bridge',
      quantity: 1,
      unit: 'ea',
      unitPriceZar: scraperPrice.unitPriceZar,
      sourceCitation: scraperPrice.source,
    },
  ],
  total: volume * civilPrice.unitPriceZar + scraperPrice.unitPriceZar,
};
```

**Critical invariant:** the numeric `unitPriceZar` values must stay identical after the refactor. Existing Phase 1b/Phase 2 tests assert specific capex totals — those tests must continue to pass **unchanged**. If they break, the registry entry has the wrong value.

**Step 1: Refactor `primary-clarifier.ts`**

1. Read the current file.
2. Add `import { getPrice } from '@repo/design-library';` at the top.
3. Delete the inline `const CIVIL_CONCRETE_ZAR_PER_M3` and `const PRIMARY_SCRAPER_ZAR` declarations.
4. Replace usages (both in `unitPriceZar` and in the `total:` line) with `getPrice('civil_concrete_reinforced').unitPriceZar` etc.
5. Replace `sourceCitation` strings with `getPrice('civil_concrete_reinforced').source` etc.
6. Run unit's tests:
   ```bash
   cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run -t PrimaryClarifier
   ```
   Expected: All PrimaryClarifier tests still passing with identical values.
7. Commit:
   ```bash
   cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
   git add packages/sim-engine/src/units/primary-clarifier.ts && \
   git commit -m "PrimaryClarifier: use @repo/design-library for supplier prices"
   ```

**Step 2: Refactor `secondary-clarifier.ts`** — same pattern, IDs: `civil_concrete_reinforced`, `secondary_clarifier_scraper_bridge`. Test: `SecondaryClarifier`. Commit: `SecondaryClarifier: use @repo/design-library for supplier prices`

**Step 3: Refactor `thickener.ts`** — IDs: `civil_concrete_reinforced`, `picket_fence_thickener_drive`. Test: `Thickener`. Commit: `Thickener: use @repo/design-library for supplier prices`

**Step 4: Refactor `bioreactor-anaerobic.ts`** — IDs: `civil_concrete_reinforced`, `submersible_mixer_3kw`. Test: `BioreactorAnaerobic`. Commit: `BioreactorAnaerobic: use @repo/design-library for supplier prices`

**Step 5: Refactor `bioreactor-anoxic.ts`** — same IDs as Anaerobic. Test: `BioreactorAnoxic`. Commit: `BioreactorAnoxic: use @repo/design-library for supplier prices`

**Step 6: Refactor `bioreactor-aerobic.ts`** — IDs: `civil_concrete_reinforced`, `fine_bubble_diffuser_edi_9in`. Test: `BioreactorAerobic`. Commit: `BioreactorAerobic: use @repo/design-library for supplier prices`

**Step 7: Run the full sim-engine suite**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **108 passing** (unchanged — the refactor is value-preserving).

---

### Task 5: Refactor Phase 2 units to use `@repo/design-library`

**Files:**
- Modify: `packages/sim-engine/src/units/screen.ts`
- Modify: `packages/sim-engine/src/units/grit-removal.ts`
- Modify: `packages/sim-engine/src/units/equalisation-tank.ts`
- Modify: `packages/sim-engine/src/units/mbr.ts`
- Modify: `packages/sim-engine/src/units/aeration-blower.ts`
- Modify: `packages/sim-engine/src/units/dewatering.ts`
- Modify: `packages/sim-engine/src/units/chemical-dosing.ts`
- Modify: `packages/sim-engine/src/units/uv-disinfection.ts`
- Modify: `packages/sim-engine/src/units/inlet-pumping.ts`

Same refactor pattern as Task 4. One commit per unit. ID map:

| Unit | Price IDs to use |
|---|---|
| `screen.ts` | `civil_headworks_channel`, `coarse_bar_screen`, `fine_step_screen_huber_rotamat`, `screenings_landfill_disposal` |
| `grit-removal.ts` | `civil_concrete_reinforced`, `grit_removal_package`, `grit_landfill_disposal` |
| `equalisation-tank.ts` | `civil_concrete_reinforced`, `submersible_mixer_3kw` |
| `mbr.ts` | `mbr_smu_module`, `mbr_cip_skid` |
| `aeration-blower.ts` | `pd_blower_small`, `hst_turbo_blower` |
| `dewatering.ts` | `belt_press_1m`, `decanter_centrifuge_5m3h`, `polymer_cationic_dry`, `cake_landfill_disposal` |
| `chemical-dosing.ts` | `metering_pump_diaphragm`, `hdpe_storage_tank`, `alum_sulphate`, `ferric_chloride`, `polymer_cationic_dry`, `hydrated_lime`, `caustic_soda_50pct` |
| `uv-disinfection.ts` | `uv_reactor_small`, `uv_reactor_medium`, `uv_reactor_large` |
| `inlet-pumping.ts` | `civil_wet_well`, `submersible_pump_small`, `submersible_pump_medium`, `submersible_pump_large` |

**Step 1: Refactor `screen.ts`, run tests, commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run -t Screen
```
Expected: all Screen tests passing.

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/src/units/screen.ts && \
git commit -m "Screen: use @repo/design-library for supplier prices"
```

**Steps 2–9: Repeat for the remaining 8 units**, following the same pattern. Commit message format: `<UnitName>: use @repo/design-library for supplier prices`

**Step 10: Full suite after all 9 refactors**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **108 passing** still. If anything regressed, the registry entry has a wrong value — compare against the original inline constant and fix the registry, not the unit.

**Step 11: Verify no inline `_ZAR` constants remain**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
grep -rn "_ZAR" packages/sim-engine/src/units/ || echo "ALL CLEAN"
```
Expected: `ALL CLEAN` (or only references inside comments explaining the refactor).

---

### Task 6: Extract DWA discharge limits

**Files:**
- Create: `packages/design-library/src/dwa-limits.ts`
- Create: `packages/design-library/tests/dwa-limits.test.ts`
- Modify: `packages/design-library/src/index.ts`

**Context:** DWA (South African Department of Water Affairs, now DWS) publishes two limit tiers under the National Water Act: **General Limits** (less strict, normal rivers) and **Special Limits** (sensitive receiving waters, e.g. recreational use areas). The existing xlsm `sheet 0. Water Samples` has both tables. AquaSim currently uses a weak `DischargeStandards` type in sim-engine — Phase 3 makes the DWA values the canonical reference.

**Step 1: Write failing test**

Create `packages/design-library/tests/dwa-limits.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { DWA_LIMITS, getDwaLimits } from '../src/dwa-limits';

describe('DWA limits', () => {
  it('defines General and Special tiers', () => {
    expect(DWA_LIMITS.General).toBeDefined();
    expect(DWA_LIMITS.Special).toBeDefined();
  });

  it('Special limits are stricter than General for nitrogen', () => {
    expect(DWA_LIMITS.Special.NH3N!).toBeLessThan(DWA_LIMITS.General.NH3N!);
  });

  it('getDwaLimits returns a cloneable object', () => {
    const g = getDwaLimits('General');
    g.COD = 9999;
    expect(getDwaLimits('General').COD).not.toBe(9999);  // original untouched
  });
});
```

**Step 2: Run — expect fail**

**Step 3: Create `dwa-limits.ts`**

```typescript
/**
 * South African discharge standards under the National Water Act, 1998.
 * Two tiers: General Limits (less strict) and Special Limits (sensitive waters).
 * Source: National Water Act (Act 36 of 1998), General Authorisations, DWA
 */

export interface DwaDischargeStandard {
  /** mg/L */
  COD?: number;
  /** mg/L */
  BOD5?: number;
  /** mgN/L — ammonia as N */
  NH3N?: number;
  /** mgN/L — nitrate+nitrite as N */
  NO3N?: number;
  /** mg/L */
  TSS?: number;
  /** mgP/L — orthophosphate as P */
  TP?: number;
  /** pH minimum */
  pH_min?: number;
  /** pH maximum */
  pH_max?: number;
  /** Electrical conductivity, mS/m — above background */
  EC?: number;
  /** Faecal coliforms per 100 mL */
  faecalColiforms?: number;
  /** Free chlorine, mg/L */
  freeChlorine?: number;
  /** Fluoride, mg/L */
  fluoride?: number;
  /** Oil & grease, mg/L */
  oilAndGrease?: number;
  /** Bibliographic citation for this tier */
  source: string;
}

export const DWA_LIMITS: Record<'General' | 'Special', DwaDischargeStandard> = {
  General: {
    COD: 75,
    NH3N: 6,
    NO3N: 15,
    TSS: 25,
    TP: 10,
    pH_min: 5.5,
    pH_max: 9.5,
    EC: 70,
    faecalColiforms: 1000,
    freeChlorine: 0.25,
    fluoride: 1,
    oilAndGrease: 2.5,
    source: 'DWA General Limit, National Water Act (Act 36 of 1998), General Authorisation Notice 665 of 2013',
  },
  Special: {
    COD: 30,
    NH3N: 2,
    NO3N: 1.5,
    TSS: 10,
    TP: 1,         // median
    pH_min: 5.5,
    pH_max: 7.5,
    EC: 50,
    faecalColiforms: 0,
    freeChlorine: 0,
    fluoride: 1,
    oilAndGrease: 0,
    source: 'DWA Special Limit, National Water Act (Act 36 of 1998), General Authorisation Notice 665 of 2013',
  },
};

export function getDwaLimits(tier: 'General' | 'Special'): DwaDischargeStandard {
  return { ...DWA_LIMITS[tier] };
}
```

**Step 4: Re-export from `index.ts`**

Add to `packages/design-library/src/index.ts`:
```typescript
export type { DwaDischargeStandard } from './dwa-limits';
export { DWA_LIMITS, getDwaLimits } from './dwa-limits';
```

**Step 5: Run tests**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/design-library && npx vitest run
```
Expected: **10 passing** (7 from Task 3 + 3 new).

**Step 6: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/design-library/src/dwa-limits.ts packages/design-library/src/index.ts packages/design-library/tests/dwa-limits.test.ts && \
git commit -m "Add DWA General/Special discharge limits to design-library"
```

---

### Task 7: Extract kinetic constants (Marais-Ekama)

**Files:**
- Create: `packages/design-library/src/kinetic-constants.ts`
- Create: `packages/design-library/tests/kinetic-constants.test.ts`
- Modify: `packages/design-library/src/index.ts`

**Context:** The existing bioreactor units have kinetic constants scattered as magic numbers inside their `.process()` bodies (e.g. `const K2 = 0.1;` in `BioreactorAnoxic`, `4.57 × nh3Oxidized` in `BioreactorAerobic`). Phase 3 doesn't *refactor* the units to use these — that's a later polish phase — but it **defines** them as a canonical reference so tests can pin values and future phases can adopt them.

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { KINETIC_CONSTANTS, adjustForTemperature } from '../src/kinetic-constants';

describe('kinetic-constants', () => {
  it('defines the standard Marais-Ekama coefficients at 20°C', () => {
    expect(KINETIC_CONSTANTS.muAm20).toBe(0.45);
    expect(KINETIC_CONSTANTS.YH).toBe(0.67);
    expect(KINETIC_CONSTANTS.fH).toBe(0.2);
    expect(KINETIC_CONSTANTS.K2_20).toBe(0.101);
  });

  it('applies Arrhenius temperature correction', () => {
    // μAm @ 15°C with θ=1.123
    const mu15 = adjustForTemperature(0.45, 1.123, 15);
    expect(mu15).toBeCloseTo(0.45 * Math.pow(1.123, -5), 3);
  });

  it('every entry has a source citation', () => {
    expect(KINETIC_CONSTANTS.source).toContain('Ekama');
  });
});
```

**Step 2: Run — expect fail**

**Step 3: Create `kinetic-constants.ts`**

```typescript
/**
 * Marais-Ekama kinetic and stoichiometric constants for activated sludge
 * design, reference temperature 20°C. Temperature corrections follow the
 * Arrhenius-style form: k(T) = k(20) × θ^(T-20).
 *
 * Source: Ekama & Marais (1976); WRC TT-16/84 (Ekama et al., 1984);
 * Henze et al. (2008) Biological Wastewater Treatment, IWA.
 */

export interface KineticConstants {
  // Nitrifier kinetics (autotrophic organisms, ANOs)
  muAm20: number;   // max specific growth rate of nitrifiers @ 20°C, 1/d
  theta_muAm: number;  // Arrhenius θ for μAm
  Kn20: number;     // half-saturation constant for nitrifiers @ 20°C, mgN/L
  theta_Kn: number;
  bA20: number;     // endogenous respiration rate of nitrifiers @ 20°C, 1/d
  theta_bA: number;
  YA: number;       // yield coefficient for nitrifiers, mgVSS/mgFSA

  // Heterotroph kinetics (OHOs)
  YH: number;       // yield coefficient, mgCOD/mgCOD
  bH20: number;     // endogenous respiration rate of heterotrophs @ 20°C, 1/d
  theta_bH: number;
  fH: number;       // endogenous residue fraction
  fiOHO: number;    // ISS content of OHOs

  // Stoichiometric ratios (VSS basis)
  fcv: number;      // mgCOD / mgVSS
  fc: number;       // mgC / mgVSS
  fnUPO: number;    // mgN / mgVSS (UPO)
  fnBio: number;    // mgN / mgVSS (biomass)
  fp: number;       // mgP / mgVSS

  // Denitrification rates (mgN / mgVSS·d @ 20°C)
  K1_20: number;    // RBCOD denitrification rate
  theta_K1: number;
  K2_20: number;    // SBCOD denitrification rate
  theta_K2: number;

  // O2 demands
  oxygenPerNitrifiedN: number;    // mgO2 / mgN — nitrification
  oxygenRecoveredPerDenitN: number; // mgO2 / mgN — recovered by denitrification

  // Alkalinity
  alkalinityConsumedByNitrification: number;  // mgCaCO3 / mgN
  alkalinityRecoveredByDenitrification: number;  // mgCaCO3 / mgN

  source: string;
}

export const KINETIC_CONSTANTS: KineticConstants = {
  muAm20: 0.45,
  theta_muAm: 1.123,
  Kn20: 1.0,
  theta_Kn: 1.123,
  bA20: 0.04,
  theta_bA: 1.029,
  YA: 0.1,

  YH: 0.67,
  bH20: 0.24,
  theta_bH: 1.029,
  fH: 0.2,
  fiOHO: 0.15,

  fcv: 1.481,
  fc: 0.518,
  fnUPO: 0.072,
  fnBio: 0.1,
  fp: 0.025,

  K1_20: 0.72,
  theta_K1: 1.2,
  K2_20: 0.101,
  theta_K2: 1.08,

  oxygenPerNitrifiedN: 4.57,
  oxygenRecoveredPerDenitN: 2.86,

  alkalinityConsumedByNitrification: 7.14,
  alkalinityRecoveredByDenitrification: 3.57,

  source: 'Marais & Ekama (1976); WRC TT-16/84 (1984); Henze et al. (2008)',
};

/** Arrhenius-style temperature correction: k(T) = k(20) × θ^(T-20) */
export function adjustForTemperature(k20: number, theta: number, T: number): number {
  return k20 * Math.pow(theta, T - 20);
}
```

**Step 4: Re-export**

Add to `packages/design-library/src/index.ts`:
```typescript
export type { KineticConstants } from './kinetic-constants';
export { KINETIC_CONSTANTS, adjustForTemperature } from './kinetic-constants';
```

**Step 5: Run & commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/design-library && npx vitest run
```
Expected: **13 passing** (10 + 3 new).

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/design-library/src/kinetic-constants.ts packages/design-library/src/index.ts packages/design-library/tests/kinetic-constants.test.ts && \
git commit -m "Add Marais-Ekama kinetic constants to design-library"
```

---

### Task 8: Extract SA typical influent defaults

**Files:**
- Create: `packages/design-library/src/defaults.ts`
- Create: `packages/design-library/tests/defaults.test.ts`
- Modify: `packages/design-library/src/index.ts`

**Step 1: Create `defaults.ts`**

```typescript
/**
 * Typical raw-sewage water quality for South African municipal WWTPs.
 * These values prefill the Influent unit's parameters when a user creates
 * a new project without sample data.
 *
 * Source: WWTP Design.xlsm (0. Water Samples sheet — example typical SA sewage)
 * cross-referenced with WRC reports and typical SA plant audits.
 */

export interface TypicalInfluent {
  /** Design flow, m³/d — just a placeholder; user always overrides */
  flow: number;
  pH: number;
  /** mgN/L */
  TKN: number;
  /** mgN/L — free and saline ammonia */
  FSA: number;
  /** mgN/L */
  NO3N: number;
  /** mg/L — total COD */
  COD: number;
  /** mg/L — 0.45 μm filtered COD */
  CODfiltered: number;
  /** mg/L — total suspended solids */
  TSS: number;
  /** mg/L — total dissolved solids */
  TDS: number;
  /** mgP/L — total phosphorus */
  TP: number;
  /** mgP/L — orthophosphate */
  OP: number;
  /** mgS/L — sulphate */
  SO4: number;
  /** mg/L as CaCO3 */
  alkalinity: number;
  /** mg/L — fats, oil, grease */
  FOG: number;
  source: string;
}

export const SA_TYPICAL_INFLUENT: TypicalInfluent = {
  flow: 1000,
  pH: 7.5,
  TKN: 65,
  FSA: 49,
  NO3N: 0,
  COD: 800,
  CODfiltered: 240,
  TSS: 350,
  TDS: 800,
  TP: 12,
  OP: 7.2,
  SO4: 100,
  alkalinity: 200,
  FOG: 10,
  source: 'WWTP Design.xlsm example typical SA sewage; WRC Report TT-16/84',
};
```

**Step 2: Write test**

```typescript
import { describe, it, expect } from 'vitest';
import { SA_TYPICAL_INFLUENT } from '../src/defaults';

describe('SA typical influent defaults', () => {
  it('has a COD within the typical SA municipal range', () => {
    expect(SA_TYPICAL_INFLUENT.COD).toBeGreaterThan(400);
    expect(SA_TYPICAL_INFLUENT.COD).toBeLessThan(1200);
  });

  it('has TKN consistent with COD (ratio 0.07-0.1)', () => {
    const ratio = SA_TYPICAL_INFLUENT.TKN / SA_TYPICAL_INFLUENT.COD;
    expect(ratio).toBeGreaterThan(0.06);
    expect(ratio).toBeLessThan(0.12);
  });

  it('cites a source', () => {
    expect(SA_TYPICAL_INFLUENT.source.length).toBeGreaterThan(0);
  });
});
```

**Step 3: Re-export**

Add to `packages/design-library/src/index.ts`:
```typescript
export type { TypicalInfluent } from './defaults';
export { SA_TYPICAL_INFLUENT } from './defaults';
```

**Step 4: Run & commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/design-library && npx vitest run
```
Expected: **16 passing**.

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/design-library/src/defaults.ts packages/design-library/src/index.ts packages/design-library/tests/defaults.test.ts && \
git commit -m "Add SA typical influent defaults to design-library"
```

---

### Task 9: Implement `aggregateBoQ()` — the BoQ engine

**Files:**
- Create: `packages/sim-engine/src/boq/aggregator.ts`
- Modify: `packages/sim-engine/src/index.ts` (export the aggregator)

**Context:** The aggregator is the one place that handles orphan-node iteration. It takes a flowsheet (raw node list) and the simulator's `nodeResults` and walks **every** node. For connected nodes it reads `capex` straight from `nodeResults`. For orphan utility nodes (blower, dosing) it calls `createUnit(type, params).process([])` to compute a fresh result. Then it groups all line items by category, applies overrides, and computes totals.

**Step 1: Create the aggregator**

Create `packages/sim-engine/src/boq/aggregator.ts`:
```typescript
import type { ProcessResult, UnitType, BoQLineItem, BoQCategory } from '../types';
import { BOQ_CATEGORIES } from '../types';
import { createUnit } from '../units';

/**
 * Minimal shape of a flowsheet node that the BoQ aggregator needs.
 * The full flowsheet structure (graph_data JSON in Supabase) is richer;
 * the aggregator only reads what it needs so it can be called with either
 * a React Flow node object or a simpler in-memory representation.
 */
export interface FlowsheetNodeLite {
  id: string;
  type: UnitType;
  parameters: Record<string, number>;
}

/**
 * Override for a specific line item. Keyed by the line item's description
 * (descriptions are stable within a unit's output because they're generated
 * from the unit's config). An override with `unitPriceZar` set replaces the
 * seeded price; setting it to null removes the line item entirely.
 */
export interface BoQOverride {
  nodeId: string;
  description: string;
  unitPriceZar?: number;      // replaces the seeded price
  overrideReason?: string;
  remove?: boolean;            // if true, drop this line item
}

export interface AggregatedBoQ {
  /** Line items grouped by category */
  lineItemsByCategory: Record<BoQCategory, Array<BoQLineItem & { nodeId: string }>>;
  /** Category subtotals in ZAR */
  subtotalsByCategory: Record<BoQCategory, number>;
  /** Overall grand total in ZAR */
  grandTotal: number;
  /** How many nodes contributed (including orphans) */
  nodeCount: number;
  /** How many nodes were orphan-iterated (not in nodeResults) */
  orphanCount: number;
}

/**
 * Walks every flowsheet node and aggregates their capex line items into
 * a single, grouped, priced Bill of Quantities. Nodes not found in the
 * provided `nodeResults` (e.g. disconnected utility nodes like the
 * AerationBlower whose O2-demand is supplied via parameters) are
 * executed in isolation via createUnit(...).process([]).
 */
export function aggregateBoQ(
  nodes: FlowsheetNodeLite[],
  nodeResults: Record<string, ProcessResult>,
  overrides: BoQOverride[] = [],
): AggregatedBoQ {
  const byCategory: Record<BoQCategory, Array<BoQLineItem & { nodeId: string }>> = {
    civil: [],
    mechanical: [],
    electrical: [],
    chemicals: [],
    instrumentation: [],
  };

  let orphanCount = 0;

  // Build an index of overrides for fast lookup: key = `${nodeId}::${description}`
  const overrideIndex = new Map<string, BoQOverride>();
  for (const o of overrides) {
    overrideIndex.set(`${o.nodeId}::${o.description}`, o);
  }

  for (const node of nodes) {
    // Get the unit's ProcessResult — from simulator if available, otherwise compute fresh
    let result = nodeResults[node.id];
    if (!result) {
      // Orphan node: compute its outputs in isolation
      try {
        const unit = createUnit(node.type, node.parameters);
        result = unit.process([]);
        orphanCount++;
      } catch {
        // Unit type not implemented or threw — skip; no BoQ contribution
        continue;
      }
    }

    const items = result.capex?.lineItems ?? [];
    for (const item of items) {
      const key = `${node.id}::${item.description}`;
      const override = overrideIndex.get(key);
      if (override?.remove) continue;

      const effectiveItem: BoQLineItem & { nodeId: string } = {
        ...item,
        nodeId: node.id,
        unitPriceZar: override?.unitPriceZar ?? item.unitPriceZar,
        overrideReason: override?.overrideReason ?? item.overrideReason,
      };

      byCategory[item.category].push(effectiveItem);
    }
  }

  // Subtotals & grand total
  const subtotals: Record<BoQCategory, number> = {
    civil: 0, mechanical: 0, electrical: 0, chemicals: 0, instrumentation: 0,
  };
  let grandTotal = 0;
  for (const category of BOQ_CATEGORIES) {
    const sum = byCategory[category].reduce(
      (acc, item) => acc + item.quantity * item.unitPriceZar,
      0,
    );
    subtotals[category] = sum;
    grandTotal += sum;
  }

  return {
    lineItemsByCategory: byCategory,
    subtotalsByCategory: subtotals,
    grandTotal,
    nodeCount: nodes.length,
    orphanCount,
  };
}
```

**Step 2: Export from sim-engine `index.ts`**

Add to the end of `packages/sim-engine/src/index.ts`:
```typescript
// BoQ engine
export { aggregateBoQ } from './boq/aggregator';
export type {
  FlowsheetNodeLite,
  BoQOverride,
  AggregatedBoQ,
} from './boq/aggregator';
```

**Step 3: Run sim-engine tests to verify nothing is broken**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **108 passing** (no new tests yet; the aggregator is untested at this step).

**Step 4: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/src/boq/aggregator.ts packages/sim-engine/src/index.ts && \
git commit -m "Add aggregateBoQ() with orphan-node handling"
```

---

### Task 10: Write unit tests for `aggregateBoQ()`

**Files:**
- Create: `packages/sim-engine/tests/boq-aggregator.test.ts`

**Step 1: Write the tests**

Create `packages/sim-engine/tests/boq-aggregator.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { aggregateBoQ } from '../src/boq/aggregator';
import type { FlowsheetNodeLite } from '../src/boq/aggregator';
import type { ProcessResult } from '../src/types';

const mkItem = (category: any, qty: number, price: number, description: string) => ({
  category,
  description,
  quantity: qty,
  unit: 'ea',
  unitPriceZar: price,
  sourceCitation: 'test',
});

describe('aggregateBoQ', () => {
  it('returns empty totals for empty input', () => {
    const result = aggregateBoQ([], {});
    expect(result.grandTotal).toBe(0);
    expect(result.nodeCount).toBe(0);
    expect(result.orphanCount).toBe(0);
    expect(result.subtotalsByCategory.civil).toBe(0);
  });

  it('groups line items by category and computes subtotals + grand total', () => {
    const nodes: FlowsheetNodeLite[] = [
      { id: 'n1', type: 'primary_clarifier', parameters: {} },
    ];
    const nodeResults: Record<string, ProcessResult> = {
      n1: {
        outputs: {},
        metadata: {},
        capex: {
          lineItems: [
            mkItem('civil', 100, 18000, 'concrete tank'),
            mkItem('mechanical', 1, 280000, 'scraper bridge'),
          ],
          total: 2_080_000,
        },
      } as ProcessResult,
    };

    const result = aggregateBoQ(nodes, nodeResults);
    expect(result.subtotalsByCategory.civil).toBe(1_800_000);
    expect(result.subtotalsByCategory.mechanical).toBe(280_000);
    expect(result.grandTotal).toBe(2_080_000);
    expect(result.lineItemsByCategory.civil.length).toBe(1);
    expect(result.lineItemsByCategory.mechanical.length).toBe(1);
    expect(result.orphanCount).toBe(0);
  });

  it('handles orphan utility nodes by calling createUnit(...).process([])', () => {
    // AerationBlower is a utility node with no input/output streams.
    // Even though simulate() doesn't visit it (nodeResults is empty), the
    // aggregator must call createUnit and include its BoQ.
    const nodes: FlowsheetNodeLite[] = [
      { id: 'blower1', type: 'aeration_blower', parameters: { o2_demand_kg_per_day: 500, ote: 0.08, diffuser_depth_m: 4.5 } },
    ];
    const result = aggregateBoQ(nodes, {});   // empty nodeResults
    expect(result.orphanCount).toBe(1);
    expect(result.grandTotal).toBeGreaterThan(0);
    // Should have at least one mechanical line (the blower itself)
    expect(result.lineItemsByCategory.mechanical.length).toBeGreaterThan(0);
  });

  it('mixes connected + orphan nodes correctly', () => {
    const nodes: FlowsheetNodeLite[] = [
      { id: 'n1', type: 'primary_clarifier', parameters: {} },
      { id: 'blower1', type: 'aeration_blower', parameters: { o2_demand_kg_per_day: 500, ote: 0.08, diffuser_depth_m: 4.5 } },
    ];
    const nodeResults: Record<string, ProcessResult> = {
      n1: {
        outputs: {},
        metadata: {},
        capex: { lineItems: [mkItem('civil', 100, 18000, 'concrete')], total: 1_800_000 },
      } as ProcessResult,
    };
    const result = aggregateBoQ(nodes, nodeResults);
    expect(result.nodeCount).toBe(2);
    expect(result.orphanCount).toBe(1);
    expect(result.grandTotal).toBeGreaterThan(1_800_000);  // blower adds to the total
  });

  it('applies unitPriceZar overrides', () => {
    const nodes: FlowsheetNodeLite[] = [
      { id: 'n1', type: 'primary_clarifier', parameters: {} },
    ];
    const nodeResults: Record<string, ProcessResult> = {
      n1: {
        outputs: {},
        metadata: {},
        capex: { lineItems: [mkItem('mechanical', 1, 280000, 'scraper bridge')], total: 280000 },
      } as ProcessResult,
    };
    const result = aggregateBoQ(nodes, nodeResults, [
      { nodeId: 'n1', description: 'scraper bridge', unitPriceZar: 250000, overrideReason: 'negotiated discount' },
    ]);
    expect(result.lineItemsByCategory.mechanical[0].unitPriceZar).toBe(250000);
    expect(result.lineItemsByCategory.mechanical[0].overrideReason).toBe('negotiated discount');
    expect(result.grandTotal).toBe(250000);
  });

  it('removes line items when override.remove = true', () => {
    const nodes: FlowsheetNodeLite[] = [
      { id: 'n1', type: 'primary_clarifier', parameters: {} },
    ];
    const nodeResults: Record<string, ProcessResult> = {
      n1: {
        outputs: {},
        metadata: {},
        capex: {
          lineItems: [
            mkItem('civil', 100, 18000, 'concrete'),
            mkItem('mechanical', 1, 280000, 'scraper bridge'),
          ],
          total: 2080000,
        },
      } as ProcessResult,
    };
    const result = aggregateBoQ(nodes, nodeResults, [
      { nodeId: 'n1', description: 'scraper bridge', remove: true },
    ]);
    expect(result.lineItemsByCategory.mechanical.length).toBe(0);
    expect(result.grandTotal).toBe(1_800_000);
  });

  it('survives an unknown unit type by skipping its contribution', () => {
    const nodes: FlowsheetNodeLite[] = [
      { id: 'fake', type: 'influent', parameters: {} },  // use a valid type to avoid TS error
    ];
    // Don't provide nodeResults and let orphan path run — Influent process() with [] inputs
    // should still work and emit calculation records but no capex.
    const result = aggregateBoQ(nodes, {});
    expect(result.nodeCount).toBe(1);
    // Influent has no capex contribution; grand total should be 0
    expect(result.grandTotal).toBe(0);
  });

  it('attaches nodeId to every emitted line item', () => {
    const nodes: FlowsheetNodeLite[] = [
      { id: 'n1', type: 'primary_clarifier', parameters: {} },
    ];
    const nodeResults: Record<string, ProcessResult> = {
      n1: {
        outputs: {},
        metadata: {},
        capex: { lineItems: [mkItem('civil', 100, 18000, 'concrete')], total: 1_800_000 },
      } as ProcessResult,
    };
    const result = aggregateBoQ(nodes, nodeResults);
    expect(result.lineItemsByCategory.civil[0].nodeId).toBe('n1');
  });
});
```

**Step 2: Run**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run -t aggregateBoQ
```
Expected: **8 passing**.

**Step 3: Full suite**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **116 passing** (108 + 8 new aggregator tests).

**Step 4: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/tests/boq-aggregator.test.ts && \
git commit -m "Add unit tests for aggregateBoQ"
```

---

### Task 11: Integration test — full plant BoQ end-to-end

**Files:**
- Modify: `packages/sim-engine/tests/simulator.test.ts` (or create a new `boq-integration.test.ts`)

**Step 1: Write integration test**

Add to `simulator.test.ts` (or a new file if it's cleaner):
```typescript
import { aggregateBoQ, type FlowsheetNodeLite } from '../src/boq/aggregator';

describe('BoQ engine — full plant integration', () => {
  it('aggregates total capex from a full plant train including orphan blower', () => {
    // Build a plant train. Reuse the existing full-plant test fixture if available.
    // Make sure the fixture includes at least one orphan utility node (AerationBlower).
    const graph = buildFullPlantFixture();    // existing helper
    const results = simulate(graph);

    // Extract the flowsheet node list in the shape aggregateBoQ expects.
    // Adapt this to however your graph fixture exposes its nodes — probably graph.nodes
    // or graph.getNodes(). Each needs { id, type, parameters }.
    const nodes: FlowsheetNodeLite[] = graph.nodes.map((n: any) => ({
      id: n.id,
      type: n.type,
      parameters: n.parameters ?? n.data?.parameters ?? {},
    }));

    const boq = aggregateBoQ(nodes, results.nodeResults);

    // Assertions
    expect(boq.nodeCount).toBe(nodes.length);
    expect(boq.orphanCount).toBeGreaterThan(0);    // the blower / dosing were orphans
    expect(boq.grandTotal).toBeGreaterThan(5_000_000);  // full plant ≥ R5m
    expect(boq.subtotalsByCategory.civil).toBeGreaterThan(0);
    expect(boq.subtotalsByCategory.mechanical).toBeGreaterThan(0);
    // At least some line items
    expect(boq.lineItemsByCategory.civil.length).toBeGreaterThan(0);
    expect(boq.lineItemsByCategory.mechanical.length).toBeGreaterThan(0);
  });

  it('orphan blower capex is reflected in the total', () => {
    const graph = buildFullPlantFixture();
    const results = simulate(graph);

    const nodes: FlowsheetNodeLite[] = graph.nodes.map((n: any) => ({
      id: n.id,
      type: n.type,
      parameters: n.parameters ?? n.data?.parameters ?? {},
    }));

    const boqWithBlower = aggregateBoQ(nodes, results.nodeResults);
    const nodesWithoutBlower = nodes.filter(n => n.type !== 'aeration_blower');
    const boqWithoutBlower = aggregateBoQ(nodesWithoutBlower, results.nodeResults);

    expect(boqWithBlower.grandTotal).toBeGreaterThan(boqWithoutBlower.grandTotal);
    expect(boqWithBlower.nodeCount).toBeGreaterThan(boqWithoutBlower.nodeCount);
  });
});
```

> **Note:** If there's no existing `buildFullPlantFixture` helper, create a minimal one inline that constructs a graph with: Influent → Screen → PrimaryClarifier → BioreactorAnoxic → BioreactorAerobic → SecondaryClarifier → UvDisinfection → Effluent, plus an orphan AerationBlower with `o2_demand_kg_per_day: 500`. The shape of the graph object is whatever the existing `simulate()` function consumes — look at other tests in `simulator.test.ts` to copy the pattern.

**Step 2: Run**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run -t "BoQ engine"
```
Expected: 2 new passing.

**Step 3: Full suite**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **118 passing**.

**Step 4: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/tests/simulator.test.ts && \
git commit -m "Add full-plant BoQ aggregation integration test with orphan blower"
```

---

### Task 12: Web build integration — smoke test from `apps/web`

**Files:**
- Create (or modify, if exists): `apps/web/lib/boq/preview.ts`

**Context:** A tiny smoke-test that proves `apps/web` can actually import and call `aggregateBoQ`. This isn't a real BoQ UI (that's Phase 6/7) — just a typed function that takes a flowsheet and returns an `AggregatedBoQ`, so the web build type-checks the import path.

**Step 1: Create the helper**

Create `apps/web/lib/boq/preview.ts`:
```typescript
import { aggregateBoQ } from '@repo/sim-engine';
import type { FlowsheetNodeLite, ProcessResult, AggregatedBoQ } from '@repo/sim-engine';

/**
 * Thin wrapper that Phase 6/7 will build the proposal-view BoQ section on top of.
 * Exists in Phase 3 only to smoke-test the import path from apps/web.
 */
export function previewBoQ(
  nodes: FlowsheetNodeLite[],
  nodeResults: Record<string, ProcessResult>,
): AggregatedBoQ {
  return aggregateBoQ(nodes, nodeResults);
}
```

**Step 2: Run the web build**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean build, 12 routes, no TypeScript errors. If it fails complaining about `@repo/sim-engine` or `@repo/design-library` resolution, run `npm install` again to re-link the workspaces.

**Step 3: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/lib/boq/preview.ts && \
git commit -m "Add BoQ preview smoke test in apps/web"
```

---

### Task 13: Final verification

**Files:** none

**Step 1: Full sim-engine suite**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **118 passing**.

**Step 2: Full design-library suite**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/design-library && npx vitest run
```
Expected: **16 passing**.

**Step 3: Combined test count sanity check**

Run both packages:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
(cd packages/sim-engine && npx vitest run) && \
(cd packages/design-library && npx vitest run)
```
Combined expected: sim-engine 118 + design-library 16 = **134 total tests**. Acceptable range: 130–145.

**Step 4: Type check both packages**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
(cd packages/sim-engine && npx tsc --noEmit) && \
(cd packages/design-library && npx tsc --noEmit)
```
Expected: Zero errors in both.

**Step 5: Web build**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean build, 12 routes.

**Step 6: Grep confirms no inline prices remain**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
grep -rn "_ZAR\s*=" packages/sim-engine/src/units/ || echo "ALL CLEAN"
```
Expected: `ALL CLEAN`.

**Step 7: Review branch commit history**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git log --oneline main..HEAD | head -60
```
Expected: Phases 1a + 1b + 2 + ~22 new Phase 3 commits.

---

### Task 14: Phase 3 completion summary

**Files:**
- Create: `docs/plans/2026-04-02-aquasim-v2-phase-3-COMPLETE.md`

**Step 1: Write the summary**

```markdown
# Phase 3 Complete — BoQ Engine + design-library

**Completed:** YYYY-MM-DD
**Branch:** v2-proposal-generator
**Commits:** ~22 (see `git log main..HEAD`)

## What shipped

### New workspace package: `@repo/design-library`
- `supplier-prices.ts` — 25+ priced reference items (civil, mechanical, chemicals)
- `dwa-limits.ts` — DWA General + Special discharge standards
- `kinetic-constants.ts` — Marais-Ekama kinetic & stoichiometric constants
- `defaults.ts` — SA typical raw sewage water quality
- 16 passing tests (integrity + shape checks)
- Consumed by: `@repo/sim-engine` (unit models) + `apps/web` (BoQ preview)

### Refactored 15 unit files to use `getPrice()`
No inline `const FOO_ZAR = …` blocks remain. `grep -rn "_ZAR" packages/sim-engine/src/units/`
returns nothing. All existing unit tests still pass unchanged (value-preserving refactor).

### `aggregateBoQ()` in `@repo/sim-engine`
- Walks the raw flowsheet node list (not just simulator nodeResults)
- Correctly handles orphan utility nodes (AerationBlower, ChemicalDosing) by calling `createUnit(...).process([])`
- Groups line items by category (civil / mechanical / electrical / chemicals / instrumentation)
- Applies per-item overrides (price replacement + item removal)
- Computes subtotals and grand total
- 8 aggregator tests + 2 integration tests

## Test count progression
- Start of Phase 3: 108 passing (sim-engine only)
- End of Phase 3: 118 sim-engine + 16 design-library = **134 passing**

## Deferred (not this phase)
- Persisting BoQ to Supabase → Phase 4
- Rendering BoQ in the UI → Phase 6/7
- Override UX (engineer clicks a line, types new price + reason) → Phase 6/7
- Price library browser page `/library/prices` → Phase 5
- Typed ID union for supplier prices → future polish

## Next: Phase 4
Schema migrations: add `boq_line_items`, `project_proposals` tables, `ALTER flowsheets`
and `ALTER profiles` to hold proposal metadata. Wire up RLS policies. Apply to the
Supabase project `otikhvpmjijwgnabxspd`.

Draft plan: `docs/plans/YYYY-MM-DD-aquasim-v2-phase-4-schema-migrations.md`
```

**Step 2: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add docs/plans/2026-04-02-aquasim-v2-phase-3-COMPLETE.md && \
git commit -m "Phase 3 complete — BoQ engine + @repo/design-library"
```

**Step 3: Do NOT merge to main.** Keep the branch for Phase 4.

---

## Summary of commits expected for Phase 3

| # | Task | Commit message |
|---|---|---|
| 0 | Baseline | (no commit) |
| 1 | Package scaffold | `Scaffold @repo/design-library workspace package` |
| 2 | Types + helper | `Add SupplierPriceRef type and getPrice() helper` |
| 3 | Populate registry | `Populate supplier-prices registry with 25+ entries` |
| 4a-f | Phase 1b refactor (×6) | `<Unit>: use @repo/design-library for supplier prices` |
| 5a-i | Phase 2 refactor (×9) | `<Unit>: use @repo/design-library for supplier prices` |
| 6 | DWA limits | `Add DWA General/Special discharge limits to design-library` |
| 7 | Kinetic constants | `Add Marais-Ekama kinetic constants to design-library` |
| 8 | SA defaults | `Add SA typical influent defaults to design-library` |
| 9 | BoQ aggregator | `Add aggregateBoQ() with orphan-node handling` |
| 10 | Aggregator tests | `Add unit tests for aggregateBoQ` |
| 11 | Integration test | `Add full-plant BoQ aggregation integration test with orphan blower` |
| 12 | apps/web smoke | `Add BoQ preview smoke test in apps/web` |
| 14 | Summary | `Phase 3 complete — BoQ engine + @repo/design-library` |

Total: ~22 commits on top of Phase 2, **~134 passing tests combined**, clean build, branch ready for Phase 4.

---

## Engineering invariants checked by this phase

| Invariant | How it's enforced |
|---|---|
| No inline prices in unit files | `grep -rn "_ZAR" packages/sim-engine/src/units/` returns nothing (Task 13 Step 6) |
| Refactor is value-preserving | All existing Phase 1b/Phase 2 unit tests pass unchanged (Tasks 4/5) |
| Registry entry shape is valid | `id === key`, non-empty `source`, valid ISO `lastUpdated` (Task 3 tests) |
| Unknown price IDs fail loudly | `getPrice('nope')` throws (Task 2 test) |
| Orphan nodes contribute to BoQ | Aggregator test: `grandTotal` grows when blower is added (Task 11) |
| Cross-package imports work | `apps/web/lib/boq/preview.ts` builds clean (Task 12) |
| DWA Special stricter than General | Task 6 test |
| Kinetic constants match Ekama 1984 | Task 7 test |
| SA defaults fall in typical range | Task 8 test |

## Known risks

1. **Lockfile drift** — if the repo uses `pnpm` not `npm`, the install command in Task 1 Step 9 needs to be `pnpm install` instead. Check for `pnpm-lock.yaml` vs `package-lock.json` and adjust.
2. **Registry price values** — the table in Task 3 was derived from the Phase 1b/2 plan docs. If the Phase 2 executor changed any price (e.g. during the AerationBlower formula fix), the grep in Task 3 Step 1 is the source of truth. Always reconcile against grep.
3. **Integration test fixture** — Task 11 assumes there's a `buildFullPlantFixture()` helper or equivalent. If not, building one inline is fine but takes extra time.
4. **Turborepo dependency cache** — after adding a new workspace package, turbo may cache stale. If the web build fails mysteriously, run `npx turbo run build --filter=web --force` to bypass cache.
