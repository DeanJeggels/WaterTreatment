# Andrew Treatment Rework Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rework AquaSim treatment design to match Andrew's feedback: add an aerobic-bioreactor IMLR recycle output, auto-derive blower sizing from the connected aerobic reactor, slim per-unit inputs to the few that matter (rest defaulted from SA-typical / Ekama / Metcalf-Eddy via `@repo/design-library`), and surface a Design Summary at the top of the inspector covering MBR size, blower size, reactor sizes, buffer tank size, residence times, and final effluent quality.

**Architecture:** The simulation engine already supports recycle loops (DFS back-edge detection at `packages/sim-engine/src/graph/topological-sort.ts:37-65` + iterative convergence at `packages/sim-engine/src/graph/simulator.ts:50-115`). The fixes are surgical:
1. Add a new `imlr` output handle on the aerobic reactor with a built-in `imlr_ratio` parameter so the recycle is part of the unit, not a manual Splitter wiring.
2. Extend the blower's `process()` signature to read upstream node metadata (the aerobic reactor's already-computed `O2_demand_total`) — driven by a new `auto_size_from` field on the unit.
3. Add an `advanced: boolean` flag to `ParameterField` (`packages/sim-engine/src/types.ts`), have the inspector hide non-essential params behind a "Show advanced" disclosure, and re-tag every existing parameter as essential or advanced.
4. Build a `DesignSummarySection` component that pulls together the headline numbers from all sized units (MBR area, blower kW, reactor volumes, HRTs, effluent quality from the discharge node) and renders it above Configuration in the inspector — visible whenever the influent or a discharge node is selected.

**Tech Stack:** TypeScript, Vitest (existing test runner — `packages/sim-engine/tests/`), React/Next.js for the inspector UI (`apps/web/components/inspector/`), `@repo/sim-engine` and `@repo/design-library` workspace packages.

**Conventions:**
- Always run from repo root unless stated: `/Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/`.
- Test command: `npx turbo run test --filter=@repo/sim-engine` (or `cd packages/sim-engine && npx vitest run` for a single file).
- Dev server: `npx turbo run dev --filter=web` → `http://localhost:3000`.
- Commit style: `feat:` / `fix:` / `refactor:` prefix, single-sentence description, no trailing summary paragraph. **Do not** add Co-Authored-By trailers in this plan's commits (Andrew is the reviewer, not Claude).
- Andrew's "Excel sheet" reference for slimmed inputs has not been provided. Where the spec is ambiguous, default to the WWTP Design.xlsm citations already in the code (e.g. `aeration-blower.ts:96 — "WWTP Design.xlsm sheet 6"`) and SA-typical figures from `@repo/design-library`. If Dean later shares the sheet, this is the place to revise.

---

## Task 0: Confirm baseline

**Files:** none modified — verification only.

**Step 1: Confirm tests pass on main**

Run: `cd packages/sim-engine && npx vitest run`
Expected: All 134 tests PASS (per `project_aquasim_v2_shipped` memory and `2026-04-15-aquasim-v2-phase-9-COMPLETE.md`). If anything fails, stop and flag — the plan assumes a green baseline.

**Step 2: Confirm dev server boots and the flowsheet loads**

Run: `cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run dev --filter=web`
Open http://localhost:3000, sign in, open any project's flowsheet, drag in an Influent + Aerobic Bioreactor + MBR + Effluent, click each to confirm the inspector renders parameters and Sizing/Energy/Calc-Records sections.
Expected: Renders cleanly, no console errors. Stop the dev server (Ctrl-C) before continuing.

