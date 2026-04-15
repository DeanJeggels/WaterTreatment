# AquaSim v2 — Phase 2: Nine New Unit Models

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Add 9 new process unit models to the sim-engine so AquaSim covers a complete biological wastewater treatment train from headworks to sludge disposal. Each new unit follows the v2 contract established in Phase 1a and filled in by Phase 1b: real sizing, energy, consumables, and BoQ line items with cited calculation records.

**Architecture:** Each new unit is a self-contained file in `packages/sim-engine/src/units/<name>.ts` implementing `ProcessUnit`. The `UnitType` union in `types.ts` is extended to include 9 new string literals. The registry in `units/index.ts` gets an entry and a factory case for each. Supplier prices are inlined at the top of each unit file with citation comments (Phase 3 extracts). No changes to `ProcessResult`, `PlantContext`, or the graph simulator.

**Tech Stack:** TypeScript 5, Vitest 3. Working on branch `v2-proposal-generator` (Phase 1a + Phase 1b complete).

---

## Context & References

- **Design doc:** `docs/plans/2026-04-02-aquasim-v2-proposal-generator-design.md`
- **Phase 1a plan (complete):** `docs/plans/2026-04-02-aquasim-v2-phase-1a-sim-engine-interface-refactor.md`
- **Phase 1b plan (complete):** `docs/plans/2026-04-02-aquasim-v2-phase-1b-existing-unit-depth.md`
- **Starting test count:** ~74 passing (from Phase 1b)
- **Starting branch:** `v2-proposal-generator`
- **Test runner:** `cd packages/sim-engine && npx vitest run`
- **Web build check:** `cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web`
- **Pattern reference:** Any existing unit file (e.g. `primary-clarifier.ts`) shows the file structure to follow

## The 9 New Units

| # | Unit | `UnitType` literal | Category | Replaces/pairs with |
|---|---|---|---|---|
| 1 | Screen (coarse/fine) | `screen` | preliminary | — |
| 2 | Grit removal | `grit_removal` | preliminary | — |
| 3 | Equalisation tank | `equalisation_tank` | preliminary | — |
| 4 | MBR (membrane bioreactor) | `mbr` | biological | Replaces secondary clarifier in MBR trains |
| 5 | Aeration blower | `aeration_blower` | utility | Pairs with Aerobic Bioreactor |
| 6 | Sludge dewatering | `dewatering` | sludge | Downstream of thickener |
| 7 | Chemical dosing | `chemical_dosing` | utility | Upstream of target unit |
| 8 | UV disinfection | `uv_disinfection` | tertiary | Downstream of clarifier/MBR |
| 9 | Inlet pumping | `inlet_pumping` | utility | Upstream of headworks |

## Success Criteria

1. All 9 new unit files exist under `packages/sim-engine/src/units/` and are registered in `units/index.ts`
2. `UnitType` union type in `types.ts` includes all 9 new string literals
3. `createUnit()` factory handles all 9 new types
4. Each unit has tests for: construction, mass balance / water quality, sizing dimensions, BoQ line items, calculation records with citations, and at least one edge case (zero flow, zero concentration, extreme parameter)
5. Full-plant integration test runs a train using several new units end-to-end
6. **Test count target: ~74 → ~140+** (roughly 7 tests per new unit × 9 units + integration tests)
7. Web build still succeeds; `apps/web` consumes the new unit definitions without code changes (React Flow node renderer will just show the new units as generic nodes until Phase 5 adds custom icons)

## Non-Goals (deferred to later phases)

- **Custom node icons** for new units in the React Flow canvas → Phase 5 (UI overhaul)
- **Plant-wide auto-linking** (e.g. aerobic reactor's O₂ demand flowing into the blower's config automatically) → later; for Phase 2 the engineer enters the blower's `o2_demand_kg_per_day` parameter manually from the reactor's calc record
- **Extract inline supplier prices** to `design-library` → Phase 3
- **MBR kinetics** beyond what the existing aerobic bioreactor provides → the MBR in Phase 2 is a membrane filtration block that receives pre-biological reactor outputs and outputs filtered effluent + concentrated reject. The biology still happens in the Aerobic Bioreactor unit upstream.

---

## Inline supplier prices used in Phase 2 (cited per unit)

Each new unit file carries its own `const` block, same convention as Phase 1b. Reference values:

| Unit | Item | Price (ZAR) | Source |
|---|---|---|---|
| Screen | Coarse mechanical bar rack (small plant) | 85,000 | Typical SA supplier 2025 (Meva/Huber range) |
| Screen | Fine step screen Huber ROTAMAT (small) | 450,000 | Huber catalogue 2024 / SA distributor |
| Grit removal | Aerated grit chamber grit pump + cyclone | 180,000 | Typical SA supplier 2025 |
| Equalisation | HDPE / concrete tank civil | 18,000/m³ | CH-ISE internal estimate 2026 |
| Equalisation | Submersible mixer (3 kW) | 45,000 | Typical SA supplier 2025 |
| MBR | SMU membrane module (~64 m²) | 625,000 | Megavision quote 2025 |
| MBR | CIP + permeate pump skid | 380,000 | Megavision / Memstar typical |
| Aeration blower | PD blower (15–37 kW class) | 180,000 | Aerzen / WEG SA distributor 2025 |
| Aeration blower | HST turbo blower (50+ kW) | 1,200,000 | Sulzer HST / APG Neuros catalogue |
| Dewatering | Belt press 1 m (belt-feed) | 850,000 | Andritz SMX catalogue 2024 |
| Dewatering | Decanter centrifuge 5 m³/h | 2,200,000 | Alfa Laval catalogue 2024 |
| Chemical dosing | Diaphragm metering pump (Grundfos DDA) | 28,000 | Grundfos SA catalogue 2025 |
| Chemical dosing | HDPE storage tank (2 m³) | 35,000 | Typical SA supplier 2025 |
| UV disinfection | LP-HO UV reactor (small, <500 m³/d) | 285,000 | Xylem Wedeco catalogue 2025 |
| Inlet pumping | Submersible centrifugal (7.5 kW) | 35,000 | Grundfos SE range SA catalogue 2025 |
| Inlet pumping | Submersible centrifugal (22 kW) | 95,000 | Grundfos SE range SA catalogue 2025 |

---

## Tasks

### Task 0: Verify starting state

**Files:** none (verification only)

**Step 1: Confirm branch and Phase 1b completion**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && git status && git log --oneline | head -20
```
Expected: `On branch v2-proposal-generator`, working tree clean, recent commit `Phase 1b complete — real values on 10 existing units`.

**Step 2: Confirm baseline test count**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: ~74 passing. If significantly different, stop and investigate.

**Step 3: Confirm build**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean build, 12 routes.

---

### Task 1: Extend `UnitType` union with 9 new literals

**Files:**
- Modify: `packages/sim-engine/src/types.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

**Step 1: Write failing test**

Add a new describe block at the bottom of `packages/sim-engine/tests/units.test.ts`:
```typescript
import { unitDefinitions } from '../src/units';
import type { UnitType } from '../src/types';

describe('Phase 2 — UnitType registry', () => {
  it('includes all 9 new unit types in the union', () => {
    const newTypes: UnitType[] = [
      'screen',
      'grit_removal',
      'equalisation_tank',
      'mbr',
      'aeration_blower',
      'dewatering',
      'chemical_dosing',
      'uv_disinfection',
      'inlet_pumping',
    ];
    for (const t of newTypes) {
      expect(unitDefinitions[t], `Missing unit definition for "${t}"`).toBeDefined();
    }
  });
});
```

**Step 2: Run to verify fail**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run -t "Phase 2"
```
Expected: FAIL (type error at compile time, or runtime undefined).

**Step 3: Extend `UnitType` union**

In `packages/sim-engine/src/types.ts`, find the existing union:
```typescript
export type UnitType =
  | 'influent'
  | 'primary_clarifier'
  | ...
  | 'effluent';
```

Replace with:
```typescript
export type UnitType =
  // v1 (existing)
  | 'influent'
  | 'primary_clarifier'
  | 'bioreactor_aerobic'
  | 'bioreactor_anoxic'
  | 'bioreactor_anaerobic'
  | 'secondary_clarifier'
  | 'splitter'
  | 'mixer'
  | 'thickener'
  | 'effluent'
  // v2 Phase 2 (new)
  | 'screen'
  | 'grit_removal'
  | 'equalisation_tank'
  | 'mbr'
  | 'aeration_blower'
  | 'dewatering'
  | 'chemical_dosing'
  | 'uv_disinfection'
  | 'inlet_pumping';
