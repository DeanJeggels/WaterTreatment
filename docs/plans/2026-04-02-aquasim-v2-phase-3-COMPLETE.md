# Phase 3 Complete — BoQ Engine + design-library

**Completed:** 2026-04-14
**Branch:** v2-proposal-generator
**Commits:** ~25 (see `git log main..HEAD`)

## What shipped

### New workspace package: `@repo/design-library`
- `supplier-prices.ts` — 28 priced reference items (civil, mechanical, chemicals)
- `dwa-limits.ts` — DWA General + Special discharge standards (National Water Act, 1998)
- `kinetic-constants.ts` — Marais-Ekama kinetic & stoichiometric constants + Arrhenius helper
- `defaults.ts` — SA typical raw sewage water quality
- **16 passing tests** (integrity + shape checks)
- Consumed by: `@repo/sim-engine` (unit models) + `apps/web` (BoQ preview)

### Refactored 15 unit files to use `getPrice()`
No inline `const FOO_ZAR = …` blocks remain. `grep -rn "_ZAR" packages/sim-engine/src/units/`
returns `ALL CLEAN`. All existing unit tests still pass unchanged (value-preserving refactor).

One commit per unit (6 Phase 1b + 9 Phase 2 = 15 refactor commits):

| Unit | Price IDs used |
|---|---|
| PrimaryClarifier | civil_concrete_reinforced, primary_clarifier_scraper_bridge |
| SecondaryClarifier | civil_concrete_reinforced, secondary_clarifier_scraper_bridge |
| Thickener | civil_concrete_reinforced, picket_fence_thickener_drive |
| BioreactorAnaerobic | civil_concrete_reinforced, submersible_mixer_3kw |
| BioreactorAnoxic | civil_concrete_reinforced, submersible_mixer_3kw |
| BioreactorAerobic | civil_concrete_reinforced, fine_bubble_diffuser_edi_9in |
| Screen | civil_headworks_channel, coarse_bar_screen, fine_step_screen_huber_rotamat, screenings_landfill_disposal |
| GritRemoval | civil_concrete_reinforced, grit_removal_package, grit_landfill_disposal |
| EqualisationTank | civil_concrete_reinforced, submersible_mixer_3kw |
| MBR | mbr_smu_module, mbr_cip_skid |
| AerationBlower | pd_blower_small, hst_turbo_blower |
| Dewatering | civil_concrete_reinforced, belt_press_1m, decanter_centrifuge_5m3h, polymer_cationic_dry, cake_landfill_disposal |
| ChemicalDosing | metering_pump_diaphragm, hdpe_storage_tank, alum_sulphate, ferric_chloride, polymer_cationic_dry, hydrated_lime, caustic_soda_50pct |
| UvDisinfection | uv_reactor_small, uv_reactor_medium, uv_reactor_large |
| InletPumping | civil_wet_well, submersible_pump_small, submersible_pump_medium, submersible_pump_large |

### `aggregateBoQ()` in `@repo/sim-engine`
- Walks the raw flowsheet node list (not just simulator nodeResults)
- Handles orphan utility nodes by calling `createUnit(type, params).process([])` when a node is missing from `nodeResults` (observed: the current graph simulator does include disconnected nodes in nodeResults, so the orphan fallback path is mostly defensive in practice — exercised by direct aggregator unit tests in `boq-aggregator.test.ts`)
- Groups line items by category (civil / mechanical / electrical / chemicals / instrumentation)
- Applies per-item overrides (price replacement + item removal)
- Computes subtotals and grand total
- 8 aggregator unit tests + 2 full-plant integration tests

## Test count progression
- Start of Phase 3: **108** passing (sim-engine only)
- End of Phase 3: **118** sim-engine + **16** design-library = **134** passing (combined)

## Notable deviations / notes for the next phase

1. **Simulator visits orphan nodes.** The Phase 3 plan assumed `simulate()` would skip disconnected utility nodes (AerationBlower, ChemicalDosing) and that the aggregator's orphan fallback would fire in the full-plant integration test. In practice `simulate()` iterates every node it finds, so `orphanCount` is 0 for the full-plant train. The orphan fallback path is still correct and is exercised by `boq-aggregator.test.ts` test 3 (empty `nodeResults` + aeration_blower node → orphanCount === 1). The full-plant integration test now asserts `orphanCount === 0` and proves the blower's capex reaches the total by comparing the grand total with vs without the blower in the node list.

2. **Extracted fixture helper.** The Phase 2 full-plant test had its graph inlined; Task 11 extracted it into a module-local `buildFullPlantFixture()` helper that both the old Phase 2 assertions and the new BoQ integration tests share.

3. **ChemicalDosing kept local density table.** Densities (ρ) are physical properties, not supplier prices, so `CHEMICAL_META` still holds them inline; only the price lookup moved to `getPrice()`. Consumable item names now come from the registry's `description` field.

## Deferred (not this phase)
- Persisting BoQ to Supabase → Phase 4
- Rendering BoQ in the UI → Phase 6/7
- Override UX (engineer clicks a line, types new price + reason) → Phase 6/7
- Price library browser page `/library/prices` → Phase 5
- Typed ID union for supplier prices → future polish
- Refactor kinetic constants from magic numbers in bioreactor units into the new `KINETIC_CONSTANTS` reference — constants are *defined* in the library but unit bodies still use literals. Deliberate non-refactor per the plan.

## Next: Phase 4
Schema migrations: add `boq_line_items`, `project_proposals` tables, `ALTER flowsheets`
and `ALTER profiles` to hold proposal metadata. Wire up RLS policies. Apply to the
Supabase project `otikhvpmjijwgnabxspd`.
