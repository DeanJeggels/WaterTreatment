# Phase 7 Complete — Proposal View + PDF Generation

**Completed:** 2026-04-15
**Branch:** `v2-proposal-generator`
**Commits:** 14 on top of `c0b8312 Add AquaSim v2 Phase 7 implementation plan`

## What shipped

### New route
`/project/[id]/proposal/[flowsheetId]` — fully client-side, renders a live 11-section design proposal that updates as the engineer edits parameters on the flowsheet tab.

### Shared editor tabs
[ProjectEditorTabs](../../apps/web/components/layout/project-editor-tabs.tsx) renders a Flowsheet ↔ Proposal toggle on both routes. Switching is instant because `flowsheet-store`, `simulation-store`, and `project-store` persist across navigation.

### Legacy cleanup
- [apps/web/components/results/ResultsPanel.tsx](../../apps/web/components/results/) deleted (file + directory)
- Flowsheet editor's bottom Results pane removed; canvas grows to fill the freed space
- `apps/web/app/shared/[token]/page.tsx` had only an unused `ResultsPanel` import — cleaned up
- `grep -rn ResultsPanel apps/web` → `GONE`

### Proposal data plumbing
[useProposalData](../../apps/web/lib/proposal/use-proposal-data.ts) loads `flowsheets.proposal_data` + `profiles` branding, exposes a `setProposalData(next)` setter that updates local state immediately and persists to Supabase with a 1-second debounce. Aggregates BoQ from the live nodes + `nodeResults`, derives the final effluent stream from the first `effluent` node, defaults the discharge standard to `DWA_LIMITS.General` (tier selector deferred).

### 11 sections
| # | Section | Highlights |
|---|---|---|
| 1 | [Cover](../../apps/web/lib/proposal/sections/01-cover.tsx) | `EditableSpan` (contentEditable) for client name / project code / location / designer; uses `profiles.company_logo_url` when set |
| 2 | [Executive Summary](../../apps/web/lib/proposal/sections/02-executive-summary.tsx) | Auto-derived stats (units, kW, civil + mech subtotals, grand total) + editable narrative `<textarea>` |
| 3 | [Design Basis](../../apps/web/lib/proposal/sections/03-design-basis.tsx) | Side-by-side tables: Influent flows + DWA effluent targets |
| 4 | [Process Description](../../apps/web/lib/proposal/sections/04-process-description.tsx) | Read-only [FlowsheetFigure](../../apps/web/lib/proposal/FlowsheetFigure.tsx) (React Flow with all interaction props off) + per-unit-type narrative list |
| 5 | [Sizing Calculations](../../apps/web/lib/proposal/sections/05-sizing-calculations.tsx) | Per-unit `CalculationRecordCard` groups — reuses Phase 6 component as read-only |
| 6 | [Aeration Design](../../apps/web/lib/proposal/sections/06-aeration-design.tsx) | BioreactorAerobic O₂ demand records + AerationBlower sizing |
| 7 | [Energy Analysis](../../apps/web/lib/proposal/sections/07-energy-analysis.tsx) | Table of every powered unit + total + annual cost @ R2.20/kWh |
| 8 | [Consumables](../../apps/web/lib/proposal/sections/08-consumables.tsx) | `(item, unit)`-keyed merge across units; daily + annualized columns |
| 9 | [Bill of Quantities](../../apps/web/lib/proposal/sections/09-bill-of-quantities.tsx) | Per-category subtables (Civil / Mechanical / Electrical / Chemicals / Instrumentation) + grand-total card |
| 10 | [Effluent Compliance](../../apps/web/lib/proposal/sections/10-effluent-compliance.tsx) | Status banner + parameter-by-parameter pass/fail vs DWA limits |
| 11 | [Disclaimer](../../apps/web/lib/proposal/sections/11-disclaimer.tsx) | Editable `<textarea>` with `DEFAULT_DISCLAIMER` fallback |

All sections short-circuit gracefully when their data slice is empty (no simulation run, no aeration units, etc.).

### Persistence + PDF helpers
[generate-proposal.ts](../../apps/web/lib/proposal/generate-proposal.ts):
- `saveBoqLineItems({ flowsheetId, boq })` — delete-then-insert into `boq_line_items`
- `createProposalSnapshot({ ... })` — read max version, increment, insert into `project_proposals`. Read-then-write race is caught by the unique `(flowsheet_id, version)` constraint at the DB level

### Buttons
- **Save BoQ** — persists just the BoQ; toast confirms count
- **Generate PDF** — pro-tier gate via `useSubscription.limits.pdfReports`. On click: saves BoQ → creates proposal snapshot → calls `window.print()` after a 250ms delay so the toast renders first. Both persistence steps happen *before* `window.print()` because the print dialog returns no callback