```

**Step 4: Run — type check will now fail in `units/index.ts`**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx tsc --noEmit
```
Expected: TypeScript errors in `units/index.ts` complaining that `unitDefinitions` is missing entries for the 9 new types. This is the guardrail — we can't forget to register new units.

**Step 5: Add temporary stub entries in `units/index.ts` to unblock the type check**

In `packages/sim-engine/src/units/index.ts`, add stub entries at the bottom of `unitDefinitions` object (we'll replace them in subsequent tasks):
```typescript
  // Phase 2 stubs — to be replaced with real definitions
  screen: { type: 'screen', label: 'Screen (stub)', description: 'stub', icon: 'filter', handles: [], defaultParameters: {}, parameterSchema: [] },
  grit_removal: { type: 'grit_removal', label: 'Grit removal (stub)', description: 'stub', icon: 'circle', handles: [], defaultParameters: {}, parameterSchema: [] },
  equalisation_tank: { type: 'equalisation_tank', label: 'Equalisation (stub)', description: 'stub', icon: 'square', handles: [], defaultParameters: {}, parameterSchema: [] },
  mbr: { type: 'mbr', label: 'MBR (stub)', description: 'stub', icon: 'layers', handles: [], defaultParameters: {}, parameterSchema: [] },
  aeration_blower: { type: 'aeration_blower', label: 'Aeration blower (stub)', description: 'stub', icon: 'fan', handles: [], defaultParameters: {}, parameterSchema: [] },
  dewatering: { type: 'dewatering', label: 'Dewatering (stub)', description: 'stub', icon: 'droplet', handles: [], defaultParameters: {}, parameterSchema: [] },
  chemical_dosing: { type: 'chemical_dosing', label: 'Chemical dosing (stub)', description: 'stub', icon: 'beaker', handles: [], defaultParameters: {}, parameterSchema: [] },
  uv_disinfection: { type: 'uv_disinfection', label: 'UV (stub)', description: 'stub', icon: 'sun', handles: [], defaultParameters: {}, parameterSchema: [] },
  inlet_pumping: { type: 'inlet_pumping', label: 'Inlet pump (stub)', description: 'stub', icon: 'arrow-up', handles: [], defaultParameters: {}, parameterSchema: [] },
```

And add stub cases to `createUnit()`:
```typescript
case 'screen':
case 'grit_removal':
case 'equalisation_tank':
case 'mbr':
case 'aeration_blower':
case 'dewatering':
case 'chemical_dosing':
case 'uv_disinfection':
case 'inlet_pumping':
  throw new Error(`Unit type "${type}" not yet implemented (Phase 2 in progress)`);
```

**Step 6: Run the test**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **~75 passing** (74 + 1 new registry test passes because the stubs exist).

**Step 7: Web build check**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean build. The web app's React Flow canvas will now show 9 new unit types in the palette (with stub labels) — that's fine; Phase 5 adds proper UI.

**Step 8: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/src/types.ts packages/sim-engine/src/units/index.ts packages/sim-engine/tests/units.test.ts && \
git commit -m "Extend UnitType union with 9 new Phase 2 unit types (stubs)"
```

---

### Task 2: Implement `Screen` unit (coarse + fine variants)

**Files:**
- Create: `packages/sim-engine/src/units/screen.ts`
- Modify: `packages/sim-engine/src/units/index.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

**Context:** A single `screen` unit handles both coarse (>10 mm bar spacing) and fine (1–6 mm) via a `screen_type` string parameter. Sized by approach velocity + bar spacing. Head loss calculated. Produces daily screenings volume to landfill. Pass-through WQ: slight TSS reduction (removes rags and debris), negligible change to dissolved parameters.

**Design equations:**
- Channel area: `A_ch = Q_peak / v_approach` (v_approach ≤ 0.9 m/s at peak)
- Bar spacing head loss: `hL = (1/0.7) × (V² − v²) / (2g)` — Metcalf & Eddy Ch. 5
- Screenings volume: `V_screenings = Q × screenings_m3_per_ML` — typical 5–20 L/ML (fine), 30–60 L/ML (coarse)

**Step 1: Write failing test**

Add to `units.test.ts`:
```typescript
import { Screen, screenDefinition } from '../src/units/screen';

describe('Screen', () => {
  describe('Coarse variant', () => {
    it('constructs with default parameters', () => {
      const unit = new Screen({ bar_spacing_mm: 20, approach_velocity_mps: 0.6, screen_type: 0 });
      expect(unit.type).toBe('screen');
    });

    it('passes flow through with minimal WQ change', () => {
      const unit = new Screen({ bar_spacing_mm: 20, approach_velocity_mps: 0.6, screen_type: 0 });
      const inf = { ...emptyWaterQuality(), flow: 1000, TSS: 300, COD: 500 };
      const r = unit.process([inf]);
      expect(r.outputs.out.flow).toBeCloseTo(1000, 1);
      expect(r.outputs.out.COD).toBeCloseTo(500, 1);
      expect(r.outputs.out.TSS).toBeLessThan(300);       // slight removal
      expect(r.outputs.out.TSS).toBeGreaterThan(290);    // not much though
    });

    it('emits sizing, BoQ, and calculation records', () => {
      const unit = new Screen({ bar_spacing_mm: 20, approach_velocity_mps: 0.6, screen_type: 0 });
      const r = unit.process([{ ...emptyWaterQuality(), flow: 1000 }]);
      expect(r.sizing?.channelArea).toBeDefined();
      expect(r.sizing?.headLoss).toBeDefined();
      assertHasCalculationRecord(r.calculationRecords, 'channel area');
      assertHasCalculationRecord(r.calculationRecords, 'head loss');
      expect(r.capex!.lineItems.length).toBeGreaterThan(0);
      expect(r.capex!.total).toBeGreaterThan(0);
      expect(r.consumables?.length).toBeGreaterThan(0);   // screenings disposal
      assertAllRecordsValid(r.calculationRecords);
    });
  });

  describe('Fine variant', () => {
    it('uses a different supplier price line than coarse', () => {
      const coarse = new Screen({ bar_spacing_mm: 20, approach_velocity_mps: 0.6, screen_type: 0 });
      const fine = new Screen({ bar_spacing_mm: 3, approach_velocity_mps: 0.6, screen_type: 1 });
      const inf = { ...emptyWaterQuality(), flow: 1000 };
      const rCoarse = coarse.process([inf]);
      const rFine = fine.process([inf]);
      expect(rFine.capex!.total).toBeGreaterThan(rCoarse.capex!.total);
    });
  });

  it('handles zero flow gracefully', () => {
    const unit = new Screen({ bar_spacing_mm: 20, approach_velocity_mps: 0.6, screen_type: 0 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 0 }]);
    expect(r.outputs.out.flow).toBe(0);
  });
});
```

**Step 2: Run — expect fail (Screen not exported yet)**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run -t Screen
```

**Step 3: Create `screen.ts`**

Create `packages/sim-engine/src/units/screen.ts`:
```typescript
import type { ProcessUnit, ProcessResult, WaterQuality, UnitDefinition, ParameterField } from '../types';
import { emptyWaterQuality, emptyUnitOutputs } from '../types';

// === Supplier price references (Phase 2 inline — Phase 3 moves to design-library) ===
// Coarse mechanical bar rack (small plant)
// Source: Typical SA supplier quote 2025 (Meva/Huber range)
const COARSE_SCREEN_ZAR = 85000;
// Huber ROTAMAT Ro5 or similar fine screen (small plant)
// Source: Huber catalogue 2024 / typical SA distributor
const FINE_SCREEN_ZAR = 450000;
// Civil headworks channel (concrete)
// Source: CH-ISE internal estimate 2026
const CIVIL_CHANNEL_ZAR_PER_M3 = 15000;
// Screenings disposal cost
// Source: Typical SA landfill rate 2025
const SCREENINGS_DISPOSAL_ZAR_PER_M3 = 1500;
// Typical screenings production rates (L/ML)
const COARSE_SCREENINGS_L_PER_ML = 40;
const FINE_SCREENINGS_L_PER_ML = 15;

const parameterSchema: ParameterField[] = [
  { key: 'screen_type', label: 'Type (0=coarse, 1=fine)', unit: '', min: 0, max: 1, step: 1, defaultValue: 1, description: '0 = coarse bar rack, 1 = fine step screen' },
  { key: 'bar_spacing_mm', label: 'Bar spacing', unit: 'mm', min: 1, max: 50, step: 1, defaultValue: 3 },
  { key: 'approach_velocity_mps', label: 'Approach velocity', unit: 'm/s', min: 0.3, max: 0.9, step: 0.05, defaultValue: 0.6 },
  { key: 'peak_factor', label: 'Peak factor', unit: '', min: 1.0, max: 4.0, step: 0.1, defaultValue: 2.5 },
  { key: 'channel_depth_m', label: 'Channel depth', unit: 'm', min: 0.5, max: 2.5, step: 0.1, defaultValue: 1.0 },
];

export const screenDefinition: UnitDefinition = {
  type: 'screen',
  label: 'Screen',
  description: 'Bar rack or step screen — removes rags, debris, and coarse solids',
  icon: 'filter',
  handles: [
    { id: 'in', label: 'Inflow', position: 'left', type: 'input' },
    { id: 'out', label: 'Outflow', position: 'right', type: 'output' },
  ],
  defaultParameters: Object.fromEntries(parameterSchema.map(p => [p.key, p.defaultValue])),
  parameterSchema,
};

export class Screen implements ProcessUnit {
  type = 'screen' as const;
  constructor(public parameters: Record<string, number>) {}

  process(inputs: WaterQuality[]): ProcessResult {
    const inf = inputs[0] ?? emptyWaterQuality();
    const p = this.parameters;

    if (inf.flow <= 0) {
      return { outputs: { out: emptyWaterQuality() }, metadata: {}, ...emptyUnitOutputs() };
    }

    const isFine = (p.screen_type ?? 1) >= 0.5;
    const barSpacing_mm = p.bar_spacing_mm ?? (isFine ? 3 : 20);
    const v_app = Math.max(0.3, Math.min(0.9, p.approach_velocity_mps ?? 0.6));
    const peakFactor = p.peak_factor ?? 2.5;
    const depth = p.channel_depth_m ?? 1.0;

    const q_peak_m3s = (inf.flow * peakFactor) / 86400;       // m³/s
    const channelArea = q_peak_m3s / v_app;                    // m²
    const channelWidth = channelArea / depth;                  // m
    const channelLength = 2.0;                                  // short channel assumption (m)
    const channelVolume = channelArea * channelLength;         // m³

    // Head loss through bar rack — simplified Kirschmer's formula
    // hL = β × (w/b)^(4/3) × (v² / 2g) × sin(θ)
    // For rectangular bars at 60° with typical spacing → lump into ≈ v²/(2g × 0.7)
    const g = 9.81;
    const headLoss_m = (v_app * v_app) / (2 * g * 0.7);

    // Mild TSS removal (screenings + rag removal)
    // Coarse: ~2% TSS removal; Fine: ~5% TSS removal
    const tssRemovalFrac = isFine ? 0.05 : 0.02;

    const output: WaterQuality = {
      ...inf,
      TSS: inf.TSS * (1 - tssRemovalFrac),
      VSS: inf.VSS * (1 - tssRemovalFrac * 0.9),
    };

    // Screenings daily production
    const screenings_L_per_ML = isFine ? FINE_SCREENINGS_L_PER_ML : COARSE_SCREENINGS_L_PER_ML;
    const screenings_m3_per_d = (inf.flow / 1000) * (screenings_L_per_ML / 1000);

    const screenPrice = isFine ? FINE_SCREEN_ZAR : COARSE_SCREEN_ZAR;
    const civilCost = channelVolume * CIVIL_CHANNEL_ZAR_PER_M3;

    const base = emptyUnitOutputs();
    base.sizing = {
      channelArea: { value: channelArea, unit: 'm2' },
      channelWidth: { value: channelWidth, unit: 'm' },
      channelDepth: { value: depth, unit: 'm' },
      headLoss: { value: headLoss_m, unit: 'm' },
    };
    base.capex = {
      lineItems: [
        {
          category: 'civil',
          description: `Headworks concrete channel (${channelVolume.toFixed(1)} m³)`,
          quantity: channelVolume,
          unit: 'm3',
          unitPriceZar: CIVIL_CHANNEL_ZAR_PER_M3,
          sourceCitation: 'CH-ISE internal estimate 2026',
        },
        {
          category: 'mechanical',
          description: isFine ? 'Fine step screen (Huber ROTAMAT Ro5 equivalent)' : 'Coarse mechanical bar rack',
          quantity: 1,
          unit: 'ea',
          unitPriceZar: screenPrice,
          sourceCitation: isFine ? 'Huber catalogue 2024 / SA distributor' : 'Typical SA supplier quote 2025 (Meva/Huber)',
        },
      ],
      total: civilCost + screenPrice,
    };
    base.consumables = [
      {
        item: 'Screenings disposal to landfill',
        daily: screenings_m3_per_d,
        unit: 'm3/d',
        citation: 'Typical SA landfill rate 2025',
      },
    ];
    base.calculationRecords = [
      {
        label: 'Peak flow',
        symbol: 'Q_peak',
        equation: 'Q_peak = Q × PF',
        inputs: {
          Q: { value: inf.flow, unit: 'm3/d', source: 'inlet flow' },
          PF: { value: peakFactor, unit: '', source: 'user input (typical 2.5)' },
        },
        result: { value: inf.flow * peakFactor, unit: 'm3/d' },
        citation: 'Metcalf & Eddy (2014) Ch. 3',
      },
      {
        label: 'Channel area at peak',
        symbol: 'A_ch',
        equation: 'A_ch = Q_peak / v_approach',
        inputs: {
          Q_peak: { value: q_peak_m3s, unit: 'm3/s', source: 'converted from m3/d' },
          v_approach: { value: v_app, unit: 'm/s', source: 'design assumption' },
        },
        result: { value: channelArea, unit: 'm2' },
        citation: 'Metcalf & Eddy (2014) Ch. 5',
      },
      {
        label: 'Head loss through screen',
        symbol: 'hL',
        equation: 'hL = v² / (2g × 0.7)',
        inputs: {
          v: { value: v_app, unit: 'm/s', source: 'approach velocity' },
          g: { value: g, unit: 'm/s²', source: 'gravity' },
        },
        result: { value: headLoss_m, unit: 'm' },
        citation: 'Kirschmer (1926) simplified — M&E Ch. 5',
      },
    ];

    return {
      outputs: { out: output },
      metadata: {
        is_fine_screen: isFine ? 1 : 0,
        screenings_m3_per_day: screenings_m3_per_d,
      },
      ...base,
    };
  }
}
```

**Step 4: Register in `units/index.ts`**

Replace the `screen` stub with:
```typescript
import { Screen, screenDefinition } from './screen';
// ... at the top exports:
export { Screen, screenDefinition } from './screen';
// ... in unitDefinitions:
screen: screenDefinition,
// ... in createUnit() switch:
case 'screen': return new Screen(parameters);
```

Remove the `case 'screen':` from the "not yet implemented" fallthrough block.

**Step 5: Run the Screen tests**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run -t Screen
```
Expected: All Screen tests passing.

**Step 6: Full suite**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **~80 passing** (~75 + 5 new Screen tests).

**Step 7: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/src/units/screen.ts packages/sim-engine/src/units/index.ts packages/sim-engine/tests/units.test.ts && \
git commit -m "Add Screen unit (coarse/fine variants) with sizing, BoQ, records"
```

---

### Task 3: Implement `GritRemoval` unit

**Files:**
- Create: `packages/sim-engine/src/units/grit-removal.ts`
- Modify: `packages/sim-engine/src/units/index.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

**Context:** Aerated grit chamber. HRT 3–5 min at peak flow. Removes grit (sand, gravel) >0.2 mm. Requires small air supply (~0.2–0.5 m³/min per m of tank length). Pass-through WQ: minor TSS reduction, no change to dissolved parameters.

**Design equations:**
- Tank volume: `V = Q_peak × HRT_min / 1440`
- Air supply: `Q_air = air_rate × L_tank` (L_tank estimated from V and aspect ratio)
- Grit removal: ~95% of settleable solids >0.2 mm (approximated as 5–10% TSS removal)

**Supplier prices (inline):**
```typescript
const CIVIL_CONCRETE_ZAR_PER_M3 = 18000;
// Grit pump + cyclone separator + air diffusers
// Source: Typical SA supplier quote 2025
const GRIT_EQUIPMENT_ZAR = 180000;
// Grit disposal to landfill
// Source: Typical SA landfill rate 2025
const GRIT_DISPOSAL_ZAR_PER_M3 = 800;
// Typical grit production (m³ / ML influent)
const GRIT_M3_PER_ML = 0.015;
```

**Step 1: Write failing test**

Add to `units.test.ts`:
```typescript
import { GritRemoval } from '../src/units/grit-removal';

describe('GritRemoval', () => {
  it('sizes at 3–5 min HRT on peak flow', () => {
    const unit = new GritRemoval({ hrt_min: 4, peak_factor: 2.5 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 10000, TSS: 300 }]);
    expect(r.sizing?.volume.value).toBeCloseTo((10000 * 2.5 * 4) / 1440, 1);
  });

  it('emits civil + grit equipment BoQ', () => {
    const unit = new GritRemoval({ hrt_min: 4, peak_factor: 2.5 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 10000 }]);
    expect(r.capex!.lineItems.find(i => i.category === 'civil')).toBeDefined();
    expect(r.capex!.lineItems.find(i => i.category === 'mechanical')).toBeDefined();
    expect(r.consumables?.find(c => /grit/i.test(c.item))).toBeDefined();
    assertHasCalculationRecord(r.calculationRecords, 'HRT');
    assertAllRecordsValid(r.calculationRecords);
  });

  it('handles zero flow gracefully', () => {
    const unit = new GritRemoval({ hrt_min: 4, peak_factor: 2.5 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 0 }]);
    expect(r.outputs.out.flow).toBe(0);
  });
});
```

**Step 2: Run — expect fail**

**Step 3: Create `grit-removal.ts`**

Follow the same file structure as `screen.ts`. Key implementation points:
```typescript
const peakFactor = p.peak_factor ?? 2.5;
const hrt_min = Math.max(2, Math.min(6, p.hrt_min ?? 4));
const q_peak = inf.flow * peakFactor;
const volume = (q_peak * hrt_min) / 1440;     // m3
const airRate_m3_min = 0.3 * Math.sqrt(volume / 10);   // rough — small plant
const tssRemoval = 0.07;   // 7% TSS removal (mostly grit)
const gritProd = (inf.flow / 1000) * GRIT_M3_PER_ML;

// WQ output: pass-through minus TSS
const output = { ...inf, TSS: inf.TSS * (1 - tssRemoval), VSS: inf.VSS * (1 - tssRemoval * 0.5) };

base.sizing = {
  volume: { value: volume, unit: 'm3' },
  hrt: { value: hrt_min, unit: 'min' },
  airFlowRate: { value: airRate_m3_min * 60, unit: 'm3/h' },
};
base.energy = {
  installedKW: airRate_m3_min * 60 * 0.05,   // rough: 50 W per m³/h air
  dailyKWh: airRate_m3_min * 60 * 0.05 * 24,
  records: [
    {
      label: 'Air supply for grit agitation',
      symbol: 'Q_air',
      equation: 'Q_air ≈ 0.3 × √(V/10)',
      inputs: { V: { value: volume, unit: 'm3', source: 'grit tank volume' } },
      result: { value: airRate_m3_min * 60, unit: 'm3/h' },
      citation: 'Metcalf & Eddy (2014) Ch. 5 — aerated grit chamber',
    },
  ],
};
base.capex = {
  lineItems: [
    { category: 'civil', description: `Aerated grit chamber civils (${volume.toFixed(1)} m³)`, quantity: volume, unit: 'm3', unitPriceZar: CIVIL_CONCRETE_ZAR_PER_M3, sourceCitation: 'CH-ISE internal estimate 2026' },
    { category: 'mechanical', description: 'Grit pump + cyclone + air diffusers', quantity: 1, unit: 'ea', unitPriceZar: GRIT_EQUIPMENT_ZAR, sourceCitation: 'Typical SA supplier quote 2025' },
  ],
  total: volume * CIVIL_CONCRETE_ZAR_PER_M3 + GRIT_EQUIPMENT_ZAR,
};
base.consumables = [
  { item: 'Grit disposal to landfill', daily: gritProd, unit: 'm3/d', citation: 'Typical SA landfill rate 2025' },
];
base.calculationRecords = [
  {
    label: 'Grit chamber HRT at peak',
    symbol: 'HRT',
    equation: 'HRT = V × 1440 / Q_peak',
    inputs: {
      V: { value: volume, unit: 'm3', source: 'tank volume' },
      Q_peak: { value: q_peak, unit: 'm3/d', source: 'Q × PF' },
    },
    result: { value: hrt_min, unit: 'min' },
    citation: 'Metcalf & Eddy (2014) Ch. 5 — 3-5 min at peak',
  },
];
```

(Full file follows the pattern of `screen.ts` — imports, supplier constants, parameter schema, definition, class.)

**Step 4: Register and commit**

Same pattern: update `units/index.ts`, run tests, commit.

Expected count after commit: **~83 passing**.

Commit message: `Add GritRemoval unit with sizing, energy, BoQ, records`

---

### Task 4: Implement `EqualisationTank` unit

**Files:**
- Create: `packages/sim-engine/src/units/equalisation-tank.ts`
- Modify: `packages/sim-engine/src/units/index.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

**Context:** Volume-sized by user-specified HRT (4–12 h typical), or by cumulative mass diagram (deferred to later phase). Requires mixing to prevent settling. Pass-through WQ: no change (in steady state, the EQ tank just buffers flow; it doesn't change concentrations).

**Design equations:**
- Volume: `V = Q × HRT_hours / 24`
- Mixing power: `P = 5 W/m³ × V / 1000` (typical for mild mixing)
- Number of mixers: 1 × 3 kW per 500 m³ (same rule as bioreactors)

**Supplier prices (inline):**
```typescript
const CIVIL_CONCRETE_ZAR_PER_M3 = 18000;
const SUBMERSIBLE_MIXER_ZAR = 45000;
const MIXER_VOLUME_PER_UNIT_M3 = 500;
const MIXER_KW_PER_UNIT = 3;
```

**Step 1: Write failing test**

```typescript
import { EqualisationTank } from '../src/units/equalisation-tank';

describe('EqualisationTank', () => {
  it('sizes volume from user HRT', () => {
    const unit = new EqualisationTank({ hrt_hours: 6 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 1000 }]);
    expect(r.sizing?.volume.value).toBeCloseTo(250, 1);   // 1000 * 6 / 24 = 250
  });

  it('passes water quality through unchanged', () => {
    const unit = new EqualisationTank({ hrt_hours: 6 });
    const inf = { ...emptyWaterQuality(), flow: 1000, COD: 600, TSS: 250 };
    const r = unit.process([inf]);
    expect(r.outputs.out.COD).toBe(600);
    expect(r.outputs.out.TSS).toBe(250);
  });

  it('emits civil + mixer BoQ and mixing energy', () => {
    const unit = new EqualisationTank({ hrt_hours: 6 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 1000 }]);
    expect(r.energy?.installedKW).toBeGreaterThan(0);
    expect(r.capex!.lineItems.find(i => i.category === 'civil')).toBeDefined();
    expect(r.capex!.lineItems.find(i => i.category === 'mechanical')).toBeDefined();
    assertHasCalculationRecord(r.calculationRecords, 'HRT');
    assertAllRecordsValid(r.calculationRecords);
  });
});
```

**Step 2: Run — expect fail**

**Step 3: Create the unit file** following the same pattern — constants, schema (`hrt_hours`, `depth`), definition, class.

**Step 4: Register and commit**

Expected after commit: **~86 passing**.
Commit message: `Add EqualisationTank unit with sizing, mixing energy, BoQ, records`

---

### Task 5: Implement `MBR` unit

**Files:**
- Create: `packages/sim-engine/src/units/mbr.ts`
- Modify: `packages/sim-engine/src/units/index.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