**Step 3: Create a working branch**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone
git switch -c andrew-treatment-rework
gh auth switch -u DeanJeggels  # per project_aquasim_v2_shipped: pushes go through DeanJeggels, not deancorserv
```
Expected: New branch `andrew-treatment-rework` checked out off `main`.

---

## Task 1: Add IMLR recycle handle to the aerobic bioreactor

The current aerobic bioreactor has only `in` and `out` (`packages/sim-engine/src/units/bioreactor-aerobic.ts:25-28`). To denitrify, the user has to manually add a Splitter after the aerobic and wire one branch back to the anoxic — Andrew called this confusing. We bake the recycle into the unit: add a third output handle `imlr` that carries a configurable fraction of the reactor outflow back upstream. The flowsheet edge from `aerobic.imlr → anoxic.in` becomes a back-edge that the existing solver handles via `topological-sort.ts:37-65` and `simulator.ts:32-115`.

**Files:**
- Modify: `packages/sim-engine/src/units/bioreactor-aerobic.ts` (handles, parameterSchema, process())
- Modify: `packages/sim-engine/tests/units.test.ts` (the existing `BioreactorAerobic` describe block — find with `grep -n "describe.*BioreactorAerobic" tests/units.test.ts`)

**Step 1: Write failing test for the IMLR output**

Append a new `it()` inside the existing `BioreactorAerobic` describe block:

```typescript
it('emits an imlr output stream sized by imlr_ratio × inlet flow', () => {
  const unit = new BioreactorAerobic({
    volume: 5000,
    srt: 12,
    do_setpoint: 2.0,
    yield_obs: 0.45,
    nitrification_eff: 95,
    cod_removal_eff: 90,
    bod_removal_eff: 95,
    kd: 0.06,
    depth: 4.5,
    imlr_ratio: 4, // 4× internal mixed liquor recycle (typical for BNR)
  });
  const inf = { ...emptyWaterQuality(), flow: 1000, COD: 500, sCOD: 200, BOD5: 250, TKN: 40, NH3N: 25, TSS: 250, VSS: 200, temperature: 20, pH: 7.2, alkalinity: 5 };
  const r = unit.process([inf]);

  expect(r.outputs.out).toBeDefined();
  expect(r.outputs.imlr).toBeDefined();
  // IMLR flow = 4 × inlet
  expect(r.outputs.imlr!.flow).toBeCloseTo(4000, 0);
  // Both streams carry the SAME concentrations as the reactor (it's an internal split, not separation)
  expect(r.outputs.imlr!.NO3N).toBeCloseTo(r.outputs.out!.NO3N, 3);
  expect(r.outputs.imlr!.TSS).toBeCloseTo(r.outputs.out!.TSS, 3);
  // Main "out" still carries the inlet flow (mass balance: out = inlet, imlr is recycle to be subtracted upstream)
  expect(r.outputs.out!.flow).toBeCloseTo(1000, 0);
});
```

**Step 2: Run the test — confirm it fails**

Run: `cd packages/sim-engine && npx vitest run tests/units.test.ts -t "emits an imlr"`
Expected: FAIL — `r.outputs.imlr` is undefined.

**Step 3: Add the IMLR handle + parameter + outflow**

Edit `packages/sim-engine/src/units/bioreactor-aerobic.ts`:

3a. Add to `parameterSchema` (lines 8-18) — append after `kd`:
```typescript
{ key: 'imlr_ratio', label: 'IMLR Ratio (a)', unit: '× Q_in', min: 0, max: 8, step: 0.5, defaultValue: 4, description: 'Internal mixed liquor recycle from aerobic back to anoxic. 4× is typical for BNR. Set to 0 to disable.' },
```

3b. Add to `handles` (lines 25-28) — replace the array with:
```typescript
handles: [
  { id: 'in', label: 'Inflow', position: 'left', type: 'input' },
  { id: 'out', label: 'Outflow', position: 'right', type: 'output' },
  { id: 'imlr', label: 'IMLR (recycle)', position: 'top', type: 'output' },
],
```

3c. In `process()`, after the `output: WaterQuality = { ... }` block (around line 110), build the IMLR stream:
```typescript
const imlrRatio = p.imlr_ratio ?? 4;
const imlr: WaterQuality = { ...output, flow: inf.flow * imlrRatio };
```

3d. Change the return at the bottom to include `imlr`:
```typescript
return {
  outputs: { out: output, imlr },
  metadata: { ... existing keys ..., IMLR_ratio: imlrRatio, IMLR_flow: inf.flow * imlrRatio },
  ...base,
};
```

**Step 4: Run the test — confirm it passes**

Run: `cd packages/sim-engine && npx vitest run tests/units.test.ts -t "emits an imlr"`
Expected: PASS.

**Step 5: Run the full sim-engine suite to confirm nothing else broke**

Run: `cd packages/sim-engine && npx vitest run`
Expected: All previously-passing tests still PASS. (Other aerobic tests should still work — they don't assert on output handle count.)

**Step 6: Commit**

```bash
git add packages/sim-engine/src/units/bioreactor-aerobic.ts packages/sim-engine/tests/units.test.ts
git commit -m "feat(aerobic): add IMLR recycle output handle to bioreactor"
```

---

## Task 2: Auto-derive blower O₂ demand from connected aerobic reactor

Currently `aeration-blower.ts:8` exposes `o2_demand_kg_per_day` as a manual user-typed parameter, even though the aerobic reactor already computes it (`bioreactor-aerobic.ts:113` → `O2_demand_total` in metadata). Andrew called this confusing. We wire the blower to auto-read the upstream aerobic node's metadata when the user connects them.

Implementation choice: the cleanest change is to keep the blower as a "no-water-handles" sidecar unit (already correct — `aeration-blower.ts:18` has empty `handles`) but give it ONE new input handle `aerobic_link` (data-only, not a water stream) so the user explicitly draws an edge from the aerobic reactor's `out` to the blower's `aerobic_link`. The simulator already iterates nodes in topological order and pre-computes the aerobic result before the blower runs — so we just need the blower's `process()` to look up the upstream node's stored metadata.

Since `process(inputs: WaterQuality[])` only receives water streams, we extend the simulator pass to also forward the **incoming node's metadata** to downstream units. Concretely: add a second optional argument to `process()` and update the simulator to populate it.

**Files:**
- Modify: `packages/sim-engine/src/types.ts` (`ProcessUnit.process` signature)
- Modify: `packages/sim-engine/src/graph/simulator.ts` (pass upstream metadata)
- Modify: `packages/sim-engine/src/units/aeration-blower.ts` (handle, parameter schema, process)
- Modify: `packages/sim-engine/tests/units.test.ts` (existing AerationBlower tests — `grep -n "describe.*AerationBlower\|describe.*Blower" tests/units.test.ts`)
- Modify: `packages/sim-engine/tests/simulator.test.ts` (add: blower auto-pulls from upstream aerobic)

**Step 1: Extend the ProcessUnit interface**

In `packages/sim-engine/src/types.ts`, find the `ProcessUnit` interface (grep: `grep -n "interface ProcessUnit" packages/sim-engine/src/types.ts`). Change `process` from:
```typescript
process(inputs: WaterQuality[]): ProcessResult;
```
to:
```typescript
process(inputs: WaterQuality[], upstreamContext?: UpstreamContext): ProcessResult;
```
And add the type just above:
```typescript
export interface UpstreamContext {
  /** Metadata from each upstream node, keyed by the source handle id of the edge into this unit. */
  nodeMetadata: Record<string, Record<string, unknown>>;
}
```

**Step 2: Pass upstream metadata in the simulator**

In `packages/sim-engine/src/graph/simulator.ts:67-73`, just below where `inputs` is gathered, build the context:
```typescript
// Build upstream context: for each incoming edge, look up the source node's already-computed metadata
const upstreamContext: UpstreamContext = { nodeMetadata: {} };
for (const e of incomingEdges) {
  const sourceResult = nodeResults.get(e.source);
  if (sourceResult?.metadata) {
    upstreamContext.nodeMetadata[e.targetHandle] = sourceResult.metadata;
  }
}

