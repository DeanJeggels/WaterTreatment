# Post-Phase-4 Supabase Advisor Findings

**Date:** 2026-04-15
**Supabase project:** otikhvpmjijwgnabxspd
**Ran by:** Phase 4 executor, Task 8

## Security advisor

No findings against Phase 4 objects (`boq_line_items`, `project_proposals`, the new `flowsheets.proposal_data` column, or the new `profiles.company_logo_url` / `designer_title` columns).

Pre-existing findings (**not** Phase 4 scope, ignored per plan):
- `public.todos` — RLS enabled but no policy (INFO)
- `public.fdr_set_updated_at` — function search_path mutable (WARN)
- `public.644D3C43CA48` — RLS disabled in public (ERROR) — leftover non-AquaSim table
- `public.10933C43CA48` — RLS disabled in public (ERROR) — leftover non-AquaSim table
- Auth OTP long expiry (WARN) — project-wide auth setting
- Leaked password protection disabled (WARN) — project-wide auth setting

## Performance advisor

### Phase 4 finding fixed
- **INFO** `unindexed_foreign_keys` on `public.project_proposals.project_proposals_generated_by_fkey` → addressed by follow-up **Migration 4** (`20260415000004_aquasim_v2_proposals_generated_by_index.sql`), which adds `project_proposals_generated_by_idx`.

### Phase 4 findings ignored (expected for new tables)
INFO-level `unused_index` on the indexes just created:
- `boq_line_items_flowsheet_id_idx`
- `boq_line_items_category_idx`
- `project_proposals_flowsheet_id_idx`
- `project_proposals_generated_at_idx`

These indexes have zero query traffic because the tables are empty and no consumer exists yet. They will start seeing usage once Phase 7 wires up BoQ persistence. Not a bug — the advisor re-evaluates over time.

### Pre-existing findings (ignored, not Phase 4)
- `fdr_usage_logs_session_id_fkey` unindexed (INFO)
- `auth_rls_initplan` on `fdr_profiles`, `fdr_sessions`, `fdr_usage_logs`, `fdr_event_thresholds` (WARN)
- Multiple `unused_index` INFO entries on existing `fdr_*`, `org_members`, `projects`, `flowsheets`, `simulation_runs`, `share_links`
- Auth DB connections absolute (INFO) — project-wide setting

## Follow-up migration applied

`20260415000004_aquasim_v2_proposals_generated_by_index.sql` — adds the missing covering index on `project_proposals.generated_by`.
