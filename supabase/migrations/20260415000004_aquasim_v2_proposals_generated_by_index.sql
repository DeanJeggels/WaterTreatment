-- AquaSim v2 — Migration 4: index project_proposals.generated_by FK
--
-- Follow-up to Migration 3 (project_proposals). The Supabase performance
-- advisor flagged `project_proposals_generated_by_fkey` as missing a covering
-- index. Foreign keys used in joins should be indexed for decent query plans.
--
-- Kept as its own migration (not a patch to Migration 3) so the applied file
-- history is append-only.

CREATE INDEX IF NOT EXISTS project_proposals_generated_by_idx
  ON public.project_proposals (generated_by);