const result = unit.process(inputs, upstreamContext);
```
Add `UpstreamContext` to the import at line 1.

**Step 3: Write failing test for blower auto-derivation**

In `tests/simulator.test.ts`, add a new test in the existing `describe('simulate', …)` block:

```typescript
it('blower auto-derives O2 demand from the connected aerobic reactor', () => {
  const nodes: GraphNode[] = [
    { id: 'inf', type: 'influent', data: { unitType: 'influent', parameters: { flow: 1000, COD: 500, sCOD: 200, BOD5: 250, TKN: 40, NH3N: 25, TSS: 250, VSS: 200, pH: 7.2, alkalinity: 5, temperature: 20 } } },
    { id: 'aer', type: 'bioreactor_aerobic', data: { unitType: 'bioreactor_aerobic', parameters: { volume: 5000, srt: 12, do_setpoint: 2, yield_obs: 0.45, nitrification_eff: 95, cod_removal_eff: 90, bod_removal_eff: 95, kd: 0.06, depth: 4.5, imlr_ratio: 0 } } },
    { id: 'blw', type: 'aeration_blower', data: { unitType: 'aeration_blower', parameters: { ote: 0.08, diffuser_depth_m: 4.5 } } }, // NB: no o2_demand_kg_per_day — comes from upstream
  ];
  const edges: GraphEdge[] = [
    { id: 'e1', source: 'inf', target: 'aer', sourceHandle: 'out', targetHandle: 'in' },
    { id: 'e2', source: 'aer', target: 'blw', sourceHandle: 'out', targetHandle: 'aerobic_link' },
  ];

  const r = simulate(nodes, edges);

  expect(r.converged).toBe(true);
  const aerMeta = r.nodeResults['aer'].metadata;
  const blwMeta = r.nodeResults['blw'].metadata;
  // Blower should pick up the aerobic's total O2 demand and convert it to an air flow & kW > 0
  expect(blwMeta.o2_used_kg_per_day).toBeCloseTo(aerMeta.O2_demand_total * 1000 / 1000, 1); // expressed kg/d
  expect(blwMeta.installedKW).toBeGreaterThan(0);
});
```

**Step 4: Run the test — confirm it fails**

Run: `cd packages/sim-engine && npx vitest run tests/simulator.test.ts -t "blower auto-derives"`
Expected: FAIL (blower currently reads its own param, ignores upstream).

**Step 5: Add the input handle + auto-derivation to the blower**

Edit `packages/sim-engine/src/units/aeration-blower.ts`:

5a. Change `handles: []` (line 18) to:
```typescript
handles: [
  { id: 'aerobic_link', label: 'O₂ demand link', position: 'left', type: 'input' },
],
```

5b. Reorder `parameterSchema` (lines 7-11) so manual O₂ becomes an advanced fallback. Mark it advanced (see Task 3 for the `advanced` flag; for now just reorder so OTE + depth come first):
```typescript
const parameterSchema: ParameterField[] = [
  { key: 'ote', label: 'Overall transfer efficiency', unit: '', min: 0.05, max: 0.15, step: 0.005, defaultValue: 0.08 },
  { key: 'diffuser_depth_m', label: 'Diffuser submergence', unit: 'm', min: 2, max: 8, step: 0.5, defaultValue: 4.5 },
  { key: 'o2_demand_kg_per_day', label: 'O₂ demand (manual override)', unit: 'kgO/d', min: 0, max: 20000, step: 10, defaultValue: 0, description: 'Leave at 0 to auto-pull from the connected aerobic reactor.' },
];
```

5c. In `process()`, replace the first line that reads `o2` (around line 30) with:
```typescript
process(_inputs: WaterQuality[], upstreamContext?: UpstreamContext): ProcessResult {
  const p = this.parameters;
  const manualO2 = Math.max(0, p.o2_demand_kg_per_day ?? 0);
  const upstreamMeta = upstreamContext?.nodeMetadata?.aerobic_link;
  const upstreamO2_mgPerL = typeof upstreamMeta?.O2_demand_total === 'number' ? upstreamMeta.O2_demand_total : 0;
  const upstreamFlow = typeof upstreamMeta?.flow_for_O2 === 'number' ? upstreamMeta.flow_for_O2 : 0;
  const upstreamO2_kgPerD = (upstreamO2_mgPerL * upstreamFlow) / 1000;
  const o2 = manualO2 > 0 ? manualO2 : upstreamO2_kgPerD;
```
And add `UpstreamContext` to the import at line 1.

5d. Also: surface the used O₂ in metadata at the return statement (line 113):
```typescript
return {
  outputs: {},
  metadata: { installedKW, q_air, o2_used_kg_per_day: o2, o2_source: manualO2 > 0 ? 'manual' : 'upstream_aerobic' },
  ...base,
};
```

5e. Now patch the aerobic reactor to also store `flow_for_O2` in its metadata so the blower has the conversion it needs. In `bioreactor-aerobic.ts:213-225` (the `metadata: { … }` block), add:
```typescript
flow_for_O2: inf.flow,
```

**Step 6: Run the simulator test — confirm it passes**

Run: `cd packages/sim-engine && npx vitest run tests/simulator.test.ts -t "blower auto-derives"`
Expected: PASS.

**Step 7: Run the full suite — confirm nothing else broke**

Run: `cd packages/sim-engine && npx vitest run`
Expected: All tests PASS. The existing AerationBlower tests use manual `o2_demand_kg_per_day` so they still work (manual overrides auto).

**Step 8: Commit**

```bash
git add packages/sim-engine/src/types.ts packages/sim-engine/src/graph/simulator.ts packages/sim-engine/src/units/aeration-blower.ts packages/sim-engine/src/units/bioreactor-aerobic.ts packages/sim-engine/tests/simulator.test.ts
git commit -m "feat(blower): auto-derive O2 demand from upstream aerobic reactor"
```

---

## Task 3: Add `advanced` flag to ParameterField and hide non-essentials behind disclosure

Andrew wants fewer inputs. Rather than delete parameters (which breaks calculation transparency Dean and his customers need), we mark each as essential or advanced, default to showing only essentials, and add a "Show advanced settings" disclosure in the inspector.

**Files:**
- Modify: `packages/sim-engine/src/types.ts` (extend `ParameterField`)
- Modify: `apps/web/components/inspector/InspectorPanel.tsx`
- Test (new): `packages/sim-engine/tests/parameter-field.test.ts`

**Step 1: Write failing test for the flag**

Create `packages/sim-engine/tests/parameter-field.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import type { ParameterField } from '../src/types';

describe('ParameterField', () => {
  it('supports an optional advanced flag', () => {
    const field: ParameterField = {
      key: 'kd', label: 'Decay Rate', unit: '1/d',
      min: 0, max: 1, step: 0.01, defaultValue: 0.06,
      advanced: true,
    };
    expect(field.advanced).toBe(true);
  });

  it('treats fields without the flag as essential (visible by default)', () => {
    const field: ParameterField = {
      key: 'volume', label: 'Volume', unit: 'm³',
      min: 100, max: 100000, step: 100, defaultValue: 5000,
    };
    expect(field.advanced).toBeUndefined();
  });
});
```

**Step 2: Run — confirm it fails**

Run: `cd packages/sim-engine && npx vitest run tests/parameter-field.test.ts`
Expected: TypeScript compile fail — `advanced` not a known property.

**Step 3: Add the flag**

In `packages/sim-engine/src/types.ts`, find the `ParameterField` interface (`grep -n "interface ParameterField" packages/sim-engine/src/types.ts`) and add:
```typescript
/** When true, hidden behind the inspector's "Show advanced" disclosure. */
advanced?: boolean;
```

**Step 4: Run — confirm it passes**

Run: `cd packages/sim-engine && npx vitest run tests/parameter-field.test.ts`
Expected: PASS.

**Step 5: Update inspector to honor the flag**

In `apps/web/components/inspector/InspectorPanel.tsx`:

5a. Add a state import near the existing imports (line 1):
```typescript
'use client';
import { useState } from 'react';
```

5b. Inside the component (after line 30 where `selectedNode` is computed), add:
```typescript
const [showAdvanced, setShowAdvanced] = useState(false);
```

5c. Replace the `.map((param) => …)` (lines 68-100) with a split rendering:
```typescript
{(() => {
  const essentials = def.parameterSchema.filter(p => !p.advanced);
  const advanceds = def.parameterSchema.filter(p => p.advanced);
  return (
    <>
      {essentials.map((param) => /* … same per-field block as before … */)}
      {advanceds.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowAdvanced(s => !s)}
            className="text-xs text-muted-foreground hover:text-foreground underline mt-2"
          >
            {showAdvanced ? 'Hide' : 'Show'} advanced settings ({advanceds.length})
          </button>
          {showAdvanced && advanceds.map((param) => /* … same per-field block … */)}
        </>
      )}
    </>
  );
})()}
```
Extract the per-field block into a local helper to avoid duplication — DRY:
```typescript
const renderField = (param: ParameterField) => (
  <div key={param.key} className="space-y-1">
    {/* … existing label + input … */}
  </div>
);
```

**Step 6: Manual UI verification**

Run: `cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run dev --filter=web`
Open the flowsheet → click any unit → confirm the Configuration section renders. For now no params are marked advanced so behaviour is identical. The disclosure only appears once Tasks 4-8 mark fields.
Expected: No visual regression. Stop the dev server.

**Step 7: Commit**

```bash
git add packages/sim-engine/src/types.ts packages/sim-engine/tests/parameter-field.test.ts apps/web/components/inspector/InspectorPanel.tsx
git commit -m "feat(inspector): support advanced-parameter disclosure"
```

---

## Task 4: Slim Influent inputs (14 → 3 essential)

Today's influent exposes all 14 water-quality components as user-typed numbers (`packages/sim-engine/src/units/influent.ts:4-19`). Most South African municipal/development sewage falls in a tight range, and the engineer only really needs to enter design flow + headline strength. Mark `flow`, `COD`, `TKN` as essential; everything else advanced.

**Files:**
- Modify: `packages/sim-engine/src/units/influent.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