**Context:** Membrane filtration module that receives mixed liquor from the aerobic bioreactor and produces a near-particle-free permeate + concentrated reject. This is the MBR *filtration* block — the biology lives in the upstream aerobic bioreactor. For design, sized by flux (L/m²/h) and required surface area.

**Design equations:** (from `WWTP Design.xlsm` sheet 7)
- `A_total = Q / (J × operational_fraction)` where J = 18.4 L/m²/h (Megavision default), operational fraction = 0.8
- `N_modules = ceil(A_total / A_per_module)` where A_per_module = 64 m² (Megavision SMU)
- Air scour: `Q_air = 12.5 × A_total / 1000 × 60` Nm³/hr (Megavision formula)
- Air scour blower kW: `P = Q_air × ΔP / (η × 3600)` simplified → ~0.05 kW per Nm³/hr

**Supplier prices (inline):**
```typescript
const MBR_MODULE_ZAR = 625000;      // per 64 m² SMU
const MBR_MODULE_AREA_M2 = 64;
const MBR_CIP_SKID_ZAR = 380000;    // one CIP + permeate pump skid regardless of module count
const MBR_DEFAULT_FLUX_LMH = 18.4;
const MBR_OPERATIONAL_FRACTION = 0.8;   // duty cycle (backwash etc.)
```

