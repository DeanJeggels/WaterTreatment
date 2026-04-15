-- AquaSim v2 — Migration 3: project_proposals table
--
-- Every time an engineer clicks "Generate Proposal PDF", we snapshot the full
-- flowsheet state + calculation outputs + BoQ into this table. Each row is an
-- immutable point-in-time record tied to the flowsheet. Re-generating creates
-- a new row with version += 1.
--
-- The snapshot JSONB holds: graph_data (from flowsheet), proposal_data (client
-- metadata), nodeResults (from simulator), boq (from aggregateBoQ), and
-- compliance vs DWA limits.
--
-- pdf_url is set when a server-rendered PDF is stored (Phase 7+). v1 of the
-- proposal view uses browser print, so pdf_url is NULL until future phases.

CREATE TABLE IF NOT EXISTS public.project_proposals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flowsheet_id   uuid NOT NULL REFERENCES public.flowsheets(id) ON DELETE CASCADE,
  generated_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  generated_at   timestamptz NOT NULL DEFAULT now(),
  version        integer NOT NULL,
  pdf_url        text,
  snapshot       jsonb NOT NULL,
  notes          text
);

COMMENT ON TABLE public.project_proposals IS
'AquaSim v2 — immutable snapshot of a proposal at generation time. One row per Generate PDF click.';

-- ---------- Constraints ----------
ALTER TABLE public.project_proposals
  ADD CONSTRAINT project_proposals_version_positive CHECK (version > 0);

ALTER TABLE public.project_proposals
  ADD CONSTRAINT project_proposals_version_unique UNIQUE (flowsheet_id, version);

-- ---------- Indexes ----------
CREATE INDEX IF NOT EXISTS project_proposals_flowsheet_id_idx
  ON public.project_proposals (flowsheet_id);

CREATE INDEX IF NOT EXISTS project_proposals_generated_at_idx
  ON public.project_proposals (flowsheet_id, generated_at DESC);

-- ---------- RLS ----------
ALTER TABLE public.project_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_proposals_select_owner_or_org"
  ON public.project_proposals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.flowsheets f
      JOIN public.projects p ON p.id = f.project_id
      WHERE f.id = project_proposals.flowsheet_id
        AND (
          p.owner_id = (select auth.uid())
          OR (p.org_id IS NOT NULL AND public.is_org_member(p.org_id))
        )
    )
  );

CREATE POLICY "project_proposals_insert_owner_or_org"
  ON public.project_proposals
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.flowsheets f
      JOIN public.projects p ON p.id = f.project_id
      WHERE f.id = project_proposals.flowsheet_id
        AND (
          p.owner_id = (select auth.uid())
          OR (p.org_id IS NOT NULL AND public.is_org_member(p.org_id))
        )
    )
  );

-- Proposals are immutable: no UPDATE policy
-- Deletes limited to project owner (not org members) to prevent accidental history loss
CREATE POLICY "project_proposals_delete_owner_only"
  ON public.project_proposals
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.flowsheets f
      JOIN public.projects p ON p.id = f.project_id
      WHERE f.id = project_proposals.flowsheet_id
        AND p.owner_id = (select auth.uid())
    )
  );