**Step 1: Write failing test**

In the existing `describe('Influent', …)` block in `tests/units.test.ts` (find with `grep -n "describe.*Influent\b" tests/units.test.ts`), add:
```typescript
it('marks only flow / COD / TKN as essential, rest advanced', () => {
  const essential = influentDefinition.parameterSchema.filter(p => !p.advanced).map(p => p.key);
  expect(essential).toEqual(['flow', 'COD', 'TKN']);
});
```

**Step 2: Run — confirm it fails**

Run: `cd packages/sim-engine && npx vitest run tests/units.test.ts -t "marks only flow / COD / TKN"`
Expected: FAIL — all 14 currently essential.

**Step 3: Mark the schema**

In `packages/sim-engine/src/units/influent.ts:4-19`, replace the `parameterSchema` so the three above stay as-is and the remaining 11 get `advanced: true` appended. Example:
```typescript
{ key: 'sCOD', label: 'Soluble COD', unit: 'mg/L', min: 0, max: 1000, step: 10, defaultValue: 200, advanced: true },
```

**Step 4: Run — confirm it passes**

Run: `cd packages/sim-engine && npx vitest run tests/units.test.ts -t "marks only flow / COD / TKN"`
Expected: PASS.

**Step 5: Run full suite**

Run: `cd packages/sim-engine && npx vitest run`
Expected: All PASS.