**Step 1: Write failing test**

```typescript
import { MBR } from '../src/units/mbr';

describe('MBR', () => {
  it('sizes membrane area from flow and flux', () => {
    const unit = new MBR({ flux_lmh: 18.4, operational_fraction: 0.8, module_area_m2: 64 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 1000, TSS: 3500 }]);
    expect(r.sizing?.membraneArea).toBeDefined();
    const expectedArea = (1000 * 1000) / (18.4 * 0.8 * 24);  // L/d ÷ (L/m²/h × 24 × 0.8)
    expect(r.sizing!.membraneArea.value).toBeCloseTo(expectedArea, 0);
  });

  it('produces near-particle-free permeate', () => {
    const unit = new MBR({ flux_lmh: 18.4, operational_fraction: 0.8, module_area_m2: 64 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 1000, TSS: 3500 }]);
    expect(r.outputs.permeate.TSS).toBeLessThan(5);     // near-zero TSS in permeate
  });

  it('emits modules + CIP BoQ and air scour energy', () => {
    const unit = new MBR({ flux_lmh: 18.4, operational_fraction: 0.8, module_area_m2: 64 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 1000, TSS: 3500 }]);
    const modulesItem = r.capex!.lineItems.find(i => i.description.toLowerCase().includes('smu'));
    const cipItem = r.capex!.lineItems.find(i => i.description.toLowerCase().includes('cip'));
    expect(modulesItem).toBeDefined();
    expect(cipItem).toBeDefined();
    expect(r.energy?.installedKW).toBeGreaterThan(0);
    assertHasCalculationRecord(r.calculationRecords, 'membrane area');
    assertHasCalculationRecord(r.calculationRecords, 'air scour');
    assertAllRecordsValid(r.calculationRecords);
  });

  it('handles zero flow gracefully', () => {
    const unit = new MBR({ flux_lmh: 18.4, operational_fraction: 0.8, module_area_m2: 64 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 0 }]);
    expect(r.outputs.permeate.flow).toBe(0);
  });
});
```