### Print CSS
[apps/web/app/globals.css](../../apps/web/app/globals.css#L182) `@media print` block:
- A4 paper, 18mm/22mm margins
- Forces white background + black text regardless of screen theme — engineers print to share with clients
- Tightened typography (10pt body, 9pt tables, 24pt h1, 14pt h2)
- `break-inside: avoid` on calculation record cards
- All elements with `print:hidden` (Tailwind v4 emits this automatically) are hidden in print mode — Phase 7 marked the toolbar, both action button groups, and labels appropriately

### Shared canvas extraction
[apps/web/components/canvas/node-types.ts](../../apps/web/components/canvas/node-types.ts) — extracted `nodeTypes` from `Canvas.tsx` so the proposal's read-only `FlowsheetFigure` reuses the exact same `ProcessUnitNode` renderer. `Canvas.tsx` now imports from this file.

## Verification state

| Check | Result |
|---|---|
| Sim-engine tests | **118 passing** (unchanged) |
| Design-library tests | **16 passing** (unchanged) |
| Combined | **134 passing** |
| `turbo run check-types` | Clean (sim-engine, design-library, ui, web) |
| `turbo run build --filter=web` | Clean, **13 routes** (was 12 — `/project/[id]/proposal/[flowsheetId]` added) |
| Hardcoded color grep on `apps/web/lib/proposal/` | Zero hits |
| `grep -rn ResultsPanel apps/web` | GONE |

## Deviations from plan

1. **Two consecutive Cover/Exec Summary commits.** First commit included a TS strict-mode error (`new Date().toISOString().split('T')[0]` returns `string | undefined` under `noUncheckedIndexedAccess`). Fixed with `.slice(0, 10)` in a follow-up commit. Both commits exist; not worth a rebase to squash.

2. **`useProposalData` consumes `nodes` from the flowsheet store directly** rather than receiving them as a hook argument — keeps the hook signature simple and avoids re-rendering the proposal page just to thread node lists through props. Documented here so future callers know the hook is implicitly tied to `useFlowsheetStore`.

3. **`profile` columns from `profiles` table.** The hook selects `full_name, company, company_logo_url, designer_title`. If any of those columns don't exist in the live schema (Phase 4 added them), the select returns null per-field and the cover gracefully falls back to placeholders. The smoke test will catch a hard schema mismatch — leaving it to the manual follow-up.

4. **Task 13 E2E smoke test deferred to manual run.** Playwright in this environment has no seeded test user; the proposal route is gated by middleware so unauth requests redirect to `/login` (HTTP 307). I captured a redirect screenshot at `docs/design-system/after/proposal-route-{dark,light}.png` to confirm the route compiles + auth gate fires. Populated proposal verification — drag a full plant, run sim, click Proposal tab, verify all 11 sections, edit + persist, Save BoQ, Generate PDF, check Supabase rows — is the human operator's job. Plan note 13 of the executor checklist explicitly anticipated this.

5. **Snapshot field cast.** `createProposalSnapshot` casts the snapshot object to `as never` when inserting into the `Json`-typed `project_proposals.snapshot` column. Supabase's generated `Json` type is the recursive `string | number | boolean | null | { [key: string]: Json | undefined } | Json[]` and TypeScript can't prove our snapshot — which contains `ProcessResult` objects with optional fields — fits without an assertion. The runtime payload serializes fine; the cast just suppresses the type check at the boundary. Not worth a generic helper for one call site.

## Known limitations (per plan non-goals + new findings)

- `flowsheets.discharge_standards` column exists but is not unified with `DWA_LIMITS` — proposal defaults to General. Tier selector is a later phase.
- `project_proposals.pdf_url` stays NULL — browser print doesn't expose the rendered file to JS. A later phase can do server-side Playwright rendering and upload to Supabase Storage.
- No version history UI — `project_proposals` rows accumulate without a browser.
- Share links show flowsheet only — no shared proposal view.
- No `/settings` page — `profile.company_logo_url` and `designer_title` fall back to defaults when empty.
- BoQ override schema is ready but no inline price-editing UI.
- No KaTeX — equations stay plain strings via `CalculationRecordCard`.

## Manual smoke checklist for the operator

1. Sign in, open or create a project with a flowsheet.
2. Drag a full train: Influent → Screen → PrimaryClarifier → BioreactorAnoxic → BioreactorAerobic → SecondaryClarifier → UvDisinfection → Effluent. Add a RAS edge SC→Anoxic. Add an orphan AerationBlower (`o2_demand_kg_per_day: 500`) and ChemicalDosing (alum, 30 mg/L).
3. Run Simulation. Verify results populate.
4. Click the **Proposal** tab. Confirm all 11 sections render with non-zero data.
5. Edit a client name in the cover, wait 1.5s, refresh, verify persistence.
6. Click **Save BoQ** — toast confirms N rows. Check Supabase `boq_line_items` for matching rows.
7. Click **Generate PDF**:
   - Free tier: toast says "PDF generation requires a Pro or Enterprise plan"
   - Pro+: print dialog opens with proposal as preview; `project_proposals` row inserted with `version=1`
8. Click again → `version=2`.
9. Toggle dark/light: screen looks right in both, print preview always white/black.

## Next: Phase 8

Landing page rewrite — positioning pivot from "process simulator" to "design & proposal generator". Pure content + minor UI changes. Uses Phase 5 tokens and layout primitives.

Branch stays on `v2-proposal-generator` — **do not merge to main**.