**Step 6: Commit**

```bash
git add packages/sim-engine/src/units/influent.ts packages/sim-engine/tests/units.test.ts
git commit -m "refactor(influent): mark non-headline parameters as advanced"
```

---

## Task 5: Slim Aerobic inputs (10 → 2 essential)

Aerobic reactor currently has 10 params (9 + the new `imlr_ratio`). Essential set: `volume`, `srt`. Everything else (`depth`, `do_setpoint`, `yield_obs`, `nitrification_eff`, `cod_removal_eff`, `bod_removal_eff`, `kd`, `imlr_ratio`) → advanced.

**Files:**
- Modify: `packages/sim-engine/src/units/bioreactor-aerobic.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

**Step 1: Failing test in BioreactorAerobic describe block**
```typescript
it('marks only volume + SRT as essential, rest advanced', () => {
  const essential = bioreactorAerobicDefinition.parameterSchema.filter(p => !p.advanced).map(p => p.key);
  expect(essential).toEqual(['volume', 'srt']);
});
```

**Step 2: Run — confirm FAIL.** `npx vitest run tests/units.test.ts -t "marks only volume + SRT"`

**Step 3: Tag the schema** in `bioreactor-aerobic.ts:8-19` — append `advanced: true` to every field except `volume` and `srt`.

**Step 4: Run — confirm PASS.**

**Step 5: Run full suite — confirm green.**

**Step 6: Commit**
```bash
git add packages/sim-engine/src/units/bioreactor-aerobic.ts packages/sim-engine/tests/units.test.ts
git commit -m "refactor(aerobic): mark non-volume/SRT parameters as advanced"
```

---

## Task 6: Slim Anoxic inputs (4 → 1 essential)

Essential: `volume`. Advanced: `depth`, `denitrification_eff`, `cod_n_ratio`.

**Files:**
- Modify: `packages/sim-engine/src/units/bioreactor-anoxic.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