**Step 2: Run — expect fail**

**Step 3: Create `mbr.ts`**

Key implementation:
```typescript
const flux_lmh = p.flux_lmh ?? MBR_DEFAULT_FLUX_LMH;
const opFrac = p.operational_fraction ?? MBR_OPERATIONAL_FRACTION;
const modAreaPer = p.module_area_m2 ?? MBR_MODULE_AREA_M2;

const flow_L_per_d = inf.flow * 1000;
const requiredArea = flow_L_per_d / (flux_lmh * 24 * opFrac);      // m²
const moduleCount = Math.max(1, Math.ceil(requiredArea / modAreaPer));
const installedArea = moduleCount * modAreaPer;

// Air scour — Megavision formula (from WWTP Design.xlsm sheet 7)
const airScour_Nm3_h = (installedArea * 12.5 / 1000) * 60;
const blowerKW = airScour_Nm3_h * 0.05;     // ~0.05 kW per Nm³/h — small PD blower

// Permeate: near-zero TSS/VSS, soluble pass-through
const permeate: WaterQuality = {
  flow: inf.flow * 0.98,          // 2% reject
  COD: inf.sCOD + (inf.COD - inf.sCOD) * 0.01,   // nearly all particulate rejected
  sCOD: inf.sCOD,
  BOD5: inf.BOD5 * 0.1,
  TKN: inf.NH3N + (inf.TKN - inf.NH3N) * 0.02,
  NH3N: inf.NH3N,
  NO3N: inf.NO3N,
  TP: inf.TP * 0.2,
  TSS: 2,           // near-zero
  VSS: 1.5,
  pH: inf.pH,
  alkalinity: inf.alkalinity,
  DO: inf.DO,
  temperature: inf.temperature,
};

// Reject: concentrated mixed liquor (~5% reject flow)
const reject: WaterQuality = {
  flow: inf.flow * 0.02,
  COD: (inf.COD * inf.flow - permeate.COD * permeate.flow) / (inf.flow * 0.02),
  sCOD: inf.sCOD,
  BOD5: (inf.BOD5 * inf.flow - permeate.BOD5 * permeate.flow) / (inf.flow * 0.02),
  TKN: (inf.TKN * inf.flow - permeate.TKN * permeate.flow) / (inf.flow * 0.02),
  NH3N: inf.NH3N,
  NO3N: inf.NO3N,
  TP: (inf.TP * inf.flow - permeate.TP * permeate.flow) / (inf.flow * 0.02),
  TSS: (inf.TSS * inf.flow - permeate.TSS * permeate.flow) / (inf.flow * 0.02),
  VSS: (inf.VSS * inf.flow - permeate.VSS * permeate.flow) / (inf.flow * 0.02),
  pH: inf.pH,
  alkalinity: inf.alkalinity,
  DO: inf.DO,
  temperature: inf.temperature,
};

base.sizing = {
  membraneArea: { value: installedArea, unit: 'm2' },
  moduleCount: { value: moduleCount, unit: 'ea' },
  fluxOperational: { value: flux_lmh * opFrac, unit: 'L/m²/h' },
  airScourFlow: { value: airScour_Nm3_h, unit: 'Nm³/hr' },
};
base.energy = {
  installedKW: blowerKW,
  dailyKWh: blowerKW * 24,
  records: [/* air scour calc record */],
};
base.capex = {
  lineItems: [
    { category: 'mechanical', description: `Megavision SMU membrane modules (${moduleCount} × ${modAreaPer} m²)`, quantity: moduleCount, unit: 'ea', unitPriceZar: MBR_MODULE_ZAR, sourceCitation: 'Megavision quote 2025' },
    { category: 'mechanical', description: 'MBR CIP + permeate pump skid', quantity: 1, unit: 'ea', unitPriceZar: MBR_CIP_SKID_ZAR, sourceCitation: 'Megavision / Memstar typical 2025' },
  ],
  total: moduleCount * MBR_MODULE_ZAR + MBR_CIP_SKID_ZAR,
};
base.calculationRecords = [
  {
    label: 'Required membrane area',
    symbol: 'A',
    equation: 'A = Q / (J × op_frac × 24)',
    inputs: {
      Q: { value: flow_L_per_d, unit: 'L/d', source: 'inlet flow × 1000' },
      J: { value: flux_lmh, unit: 'L/m²/h', source: 'design flux' },
      op_frac: { value: opFrac, unit: '', source: 'duty cycle' },
    },
    result: { value: requiredArea, unit: 'm2' },
    citation: 'Judd (2011) The MBR Book Ch. 3 / WWTP Design.xlsm sheet 7',
  },
  {
    label: 'Air scour demand',
    symbol: 'Q_air',
    equation: 'Q_air = (A × 12.5 / 1000) × 60',
    inputs: {
      A: { value: installedArea, unit: 'm2', source: 'installed membrane area' },
    },
    result: { value: airScour_Nm3_h, unit: 'Nm³/hr' },
    citation: 'Megavision SMU air scour specification 2025',
  },
];
```

**Step 4: Register and commit**

Two output handles: `permeate` (main effluent) and `reject` (returned to aerobic reactor or wasted).

Expected after commit: **~90 passing**.
Commit message: `Add MBR unit with membrane sizing, air scour energy, BoQ, records`

---

### Task 6: Implement `AerationBlower` unit

**Files:**
- Create: `packages/sim-engine/src/units/aeration-blower.ts`
- Modify: `packages/sim-engine/src/units/index.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

**Context:** Utility unit with no water quality stream. The engineer enters the O₂ demand (kgO/day) from the aerobic bioreactor's calc record as a parameter. The blower sizes itself: required air flow → installed kW → supplier price bucket (PD blower for small, HST turbo for large).

**Design equations:** (from `WWTP Design.xlsm` sheet 6)
- `Q_air_Am3_h = O2_kg_d × 1000 / (0.21 × 1.421 × OTE × 24)`
- OTE (overall transfer efficiency in process water): ~0.08 for fine bubble at 4 m depth with typical α/β/Ω corrections
- Blower kW: `P = Q_air × ΔP / (η_blower × 60)` where ΔP ≈ 0.06 MPa for 4 m depth + losses
- Small: PD blower (R180k per unit)
- Large: HST turbo (R1.2M per unit) — threshold ~50 kW

**Supplier prices (inline):**
```typescript
const PD_BLOWER_ZAR = 180000;        // PD blower 15-37 kW class
const HST_TURBO_ZAR = 1200000;       // HST turbo 50-250 kW class
const HST_THRESHOLD_KW = 50;
```

**Step 1: Write failing test**

```typescript
import { AerationBlower } from '../src/units/aeration-blower';

