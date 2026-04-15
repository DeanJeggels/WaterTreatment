-- AquaSim v2 — Migration 2: boq_line_items table
--
-- Persists Bill of Quantities line items contributed by each process unit in
-- a flowsheet. Populated by the proposal view when the engineer saves a
-- snapshot or explicitly persists a BoQ.
--
-- One row per line item (not aggregated). Subtotals and grand totals are
-- computed at read time by @repo/sim-engine's aggregateBoQ() function, not
-- stored here. Overrides (engineer replaces a seeded price) are stored via
-- unit_price_zar + override_reason on this table.

CREATE TABLE IF NOT EXISTS public.boq_line_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flowsheet_id    uuid NOT NULL REFERENCES public.flowsheets(id) ON DELETE CASCADE,
  unit_node_id    text NOT NULL,
  category        text NOT NULL CHECK (category IN (
    'civil', 'mechanical', 'electrical', 'chemicals', 'instrumentation'
  )),
  description     text NOT NULL,
  quantity        numeric NOT NULL CHECK (quantity >= 0),
  unit            text NOT NULL,
  unit_price_zar  numeric NOT NULL CHECK (unit_price_zar >= 0),
  total_price_zar numeric GENERATED ALWAYS AS (quantity * unit_price_zar) STORED,
  source_citation text NOT NULL,
  override_reason text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.boq_line_items IS
'AquaSim v2 — Bill of Quantities line items per flowsheet. One row per priced item. Populated by the proposal view.';

-- ---------- Indexes ----------
CREATE INDEX IF NOT EXISTS boq_line_items_flowsheet_id_idx
  ON public.boq_line_items (flowsheet_id);

CREATE INDEX IF NOT EXISTS boq_line_items_category_idx
  ON public.boq_line_items (flowsheet_id, category);

-- ---------- RLS ----------
ALTER TABLE public.boq_line_items ENABLE ROW LEVEL SECURITY;

-- Users can read BoQ line items on flowsheets belonging to projects they own
-- or are org members of.
CREATE POLICY "boq_line_items_select_owner_or_org"
  ON public.boq_line_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.flowsheets f
      JOIN public.projects p ON p.id = f.project_id
      WHERE f.id = boq_line_items.flowsheet_id
        AND (
          p.owner_id = (select auth.uid())
          OR (p.org_id IS NOT NULL AND public.is_org_member(p.org_id))
        )
    )
  );

CREATE POLICY "boq_line_items_insert_owner_or_org"
  ON public.boq_line_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.flowsheets f
      JOIN public.projects p ON p.id = f.project_id
      WHERE f.id = boq_line_items.flowsheet_id
        AND (
          p.owner_id = (select auth.uid())
          OR (p.org_id IS NOT NULL AND public.is_org_member(p.org_id))
        )
    )
  );

CREATE POLICY "boq_line_items_update_owner_or_org"
  ON public.boq_line_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.flowsheets f
      JOIN public.projects p ON p.id = f.project_id
      WHERE f.id = boq_line_items.flowsheet_id
        AND (
          p.owner_id = (select auth.uid())
          OR (p.org_id IS NOT NULL AND public.is_org_member(p.org_id))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.flowsheets f
      JOIN public.projects p ON p.id = f.project_id
      WHERE f.id = boq_line_items.flowsheet_id
        AND (
          p.owner_id = (select auth.uid())
          OR (p.org_id IS NOT NULL AND public.is_org_member(p.org_id))
        )
    )
  );

CREATE POLICY "boq_line_items_delete_owner_or_org"
  ON public.boq_line_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.flowsheets f
      JOIN public.projects p ON p.id = f.project_id
      WHERE f.id = boq_line_items.flowsheet_id
        AND (
          p.owner_id = (select auth.uid())
          OR (p.org_id IS NOT NULL AND public.is_org_member(p.org_id))
        )
    )
  );