**Step 1: Failing test** in the BioreactorAnoxic describe block:
```typescript
it('marks only volume as essential, rest advanced', () => {
  const essential = bioreactorAnoxicDefinition.parameterSchema.filter(p => !p.advanced).map(p => p.key);
  expect(essential).toEqual(['volume']);
});
```

**Step 2-6:** Same pattern. Tag the three non-volume fields advanced in `bioreactor-anoxic.ts:8-13`. Run, confirm, commit:
```bash
git add packages/sim-engine/src/units/bioreactor-anoxic.ts packages/sim-engine/tests/units.test.ts
git commit -m "refactor(anoxic): mark non-volume parameters as advanced"
```

---

## Task 7: Slim MBR inputs (3 → 1 essential)

Essential: `flux_lmh`. Advanced: `operational_fraction`, `module_area_m2`.

**Files:**
- Modify: `packages/sim-engine/src/units/mbr.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

**Step 1: Failing test** in the MBR describe block:
```typescript
it('marks only flux as essential, rest advanced', () => {
  const essential = mbrDefinition.parameterSchema.filter(p => !p.advanced).map(p => p.key);
  expect(essential).toEqual(['flux_lmh']);
});
```

**Step 2-6:** Tag, run, commit:
```bash
git add packages/sim-engine/src/units/mbr.ts packages/sim-engine/tests/units.test.ts
git commit -m "refactor(mbr): mark non-flux parameters as advanced"
```

---

## Task 8: Slim Equalisation Tank inputs (2 → 1 essential)

Essential: `hrt_hours`. Advanced: `depth`.

**Files:**
- Modify: `packages/sim-engine/src/units/equalisation-tank.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

**Step 1: Failing test** — add to a new or existing EqualisationTank describe block:
```typescript
import { equalisationTankDefinition } from '../src/units/equalisation-tank';
it('marks only HRT as essential', () => {
  const essential = equalisationTankDefinition.parameterSchema.filter(p => !p.advanced).map(p => p.key);
  expect(essential).toEqual(['hrt_hours']);
});
```