describe('AerationBlower', () => {
  it('computes air flow from O2 demand', () => {
    const unit = new AerationBlower({ o2_demand_kg_per_day: 500, ote: 0.08, diffuser_depth_m: 4.5 });
    const r = unit.process([]);
    // Q_air = 500 * 1000 / (0.21 * 1.421 * 0.08 * 24) ≈ 8720 Am³/hr (roughly)
    expect(r.sizing?.airFlow.value).toBeGreaterThan(500);
    expect(r.sizing?.airFlow.value).toBeLessThan(20000);
  });

  it('picks PD blower for small demand', () => {
    const unit = new AerationBlower({ o2_demand_kg_per_day: 80, ote: 0.08, diffuser_depth_m: 4.5 });
    const r = unit.process([]);
    const mech = r.capex!.lineItems.find(i => i.category === 'mechanical');
    expect(mech!.description.toLowerCase()).toContain('pd');
  });

  it('picks HST turbo for large demand', () => {
    const unit = new AerationBlower({ o2_demand_kg_per_day: 2000, ote: 0.08, diffuser_depth_m: 4.5 });
    const r = unit.process([]);
    const mech = r.capex!.lineItems.find(i => i.category === 'mechanical');
    expect(mech!.description.toLowerCase()).toContain('hst');
  });

  it('emits energy records and BoQ with citation', () => {
    const unit = new AerationBlower({ o2_demand_kg_per_day: 500, ote: 0.08, diffuser_depth_m: 4.5 });
    const r = unit.process([]);
    expect(r.energy?.installedKW).toBeGreaterThan(0);
    expect(r.energy?.dailyKWh).toBeGreaterThan(0);
    assertHasCalculationRecord(r.calculationRecords, 'air flow');
    assertHasCalculationRecord(r.calculationRecords, 'blower power');
    assertAllRecordsValid(r.calculationRecords);
  });
});
```

**Step 2: Create `aeration-blower.ts`**

Key implementation:
```typescript
const o2 = Math.max(0, p.o2_demand_kg_per_day ?? 0);
const ote = Math.max(0.05, Math.min(0.15, p.ote ?? 0.08));
const depth = p.diffuser_depth_m ?? 4.5;

// Air flow required (Am³/hr)
const q_air = (o2 * 1000) / (0.21 * 1.421 * ote * 24);

// Delta P: static (depth) + losses
const deltaP_kPa = depth * 9.81 + 15;   // ~10 kPa/m + 15 kPa losses
const deltaP_Pa = deltaP_kPa * 1000;

// Blower kW (isothermal approximation)
const eta = 0.72;
const installedKW = (q_air * deltaP_Pa) / (3600 * 1000 * eta);
const dailyKWh = installedKW * 24;

const isHst = installedKW > HST_THRESHOLD_KW;
const blowerUnitPrice = isHst ? HST_TURBO_ZAR : PD_BLOWER_ZAR;
const blowerDescription = isHst
  ? 'HST turbo blower (Sulzer/APG Neuros class)'
  : 'PD blower (Aerzen/WEG class)';

base.sizing = {
  airFlow: { value: q_air, unit: 'Am³/hr' },
  deltaP: { value: deltaP_kPa, unit: 'kPa' },
};
base.energy = {
  installedKW,
  dailyKWh,
  records: [
    {
      label: 'Blower shaft power',
      symbol: 'P',
      equation: 'P = Q_air × ΔP / (η × 3600 × 1000)',
      inputs: {
        Q_air: { value: q_air, unit: 'Am³/hr', source: 'calculated air flow' },
        dP: { value: deltaP_Pa, unit: 'Pa', source: 'depth + losses' },
        eta: { value: eta, unit: '', source: 'blower efficiency' },
      },
      result: { value: installedKW, unit: 'kW' },
      citation: 'ASCE 2-06 / isothermal compression',
    },
  ],
};
base.capex = {
  lineItems: [
    { category: 'mechanical', description: blowerDescription, quantity: 1, unit: 'ea', unitPriceZar: blowerUnitPrice, sourceCitation: isHst ? 'Sulzer HST / APG Neuros catalogue 2025' : 'Aerzen / WEG SA distributor 2025' },
  ],
  total: blowerUnitPrice,
};
base.calculationRecords = [
  {
    label: 'Required air flow',
    symbol: 'Q_air',
    equation: 'Q_air = O2 × 1000 / (0.21 × 1.421 × OTE × 24)',
    inputs: {
      O2: { value: o2, unit: 'kgO/d', source: 'user input from aerobic reactor' },
      OTE: { value: ote, unit: '', source: 'overall transfer efficiency in process water' },
    },
    result: { value: q_air, unit: 'Am³/hr' },
    citation: 'ASCE 2-06 / WWTP Design.xlsm sheet 6',
  },
  {
    label: 'Blower power',
    symbol: 'P',
    equation: 'P = Q_air × ΔP / (η × 3600 × 1000)',
    inputs: {
      Q_air: { value: q_air, unit: 'Am³/hr', source: 'air flow' },
      dP: { value: deltaP_kPa, unit: 'kPa', source: 'depth + losses' },
      eta: { value: eta, unit: '', source: '72% typical' },
    },
    result: { value: installedKW, unit: 'kW' },
    citation: 'Metcalf & Eddy (2014) Ch. 5 — blower sizing',
  },
];

return { outputs: {}, metadata: { installedKW, q_air }, ...base };
```

**Note:** The blower has no input or output water streams. `outputs` is empty. This is valid — the graph simulator will treat it as a sink node with no downstream edges.

**Step 3: Register and commit**

Expected after commit: **~94 passing**.
Commit message: `Add AerationBlower unit with air flow sizing, kW calc, PD/HST BoQ selection`

---

### Task 7: Implement `Dewatering` unit

**Files:**
- Create: `packages/sim-engine/src/units/dewatering.ts`
- Modify: `packages/sim-engine/src/units/index.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

**Context:** Takes thickened sludge (3–6% solids) and produces dewatered cake (18–25% for belt press, 22–30% for centrifuge) + filtrate/centrate (back to plant inlet). Two variants via `dewatering_type` param: 0 = belt press, 1 = centrifuge.

**Design equations:**
- Solids loading: `SL_kg_h = Q_sludge × TSS / (1000 × 24)` kg/h
- Belt press capacity: 200–400 kg DS/m width·h → width = SL / 300
- Centrifuge capacity: matched to model (5, 10, 25 m³/h)
- Polymer dose: 4–8 kg/tonne DS (dry solids)
- Cake solids: belt press 20%, centrifuge 25%

**Supplier prices (inline):**
```typescript
const BELT_PRESS_ZAR = 850000;       // 1 m width, small
const CENTRIFUGE_ZAR = 2200000;      // 5 m³/h decanter
const POLYMER_ZAR_PER_KG = 65;       // dry cationic polymer
const CAKE_DISPOSAL_ZAR_PER_TONNE = 350;   // landfill tipping fee
```

**Step 1: Write failing test**

```typescript
import { Dewatering } from '../src/units/dewatering';

describe('Dewatering', () => {
  it('produces cake at target solids concentration', () => {
    const unit = new Dewatering({ dewatering_type: 0, polymer_dose_kg_per_tds: 6 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 50, TSS: 50000 }]);  // 50 m³/d at 5% solids
    expect(r.outputs.cake.TSS).toBeGreaterThan(150000);   // ≥15%
  });

  it('returns filtrate with most water and some dissolved nutrients', () => {
    const unit = new Dewatering({ dewatering_type: 0, polymer_dose_kg_per_tds: 6 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 50, TSS: 50000 }]);
    expect(r.outputs.filtrate.flow).toBeGreaterThan(30);
    expect(r.outputs.filtrate.TSS).toBeLessThan(5000);
  });

  it('emits polymer consumable and cake disposal', () => {
    const unit = new Dewatering({ dewatering_type: 0, polymer_dose_kg_per_tds: 6 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 50, TSS: 50000 }]);
    expect(r.consumables?.find(c => /polymer/i.test(c.item))).toBeDefined();
    expect(r.consumables?.find(c => /cake|disposal/i.test(c.item))).toBeDefined();
  });

  it('picks centrifuge BoQ line when type=1', () => {
    const unit = new Dewatering({ dewatering_type: 1, polymer_dose_kg_per_tds: 6 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 50, TSS: 50000 }]);
    const mech = r.capex!.lineItems.find(i => /centrifuge/i.test(i.description));
    expect(mech).toBeDefined();
  });
});
```

**Step 2–4:** Create unit file with two-variant logic (belt press vs centrifuge), register, commit.

Expected after commit: **~98 passing**.
Commit message: `Add Dewatering unit (belt press / centrifuge) with polymer consumption and BoQ`

---

### Task 8: Implement `ChemicalDosing` unit

