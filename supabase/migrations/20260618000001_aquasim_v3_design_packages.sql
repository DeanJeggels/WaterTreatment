-- AquaSim v3 — Migration: design_packages table
--
-- Persists the canonical DesignPackage produced by the headless auto-design
-- pipeline (@repo/auto-design + @repo/object-model). The package JSON is the
-- 3D/BIM SOURCE OF TRUTH; the PDF and Excel exports are lossy projections of
-- THIS row, so they can never disagree with it.
--
-- One row per (flowsheet, version). `inputs` holds the replayable form; the
-- `package` jsonb is NULL for an input-only draft and filled once the design
-- runs. RLS keys off projects.owner_id / is_org_member(org_id) — the same
-- pattern as every other v2 table. The v2 flowsheets.graph_data / proposal_data
-- stay untouched (the manual canvas keeps working); this is the single additive
-- migration the v3 MVP needs.

CREATE TABLE IF NOT EXISTS public.design_packages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  flowsheet_id    uuid REFERENCES public.flowsheets(id) ON DELETE SET NULL,
  version         integer NOT NULL DEFAULT 1,
  schema_version  text NOT NULL DEFAULT '1.0.0',
  inputs          jsonb NOT NULL,
  package         jsonb,
  plant_type      text,
  compliance_pass boolean,
  generated_by    uuid REFERENCES auth.users(id),
  pdf_url         text,
  export_url      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flowsheet_id, version)
);

COMMENT ON TABLE public.design_packages IS
'AquaSim v3 — persisted DesignPackage (objects+layout+boq+compliance+provenance) per flowsheet/version. inputs = replayable form; package jsonb is the JSON-canonical source of truth (NULL for an input-only draft). RLS via projects.owner_id / is_org_member.';

-- ---------- Indexes ----------
CREATE INDEX IF NOT EXISTS design_packages_project_id_idx
  ON public.design_packages (project_id);

CREATE INDEX IF NOT EXISTS design_packages_flowsheet_id_idx
  ON public.design_packages (flowsheet_id);

-- ---------- RLS ----------
ALTER TABLE public.design_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "design_packages_select_owner_or_org"
  ON public.design_packages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = design_packages.project_id
        AND (
          p.owner_id = (select auth.uid())
          OR (p.org_id IS NOT NULL AND public.is_org_member(p.org_id))
        )
    )
  );

CREATE POLICY "design_packages_insert_owner_or_org"
  ON public.design_packages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = design_packages.project_id
        AND (
          p.owner_id = (select auth.uid())
          OR (p.org_id IS NOT NULL AND public.is_org_member(p.org_id))
        )
    )
  );

CREATE POLICY "design_packages_update_owner_or_org"
  ON public.design_packages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = design_packages.project_id
        AND (
          p.owner_id = (select auth.uid())
          OR (p.org_id IS NOT NULL AND public.is_org_member(p.org_id))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = design_packages.project_id
        AND (
          p.owner_id = (select auth.uid())
          OR (p.org_id IS NOT NULL AND public.is_org_member(p.org_id))
        )
    )
  );

CREATE POLICY "design_packages_delete_owner_only"
  ON public.design_packages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = design_packages.project_id
        AND p.owner_id = (select auth.uid())
    )
  );