**Step 2-6:** Tag `depth` as advanced in `equalisation-tank.ts:10`. Run, commit:
```bash
git add packages/sim-engine/src/units/equalisation-tank.ts packages/sim-engine/tests/units.test.ts
git commit -m "refactor(eq-tank): mark depth as advanced"
```

---

## Task 9: Slim Blower inputs (3 → 0 essential — fully auto)

After Task 2 the blower's primary input comes from the aerobic reactor. Mark all three remaining params (`ote`, `diffuser_depth_m`, `o2_demand_kg_per_day`) as advanced. The inspector will show "no required configuration — sizing pulled from connected aerobic reactor" with the advanced toggle for power users.

**Files:**
- Modify: `packages/sim-engine/src/units/aeration-blower.ts`
- Modify: `packages/sim-engine/tests/units.test.ts`

**Step 1: Failing test:**
```typescript
it('has no essential parameters — all configuration is advanced', () => {
  const essential = aerationBlowerDefinition.parameterSchema.filter(p => !p.advanced).map(p => p.key);
  expect(essential).toEqual([]);
});
```

**Step 2-6:** Tag all three as advanced in `aeration-blower.ts:8-11`. Run, commit:
```bash
git add packages/sim-engine/src/units/aeration-blower.ts packages/sim-engine/tests/units.test.ts
git commit -m "refactor(blower): mark all parameters as advanced (auto-sized from aerobic)"
```

---

## Task 10: Add Design Summary section to the inspector

Andrew wants the headline outputs front-and-centre: MBR size, blower size, reactor sizes, buffer tank size, residence times, final discharge water quality. We add a `DesignSummarySection` component that walks the simulation results and renders one card per sized unit, with the Effluent node's water quality at the bottom.

**Files:**
- Create: `apps/web/components/inspector/DesignSummarySection.tsx`
- Modify: `apps/web/components/inspector/InspectorPanel.tsx` (mount the new section above Configuration)

**Step 1: Create the component**

`apps/web/components/inspector/DesignSummarySection.tsx`:
```typescript
'use client';
import type { SimulationResults } from '@repo/sim-engine';
import { InspectorSection } from './InspectorSection';

interface Props {
  results: SimulationResults | null;
}

interface SummaryRow {
  label: string;
  value: string;
  unit?: string;
}

function formatNumber(n: number, dp = 0): string {
  if (Math.abs(n) >= 10000) return n.toExponential(2);
  return n.toFixed(dp);
}

export function DesignSummarySection({ results }: Props) {
  if (!results) return null;

  const rows: SummaryRow[] = [];

  for (const [nodeId, r] of Object.entries(results.nodeResults)) {
    if (!r.sizing) continue;
    // Reactor volumes + HRTs
    if (r.sizing.volume) {
      rows.push({ label: `${nodeId} volume`, value: formatNumber(r.sizing.volume.value, 0), unit: r.sizing.volume.unit });
    }
    if (r.sizing.HRT) {
      rows.push({ label: `${nodeId} HRT`, value: formatNumber(r.sizing.HRT.value, 1), unit: r.sizing.HRT.unit });
    }
    // MBR
    if (r.sizing.membraneArea) {
      rows.push({ label: `MBR membrane area`, value: formatNumber(r.sizing.membraneArea.value, 0), unit: 'm²' });
      rows.push({ label: `MBR modules`, value: formatNumber(r.sizing.moduleCount!.value, 0), unit: 'ea' });
    }
    // Blower
    if (r.energy && r.energy.installedKW > 0 && r.sizing.airFlow) {
      rows.push({ label: `Blower power`, value: formatNumber(r.energy.installedKW, 1), unit: 'kW' });
      rows.push({ label: `Blower air flow`, value: formatNumber(r.sizing.airFlow.value, 0), unit: r.sizing.airFlow.unit });
    }
  }

  // Final effluent quality — find any effluent node and grab the incoming stream
  const effluentEntries = Object.entries(results.nodeResults).filter(([_, r]) =>
    Object.keys(r.outputs).length === 0 && r.metadata?.compliance !== undefined
  );

  if (rows.length === 0 && effluentEntries.length === 0) return null;

  return (
    <InspectorSection title="Design Summary">
      <dl className="space-y-1 text-xs">
        {rows.map((row, i) => (
          <div key={i} className="flex items-baseline justify-between gap-2">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="font-mono text-foreground">
              {row.value}{row.unit && <span className="ml-1 text-muted-foreground">{row.unit}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </InspectorSection>
  );
}
```