**Files:**
- Create: `packages/sim-engine/src/units/chemical-dosing.ts`
- Modify: `packages/sim-engine/src/units/index.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

**Context:** Configurable dosing unit for alum / ferric / polymer / lime / NaOH. Parameter `chemical_type` (0=alum, 1=ferric, 2=polymer, 3=lime, 4=NaOH) selects the chemistry. Each chemical has different stoichiometry, unit cost, and optional reaction with the water stream (e.g. alum/ferric remove P).

**Design equations:**
- Daily dose (kg/d): `D = dose_mg_L × Q / 1000`
- Tank size (m³): `V = D × storage_days / density`
- Metering pump: sized from peak dose rate × 2× safety

**Supplier prices (inline):**
```typescript
const METERING_PUMP_ZAR = 28000;      // Grundfos DDA / Prominent
const HDPE_TANK_ZAR_PER_M3 = 17500;   // 2 m³ ≈ R35k → ~R17.5k/m³
const CHEMICAL_PRICES_ZAR_PER_KG: Record<number, { name: string; price: number; density: number }> = {
  0: { name: 'Alum (Al2(SO4)3)', price: 8, density: 1.32 },
  1: { name: 'Ferric chloride', price: 12, density: 1.42 },
  2: { name: 'Cationic polymer', price: 65, density: 1.00 },
  3: { name: 'Hydrated lime', price: 4, density: 2.24 },
  4: { name: 'Caustic soda (50%)', price: 10, density: 1.52 },
};
```

**Step 1: Write failing test**

```typescript
import { ChemicalDosing } from '../src/units/chemical-dosing';

describe('ChemicalDosing', () => {
  it('computes daily chemical consumption from dose and flow', () => {
    const unit = new ChemicalDosing({ chemical_type: 0, dose_mg_per_L: 30, storage_days: 7 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 1000 }]);
    const chem = r.consumables?.find(c => /alum/i.test(c.item));
    expect(chem).toBeDefined();
    expect(chem!.daily).toBeCloseTo(30, 1);   // 30 mg/L × 1000 m³/d = 30 kg/d
  });

  it('applies P removal when chemical is coagulant (alum/ferric)', () => {
    const unit = new ChemicalDosing({ chemical_type: 0, dose_mg_per_L: 50, storage_days: 7 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 1000, TP: 10 }]);
    expect(r.outputs.out.TP).toBeLessThan(10);   // some P removal
  });

  it('emits metering pump + tank BoQ', () => {
    const unit = new ChemicalDosing({ chemical_type: 0, dose_mg_per_L: 30, storage_days: 7 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 1000 }]);
    expect(r.capex!.lineItems.find(i => /pump/i.test(i.description))).toBeDefined();
    expect(r.capex!.lineItems.find(i => /tank/i.test(i.description))).toBeDefined();
    assertHasCalculationRecord(r.calculationRecords, 'daily dose');
  });
});
```

**Step 2–4:** Implement chemistry lookup by `chemical_type`, apply TP reduction for alum/ferric (rough stoichiometry), pH increase for lime/NaOH, compute tank size and pump, emit BoQ, register, commit.

Expected after commit: **~102 passing**.
Commit message: `Add ChemicalDosing unit with 5 chemical types, stoichiometric P removal, BoQ`

---

### Task 9: Implement `UvDisinfection` unit

**Files:**
- Create: `packages/sim-engine/src/units/uv-disinfection.ts`
- Modify: `packages/sim-engine/src/units/index.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

**Context:** UV reactor sized by flow + required UV dose. Low-pressure high-output lamps typical. Simple design — lamp count from flow rating, power from lamp count × per-lamp wattage.

**Design equations:**
- Lamps required: `N = ceil(Q / Q_per_lamp)` where Q_per_lamp ≈ 200 m³/d/lamp (LP-HO, 40 mJ/cm² dose)
- Power: `P = N × 0.25 kW` (LP-HO typical)
- Operation: continuous → dailyKWh = P × 24
- Pass-through: reduces faecal coliforms to effectively 0 (not in WQ vector, so no change visible)

**Supplier prices (inline):**
```typescript
const UV_REACTOR_SMALL_ZAR = 285000;     // < 500 m³/d
const UV_REACTOR_MEDIUM_ZAR = 650000;    // 500-1500 m³/d
const UV_REACTOR_LARGE_ZAR = 1250000;    // 1500-5000 m³/d
const LP_HO_LAMP_KW = 0.25;
const Q_PER_LAMP_M3_D = 200;
```

**Step 1: Write failing test**

```typescript
import { UvDisinfection } from '../src/units/uv-disinfection';

describe('UvDisinfection', () => {
  it('sizes lamp count from flow', () => {
    const unit = new UvDisinfection({ required_dose_mj_cm2: 40 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 1000 }]);
    expect(r.sizing?.lampCount.value).toBe(5);   // 1000 / 200 = 5
    expect(r.energy?.installedKW).toBeCloseTo(5 * 0.25, 2);
  });

  it('picks larger reactor BoQ line for higher flow', () => {
    const small = new UvDisinfection({ required_dose_mj_cm2: 40 });
    const large = new UvDisinfection({ required_dose_mj_cm2: 40 });
    const rSmall = small.process([{ ...emptyWaterQuality(), flow: 400 }]);
    const rLarge = large.process([{ ...emptyWaterQuality(), flow: 3000 }]);
    expect(rLarge.capex!.total).toBeGreaterThan(rSmall.capex!.total);
  });

  it('passes flow through unchanged', () => {
    const unit = new UvDisinfection({ required_dose_mj_cm2: 40 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 1000, COD: 50 }]);
    expect(r.outputs.out.flow).toBe(1000);
    expect(r.outputs.out.COD).toBe(50);
  });
});
```

**Step 2–4:** Create unit, implement tiered BoQ selection by flow, register, commit.

Expected after commit: **~105 passing**.
Commit message: `Add UvDisinfection unit with lamp sizing, tiered reactor BoQ, kWh`

---

### Task 10: Implement `InletPumping` unit

**Files:**
- Create: `packages/sim-engine/src/units/inlet-pumping.ts`
- Modify: `packages/sim-engine/src/units/index.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

**Context:** Submersible centrifugal pump(s) lifting influent from wet well into headworks. Sized by flow + total dynamic head. Duty + standby.

**Design equations:**
- Hydraulic power: `P_hyd = Q × ρ × g × H / 3.6e6` kW (Q in m³/h, H in m, ρ=1000)
- Installed kW: `P_inst = P_hyd / η_pump` (η ≈ 0.65–0.75)
- Peak flow sizing: Q_peak = Q × peak_factor
- Number of pumps: duty + standby = 2 minimum

**Supplier prices (inline):**
```typescript
const PUMP_SMALL_ZAR = 35000;    // 7.5 kW class
const PUMP_MEDIUM_ZAR = 65000;   // 15 kW class
const PUMP_LARGE_ZAR = 95000;    // 22 kW class
// Wet well civil
const WET_WELL_ZAR_PER_M3 = 22000;
```

**Step 1: Write failing test**

```typescript
import { InletPumping } from '../src/units/inlet-pumping';

describe('InletPumping', () => {
  it('sizes kW from TDH and peak flow', () => {
    const unit = new InletPumping({ tdh_m: 10, pump_efficiency: 0.7, peak_factor: 2.5 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 1000 }]);
    // Q_peak = 2500 m³/d ≈ 104 m³/h; P_hyd = 104 × 1000 × 9.81 × 10 / 3.6e6 ≈ 2.84 kW; P_inst ≈ 4 kW
    expect(r.energy?.installedKW).toBeGreaterThan(3);
    expect(r.energy?.installedKW).toBeLessThan(6);
  });

  it('includes duty + standby in BoQ (quantity = 2)', () => {
    const unit = new InletPumping({ tdh_m: 10, pump_efficiency: 0.7, peak_factor: 2.5 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 1000 }]);
    const pumps = r.capex!.lineItems.find(i => /pump/i.test(i.description));
    expect(pumps).toBeDefined();
    expect(pumps!.quantity).toBe(2);
  });

  it('passes water quality through unchanged', () => {
    const unit = new InletPumping({ tdh_m: 10, pump_efficiency: 0.7, peak_factor: 2.5 });
    const r = unit.process([{ ...emptyWaterQuality(), flow: 1000, COD: 600 }]);
    expect(r.outputs.out.COD).toBe(600);
  });
});
```

**Step 2–4:** Create unit, register, commit.

Expected after commit: **~108 passing**.
Commit message: `Add InletPumping unit with TDH + kW calc, duty+standby BoQ, wet well civil`

---

### Task 11: Full-plant integration test

**Files:**
- Modify: `packages/sim-engine/tests/simulator.test.ts`

**Context:** Run a complete plant train using several new units end-to-end and assert the total CapEx, total installed kW, and aggregate calc record count all exceed sensible thresholds.

**Suggested train:**
```
InletPumping → Screen (fine) → GritRemoval → EqualisationTank → PrimaryClarifier →
BioreactorAnoxic ↘                                                                  ↗ BioreactorAerobic → SecondaryClarifier → UvDisinfection → Effluent
               ↗ (a-recycle)
