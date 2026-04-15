# Phase 4 Complete — Supabase Schema Migrations

**Completed:** 2026-04-15
**Branch:** v2-proposal-generator
**Commits:** 9 (see `git log main..HEAD`)

## What shipped

- New directory: `supabase/migrations/` checked into git with **4 SQL files**
- **Migration 1** (`20260415000001_aquasim_v2_extend_flowsheets_profiles.sql`) — extended `flowsheets` with `proposal_data jsonb`; extended `profiles` with `company_logo_url text` and `designer_title text`. Reused existing `profiles.company` column rather than adding `company_name` (plan deviation from design doc, documented in Task 1 snapshot).
- **Migration 2** (`20260415000002_aquasim_v2_boq_line_items.sql`) — new `boq_line_items` table: 12 columns (11 base + `total_price_zar` GENERATED ALWAYS AS STORED), category CHECK constraint, flowsheet_id FK with ON DELETE CASCADE, 3 indexes (PK + 2 covering), RLS enabled with 4 policies (SELECT/INSERT/UPDATE/DELETE all gated on project ownership or org membership via `is_org_member`).
- **Migration 3** (`20260415000003_aquasim_v2_project_proposals.sql`) — new `project_proposals` table (immutable snapshots): 8 columns, unique constraint on `(flowsheet_id, version)`, version > 0 check, FKs to `flowsheets` (cascade) and `profiles` (set null), 4 indexes including unique, RLS with 3 policies (SELECT/INSERT/DELETE — no UPDATE because snapshots are immutable; DELETE restricted to project owner only).
- **Migration 4** (`20260415000004_aquasim_v2_proposals_generated_by_index.sql`) — follow-up index on `project_proposals.generated_by` FK, added after performance advisor flagged it as unindexed.
- Regenerated `apps/web/lib/supabase/database.types.ts` (new canonical location — file didn't exist before Phase 4) with the new table types.
- Phase 4 type smoke test at `apps/web/lib/supabase/phase4-smoke.ts` proves the `BoQLineItem` / `AggregatedBoQ` shapes from `@repo/sim-engine` line up with the DB columns.

## Verification state
- Sim-engine tests: **118 passing** (unchanged)
- Design-library tests: **16 passing** (unchanged)
- **134 combined tests** — unchanged from Phase 3 end state, as expected (Phase 4 is schema-only)
- Web build: clean, 12 routes
- `turbo run check-types`: clean across all packages
- Supabase security advisor: zero findings against Phase 4 objects
- Supabase performance advisor: one Phase 4 finding (unindexed FK on `project_proposals.generated_by`) — addressed by Migration 4

## Verified DB state after Phase 4

- `flowsheets.proposal_data` exists (jsonb, nullable) ✓
- `profiles.company_logo_url` exists (text, nullable) ✓
- `profiles.designer_title` exists (text, nullable) ✓
- `boq_line_items`: 12 cols, 3 indexes, RLS=true, 4 policies ✓
- `project_proposals`: 8 cols, 5 indexes (after Migration 4), RLS=true, 3 policies, 5 constraints ✓
- `list_migrations`: 11 total (7 pre-Phase-4 + 4 new) ✓

## Deferred (not this phase)
- Real CRUD against the new tables from `apps/web` → Phase 7
- Version history UI → Phase 7
- Stripe tier enforcement on proposal generation → later phase
- Deprecating `simulation_runs` table → Phase 9 cleanup
- Cleaning up the pre-existing non-AquaSim findings the advisors flagged (`todos`, `fdr_*`, `10933C43CA48`, `644D3C43CA48`, auth project settings) — all out of Phase 4 scope.

## Deviations from plan

1. **Follow-up Migration 4 added.** The plan anticipated the possibility of the performance advisor flagging a missing index and instructed to handle it via a new migration rather than editing applied SQL. The advisor flagged `project_proposals_generated_by_fkey` as unindexed (INFO level, not critical). Created `20260415000004_aquasim_v2_proposals_generated_by_index.sql` adding `project_proposals_generated_by_idx`.

2. **`is_org_member()` signature.** The plan example used the argument name `org_uuid`; the real function in the database is `public.is_org_member(p_org_id uuid)`. Phase 4 migrations call it positionally so the name doesn't matter, but documented in the pre-migration snapshot.

3. **No existing `database.types.ts` file.** The plan anticipated the file might live elsewhere. It didn't exist at all — `apps/web/lib/supabase/` had only `client.ts`, `server.ts`, `middleware.ts`. Created the new canonical location `apps/web/lib/supabase/database.types.ts` with no existing imports to update.

4. **Unused-index INFO warnings on all 4 Phase 4 indexes** — expected for brand-new tables with no traffic, will self-resolve once Phase 7 wires up BoQ persistence. Documented in the advisor snapshot, not a bug.

## Next: Phase 5
UI design system overhaul using the `ui-ux-pro-max` skill — tokens, palette,
typography, component restyling, unit-palette redesign, canvas edge styling,
inspector redesign. No new sim-engine or schema work.