**Step 2: Mount in InspectorPanel**

In `apps/web/components/inspector/InspectorPanel.tsx`:

2a. Import the new section near the others (line 22 area):
```typescript
import { DesignSummarySection } from './DesignSummarySection';
```

2b. Add the section just above the Configuration block (around line 65, before the `{def.parameterSchema.length > 0 && …}` line):
```typescript
<DesignSummarySection results={results} />
```

2c. Pass `results` to InspectorPanel. It's already in scope via the simulation store (line 26): `const { results } = useSimulationStore();` — nothing to wire.

**Step 3: Manual verification**

Run: `cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run dev --filter=web`

Build a minimal BNR-MBR flowsheet:
- Influent → Equalisation Tank → Anoxic Bioreactor → Aerobic Bioreactor → MBR → Effluent
- Aerobic.imlr → Anoxic.in (the new recycle edge)
- Aerobic.out → AerationBlower.aerobic_link

Click Run Simulation. Click any unit. Confirm the **Design Summary** panel appears at the top showing: EQ volume + HRT, anoxic volume + HRT, aerobic volume + HRT + MLSS, MBR membrane area + module count, blower kW + air flow.
Expected: Numbers populate cleanly. Stop dev server.

**Step 4: Commit**
```bash
git add apps/web/components/inspector/DesignSummarySection.tsx apps/web/components/inspector/InspectorPanel.tsx
git commit -m "feat(inspector): add Design Summary section above configuration"
```

---

## Task 11: Final pass — full test + manual E2E

**Files:** none modified.

**Step 1: Run every test suite**

Run: `cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run test`
Expected: All packages green (sim-engine + design-library + any others).

**Step 2: Manual E2E in the browser**

Build the BNR-MBR flowsheet from Task 10 Step 3. Verify:
- Each unit's inspector shows only the essential params with a "Show advanced" toggle.
- Blower has no essential params, says it auto-sizes from upstream.
- Recycle edge from Aerobic.imlr → Anoxic.in converges (results.converged === true; check the simulation badge in the UI).
- Design Summary panel surfaces MBR area, blower kW, all reactor volumes + HRTs.
- Final effluent water quality renders.
- The 11-section proposal at `/project/[id]/proposal/[fsid]` still loads (no regression from these changes).

**Step 3: Commit any clean-up + push**

If anything was tweaked during manual review:
```bash
git add -p
git commit -m "fix: <whatever>"
```
Then:
```bash
git push -u origin andrew-treatment-rework
gh pr create --title "Treatment rework: IMLR recycle, auto blower, slim inputs, design summary" --body "$(cat <<'EOF'
## Summary
- Aerobic bioreactor gains a built-in IMLR (internal mixed liquor recycle) output handle — no more manual Splitter wiring.
- Aeration blower auto-sizes from the connected aerobic reactor's O₂ demand (manual override still available).
- Every unit's parameter schema split into essential + advanced; inspector hides advanced behind a disclosure. Influent (14→3), Aerobic (10→2), Anoxic (4→1), MBR (3→1), EQ (2→1), Blower (3→0).
- New Design Summary panel surfaces MBR size, blower kW, reactor volumes + HRTs, and final effluent quality at the top of the inspector.

## Test plan
- [ ] `npx turbo run test` green
- [ ] Manual BNR-MBR flowsheet converges with the new IMLR recycle
- [ ] Blower kW > 0 when only OTE/depth are visible and O₂ comes from upstream
- [ ] Design Summary populates with the headline numbers
- [ ] Inspector's "Show advanced" disclosure works
EOF
)"
```

---

## Open questions to flag back to Dean

- **Andrew's "Excel sheet" reference** — Dean should ask Andrew to share it. If it prescribes a different essential-parameter list than the one above, we re-tag the schemas in a follow-up commit. The structure (essential vs advanced) is reusable.
- **Two-zone vs three-zone BNR layout** — the IMLR loop assumes anoxic → aerobic → IMLR back to anoxic. If Andrew also wants anaerobic (P-release) in the loop, add a second recycle edge from aerobic.imlr or split into separate `imlr` and `ras` handles. Not in scope for this PR.
- **Blower per-train sizing** — if a plant has two aerobic trains feeding one blower, the auto-derivation needs to sum upstream O₂ across all incoming `aerobic_link` edges. Current implementation reads a single upstream node; multi-train deferred until Andrew asks.