(underflow WAS) → Thickener → Dewatering → [filtrate back to EQ]

Side units (no graph edges): AerationBlower (configured with aerobic O2 demand)
                              ChemicalDosing (for P removal, configured upstream of secondary clarifier)
```

**Step 1: Add the integration test**

```typescript
describe('Full plant with Phase 2 units', () => {
  it('runs end-to-end with non-zero totals from every category', () => {
    // Build a minimal plant graph with ~8 unit types including 4+ Phase 2 units.
    // Use the existing buildGraph helper / graph type from simulator.ts.
    const graph = buildFullPlantFixture();   // define inline if no existing helper
    const results = simulate(graph);

    let totalCapex = 0;
    let totalKW = 0;
    let totalRecords = 0;
    let categoriesSeen = new Set<string>();
    for (const nodeResult of Object.values(results.nodeResults)) {
      const r = nodeResult as any;
      if (r.capex?.total) totalCapex += r.capex.total;
      if (r.energy?.installedKW) totalKW += r.energy.installedKW;
      if (r.calculationRecords) totalRecords += r.calculationRecords.length;
      r.capex?.lineItems?.forEach((i: any) => categoriesSeen.add(i.category));
    }

    expect(totalCapex).toBeGreaterThan(5_000_000);   // full plant ≥ R5m
    expect(totalKW).toBeGreaterThan(10);              // more than just mixers
    expect(totalRecords).toBeGreaterThan(30);
    expect(categoriesSeen.has('civil')).toBe(true);
    expect(categoriesSeen.has('mechanical')).toBe(true);
  });
});
```

**Step 2: Run and commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **~109 passing**.

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add packages/sim-engine/tests/simulator.test.ts && \
git commit -m "Add full-plant integration test with Phase 2 new units"
```

---

### Task 12: Final verification

**Step 1: Full test suite**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **~109 passing** (target range 105–115).

**Step 2: Type check**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx tsc --noEmit
```
Expected: Zero errors.

**Step 3: Web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean build. The new unit types will appear in the React Flow palette as generic nodes (Phase 5 adds custom icons).

**Step 4: Review branch commits**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && git log --oneline main..HEAD | head -40
```
Expected: Phase 1a + Phase 1b + ~12 new Phase 2 commits.

---

### Task 13: Phase 2 completion summary

**Files:**
- Create: `docs/plans/2026-04-02-aquasim-v2-phase-2-COMPLETE.md`

**Step 1: Write summary**

```markdown
# Phase 2 Complete — Nine New Unit Models

**Completed:** YYYY-MM-DD
**Branch:** v2-proposal-generator
**Commits:** ~12 (see `git log main..HEAD`)

## What shipped
- 9 new unit types in `UnitType` union
- 9 new unit files under `packages/sim-engine/src/units/`:
  - `screen.ts` (coarse + fine variants)
  - `grit-removal.ts`
  - `equalisation-tank.ts`
  - `mbr.ts`
  - `aeration-blower.ts`
  - `dewatering.ts` (belt press + centrifuge variants)
  - `chemical-dosing.ts` (5 chemical types)
  - `uv-disinfection.ts`
  - `inlet-pumping.ts`
- Each unit registered in `units/index.ts` (createUnit + unitDefinitions)
- ~109 passing tests (up from 74 at start of Phase 2)
- Web build clean

## Deferred (not this phase)
- Custom React Flow node icons and inspector UIs → Phase 5 (UI overhaul)
- Auto-linking the aerobic reactor's O2 demand into the blower config → later
- Extract inline supplier prices to `packages/design-library` → Phase 3

## Next: Phase 3
BoQ engine: aggregate line items across the whole flowsheet, group by category,
apply project overrides, compute totals. Extract inline supplier prices from
individual unit files into `packages/design-library/supplier-prices.ts`.

Draft plan: `docs/plans/YYYY-MM-DD-aquasim-v2-phase-3-boq-engine.md`
```

**Step 2: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add docs/plans/2026-04-02-aquasim-v2-phase-2-COMPLETE.md && \
git commit -m "Phase 2 complete — 9 new unit models added"
```

---

## Summary of commits expected for Phase 2

| # | Task | Commit message |
|---|---|---|
| 0 | Baseline verify | (no commit) |
| 1 | UnitType extension | `Extend UnitType union with 9 new Phase 2 unit types (stubs)` |
| 2 | Screen | `Add Screen unit (coarse/fine variants) with sizing, BoQ, records` |
| 3 | GritRemoval | `Add GritRemoval unit with sizing, energy, BoQ, records` |
| 4 | EqualisationTank | `Add EqualisationTank unit with sizing, mixing energy, BoQ, records` |
| 5 | MBR | `Add MBR unit with membrane sizing, air scour energy, BoQ, records` |
| 6 | AerationBlower | `Add AerationBlower unit with air flow sizing, kW calc, PD/HST BoQ selection` |
| 7 | Dewatering | `Add Dewatering unit (belt press / centrifuge) with polymer consumption and BoQ` |
| 8 | ChemicalDosing | `Add ChemicalDosing unit with 5 chemical types, stoichiometric P removal, BoQ` |
| 9 | UvDisinfection | `Add UvDisinfection unit with lamp sizing, tiered reactor BoQ, kWh` |
| 10 | InletPumping | `Add InletPumping unit with TDH + kW calc, duty+standby BoQ, wet well civil` |
| 11 | Integration test | `Add full-plant integration test with Phase 2 new units` |
| 13 | Completion summary | `Phase 2 complete — 9 new unit models added` |

Total: ~12 commits on top of Phase 1b, **~109 passing tests**, clean build, branch ready for Phase 3.

---

## Quick reference — unit I/O shapes

| Unit | Input handles | Output handles | Notes |
|---|---|---|---|
| `screen` | `in` | `out` | Pass-through WQ, slight TSS removal |
| `grit_removal` | `in` | `out` | Pass-through WQ, 5–10% TSS removal |
| `equalisation_tank` | `in` | `out` | Pass-through WQ (steady state), adds BoQ + mixing kW |
| `mbr` | `in` | `permeate`, `reject` | Replaces secondary clarifier in MBR trains |
| `aeration_blower` | — | — | Utility node with no water streams |
| `dewatering` | `in` | `cake`, `filtrate` | Cake to disposal, filtrate recycled |
| `chemical_dosing` | `in` | `out` | Applies dose-dependent WQ changes |
| `uv_disinfection` | `in` | `out` | Pass-through WQ (coliforms not tracked) |
| `inlet_pumping` | `in` | `out` | Pass-through WQ, adds kW + BoQ |

## Engineering design rules of thumb used in Phase 2

| Unit | Parameter | Value | Source |
|---|---|---|---|
| Screen | Approach velocity (peak) | ≤ 0.9 m/s | Metcalf & Eddy Ch. 5 |
| Screen | Fine screenings | 15 L/ML | M&E / Huber typical |
| Screen | Coarse screenings | 40 L/ML | M&E typical |
| Grit | HRT (peak) | 3–5 min | M&E Ch. 5 |
| Grit | Air supply | ~0.05 kW / (m³/h air) | M&E aerated grit |
| EQ tank | HRT | 4–12 h typical | M&E Ch. 5 |
| EQ tank | Mixing power | ~5 W/m³ | M&E |
| MBR | Flux (design) | 18.4 L/m²/h | Megavision / WWTP Design.xlsm |
| MBR | Operational fraction | 0.8 | Typical duty cycle |
| MBR | Air scour | 12.5 × A / 1000 × 60 Nm³/hr | Megavision formula |
| MBR | Module area | 64 m² / SMU | Megavision SMU |
| Blower | OTE (process water) | 0.08 | ASCE 2-06 w/ α β Ω F |
| Blower | ΔP | 10 kPa/m + 15 kPa losses | M&E Ch. 5 |
| Blower | η | 0.72 | Typical PD/HST |
| Blower | HST threshold | > 50 kW → turbo | Supplier ranges |
| Dewatering | Belt press cake solids | 20% | Andritz SMX typical |
| Dewatering | Centrifuge cake solids | 25% | Alfa Laval decanter typical |
| Dewatering | Polymer dose | 4–8 kg/tonne DS | M&E Ch. 14 |
| UV | Required dose | 40 mJ/cm² | USEPA UVDGM 2006 |
| UV | Flow per LP-HO lamp | ~200 m³/d | Xylem Wedeco typical |
| UV | Lamp power | 0.25 kW | LP-HO typical |
| Inlet pump | TDH | 5–15 m typical | Wet well lift |
| Inlet pump | η | 0.65–0.75 | Grundfos SE range |
| Inlet pump | Duty + standby | 1 + 1 minimum | SA water industry standard |
