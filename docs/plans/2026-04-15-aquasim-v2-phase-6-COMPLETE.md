# Phase 6 Complete — Inspector Redesign with Inline Calculation Records

**Completed:** 2026-04-15
**Branch:** `v2-proposal-generator`
**Commits:** 7 on top of `892dbd7 Add AquaSim v2 Phase 6 implementation plan`

## What shipped

`apps/web/components/inspector/` restructured from a 153-line monolith into a thin orchestrator plus nine focused components:

| File | Role |
|---|---|
| [InspectorPanel.tsx](../../apps/web/components/inspector/InspectorPanel.tsx) | Thin orchestrator — reads stores, composes sections in fixed order, handles EmptyState |
| [InspectorSection.tsx](../../apps/web/components/inspector/InspectorSection.tsx) | Shared wrapper — title, optional description, `default`/`destructive` variants |
| [WarningsSection.tsx](../../apps/web/components/inspector/WarningsSection.tsx) | Rule-of-thumb violations in destructive styling |
| [SizingSection.tsx](../../apps/web/components/inspector/SizingSection.tsx) | Named `Dimension` entries with units |
| [EnergySection.tsx](../../apps/web/components/inspector/EnergySection.tsx) | Installed kW + daily kWh + per-record breakdown; self-hides when all-zero (BioreactorAerobic case) |
| [ConsumablesSection.tsx](../../apps/web/components/inspector/ConsumablesSection.tsx) | Daily operating inputs |
| [CalculationRecordsSection.tsx](../../apps/web/components/inspector/CalculationRecordsSection.tsx) | List of `CalculationRecordCard`s |
| [CalculationRecordCard.tsx](../../apps/web/components/inspector/CalculationRecordCard.tsx) | **Centerpiece** — symbol + label + result, monospace equation, named inputs with source, citation with book icon |
| [BoqSection.tsx](../../apps/web/components/inspector/BoqSection.tsx) | Per-line BoQ with category badge, ZAR currency formatting, unit subtotal |
| [WaterQualityTable.tsx](../../apps/web/components/inspector/WaterQualityTable.tsx) | Extracted from the old monolith |

### Key design properties

- **Orchestrator never conditionally wraps.** Every section short-circuits to `null` when its slice is empty, so `InspectorPanel.tsx` renders `<SizingSection />`, `<EnergySection />`, etc. unconditionally.
- **Metadata is a soft fallback.** The legacy `nodeResult.metadata` dictionary only renders when `calculationRecords` is empty — as units adopt real records, metadata disappears per unit automatically.
- **EmptyState uses Phase 5 primitive.** No unit selected → `<EmptyState icon={MousePointer2} title="No unit selected" ... />`.
- **Consistent formatting helpers.** `formatResult()` picks precision by magnitude (≥1000 → int, ≥10 → 1dp, ≥1 → 2dp, <0.01 → exponential). ZAR amounts use `toLocaleString('en-ZA', { maximumFractionDigits: 0 })` — no cents at capex scale.
- **All tokens, zero leaks.** `grep -rnE "(slate|gray|zinc|neutral)-[0-9]{2,3}" apps/web/components/inspector/` → `ALL SEMANTIC`. `grep -rn "#[0-9a-fA-F]"` → `NO HEX`.

## Verification state

| Check | Result |
|---|---|
| Sim-engine tests | **118 passing** (unchanged) |
| Design-library tests | **16 passing** (unchanged) |
| Combined | **134 passing** |
| `turbo run check-types` | Clean (sim-engine, design-library, ui, web) |
| `turbo run build --filter=web` | Clean, 12 routes |
| Inspector hardcoded-color grep | Zero hits |

## Deviations from plan

1. **Pure type widening of `SimulationResults.nodeResults`.** The plan says "no sim-engine changes". `SimulationResults.nodeResults` was typed as `Record<string, { outputs, metadata }>` — a narrow shape that hid the v2 fields (`sizing`, `energy`, `consumables`, `capex`, `calculationRecords`, `warnings`). At runtime the simulator already stores full `ProcessResult` values; the annotation was a type hole. The alternative to widening it was `as ProcessResult` casts scattered across every section, which is strictly worse. Widening is zero-runtime-change and all 118 sim-engine tests still pass. Committed alongside the orchestrator rewrite.

   Files touched: [packages/sim-engine/src/types.ts#L141](../../packages/sim-engine/src/types.ts#L141), [packages/sim-engine/src/graph/simulator.ts](../../packages/sim-engine/src/graph/simulator.ts#L46).

2. **Smoke test tasks (5 + 6) done by code inspection, not browser.** Tasks 5 and 6 of the plan call for a manual DevTools session on an authenticated flowsheet. Playwright in this environment has no seeded test user, so routes like `/project/[id]/flowsheet/[fsid]` redirect to `/login` without session cookies. The verifications we *can* do (type check, build, hardcoded-color audit, inspector-empty screenshot) all pass. Populated-inspector visual verification is deferred to the human operator when they next open the dev server with a logged-in session.

3. **Task 9 screenshots are limited to empty-state.** Same reason as #2. `docs/design-system/after/inspector-empty-{dark,light}.png` committed. Populated cases (BioreactorAerobic, warnings) are the manual follow-up.

4. **No changes to Phase 5 Sheet collapse.** Task 5 of the plan asks to verify the tablet Sheet still works. The Sheet wrapper in `apps/web/app/project/[id]/flowsheet/[flowsheetId]/page.tsx` was not touched in Phase 6, and `InspectorPanel` still renders its own content inside whatever container wraps it — the Sheet is transparent to the inspector. No runtime change expected; verification deferred like #2.

## Manual follow-ups for the operator

When logged in as a real user on the dev server:

- Open a flowsheet with a BioreactorAerobic unit and confirm the inspector shows (a) Sizing with volume/depth/HRT/MLSS, (b) Energy section present (even if kW = 0 — Phase 1b emits records only, no installed kW), (c) 3+ calculation records with visible equations, (d) BoQ section with civil + diffuser lines + R-denominated subtotal.
- Shrink a SecondaryClarifier's `surface_area` parameter to force a warning. Confirm the destructive-styled Warnings section appears at the top.
- Toggle light mode via the Phase 5 ThemeToggle. Confirm records, warnings, and numeric columns are all readable.
- Resize the browser to iPad Pro portrait (1024w) and verify the floating Sheet trigger still surfaces the inspector with the new sections intact.

## Next: Phase 7

Proposal view + PDF generation. New `/project/[id]/proposal/[fsid]` route that renders a live design document, reuses inspector sections as read-only embeds in the Sizing Calculations page, and deletes `ResultsPanel`. Draft plan to follow.

Branch stays on `v2-proposal-generator` — **do not merge to main**.
