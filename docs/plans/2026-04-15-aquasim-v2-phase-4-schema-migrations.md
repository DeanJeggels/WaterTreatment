# AquaSim v2 — Phase 4: Supabase Schema Migrations

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Extend the existing Supabase schema to persist AquaSim v2's new data: proposal metadata (client, designer, executive summary), company branding (logo, designer title), Bill of Quantities line items, and generated proposal snapshots. All changes applied as versioned migration files checked into `supabase/migrations/` so the schema is reproducible and the change history is auditable. RLS policies written from day one using the existing `projects.owner_id` / `is_org_member()` pattern.

**Architecture:** Three migrations, each a single `apply_migration` call via the `supabase-chise` MCP:

1. **Migration 1** — `ALTER flowsheets ADD proposal_data jsonb` + `ALTER profiles ADD company_logo_url, designer_title`
2. **Migration 2** — `CREATE TABLE boq_line_items` + RLS + indexes
3. **Migration 3** — `CREATE TABLE project_proposals` + RLS + indexes

Migration SQL is **also saved locally** as `.sql` files under a new `supabase/migrations/` directory and committed to git, so the schema can be reproduced from scratch on a staging project later. The `apply_migration` MCP tool handles the actual DB write; the git-tracked SQL file is the audit trail.

**Tech Stack:** Supabase Postgres 15, `supabase-chise` MCP server, Postgres RLS using the existing `(select auth.uid())` cached-subquery pattern. Project ID: `otikhvpmjijwgnabxspd` (ATA, CH-ISE org).

---

## Context & References

- **Design doc:** `docs/plans/2026-04-02-aquasim-v2-proposal-generator-design.md` (sections 7.2–7.5)
- **Phase 3 complete:** `docs/plans/2026-04-02-aquasim-v2-phase-3-COMPLETE.md` — `aggregateBoQ()` exists and produces `BoQLineItem[]` matching the schema we're about to create
- **Starting branch:** `v2-proposal-generator`
- **Starting test count:** 134 combined (118 sim-engine + 16 design-library) — unchanged by Phase 4 since no TS code executes SQL
- **Supabase project ID:** `otikhvpmjijwgnabxspd`
- **MCP server:** `supabase-chise` (tools: `apply_migration`, `list_migrations`, `list_tables`, `execute_sql`, `generate_typescript_types`, `get_advisors`)
- **Existing auth pattern:** `(select auth.uid())` cached subquery (faster than bare `auth.uid()`)
- **Existing org membership helper:** `is_org_member(org_id uuid)` — security definer function; verify it exists in Task 1

## Current schema (verified pre-Phase 4)

```
public.profiles
  id uuid PK (→ auth.users.id)
  full_name text
  company text                         ← already exists, reuse
  role text default 'engineer'
  subscription_tier text
  stripe_customer_id text
  stripe_subscription_id text
  subscription_period_end timestamptz
  created_at timestamptz

public.projects
  id uuid PK
  owner_id uuid (→ profiles.id)        ← RLS anchor
  org_id uuid (→ organizations.id)     ← nullable — solo projects allowed
  name text
  description text
  created_at timestamptz
  updated_at timestamptz

public.flowsheets
  id uuid PK
  project_id uuid (→ projects.id)
  name text default 'Scenario 1'
  graph_data jsonb                     ← unchanged
  discharge_standards jsonb            ← unchanged
  created_at timestamptz
  updated_at timestamptz

public.organizations, public.org_members, public.simulation_runs,
public.templates, public.share_links  — all unchanged by Phase 4
```

**Important deviation from design doc:** The design doc proposed adding a `company_name` column to `profiles`. The column `company` already exists. Phase 4 **reuses `company`** rather than adding a redundant `company_name`.

## Success Criteria

1. `supabase/migrations/` directory exists in the repo with 3 SQL files checked into git
2. All 3 migrations applied successfully to the `otikhvpmjijwgnabxspd` project (verify via `list_migrations`)
3. `flowsheets.proposal_data` column exists (jsonb, nullable)
4. `profiles.company_logo_url` and `profiles.designer_title` columns exist (text, nullable)
5. `public.boq_line_items` table exists with the exact shape from the design doc, RLS enabled, indexes in place
6. `public.project_proposals` table exists with the exact shape from the design doc, RLS enabled, indexes in place
7. Supabase security advisor returns zero `errored` or `critical` findings for the new objects (warnings on pre-existing tables are OK to leave)
8. `generate_typescript_types` produces a types file with the new tables/columns; `apps/web` uses these types (via import) without type errors
9. Web build clean (12 routes)
10. Sim-engine test count still **134** (Phase 4 doesn't touch TS logic)

## Non-Goals (deferred to later phases)

- **Writing rows into `boq_line_items` / `project_proposals`** from the client — Phase 7 (proposal view) is the first consumer
- **Version history for proposals** — `project_proposals.version` column exists from Task 6 onwards but no UI wires it up
- **Stripe tier enforcement on proposal generation** (e.g. free tier = 1 proposal/month) — later phase
- **Migration rollback SQL** — migrations are forward-only for v1; rollback is `DROP` run manually if needed
- **Seeding reference data into Postgres** (DWA limits, supplier prices) — these live in `@repo/design-library` as code, not in DB

---

## Tasks

### Task 0: Verify starting state

**Files:** none (verification only)

**Step 1: Confirm branch and clean tree**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && git status && git log --oneline | head -5
```
Expected: `On branch v2-proposal-generator`, working tree clean, recent commit `Phase 3 complete — BoQ engine + @repo/design-library`.

**Step 2: Confirm combined test baseline**

Run in parallel:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **118 passing**.

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/design-library && npx vitest run
```
Expected: **16 passing**.

**Step 3: Confirm web build**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean, 12 routes.

**Step 4: Verify MCP access to the right project**

Call the MCP tool `mcp__supabase-chise__list_migrations` with `project_id: "otikhvpmjijwgnabxspd"`.

Expected: A list of existing migrations from Phases 1-? (or empty if Phase 1 was applied before migrations were tracked). Record the count — anything after Phase 4 runs that count goes up by 3.

---

### Task 1: Inspect current schema and verify `is_org_member()` helper exists

**Files:** none (read-only verification)

**Step 1: Verify `is_org_member()` exists**

Call `mcp__supabase-chise__execute_sql`:
```sql
SELECT
  proname,
  pg_get_function_result(oid) AS returns,
  pg_get_function_arguments(oid) AS args
FROM pg_proc
WHERE proname = 'is_org_member'
  AND pronamespace = 'public'::regnamespace;
```

Expected: **One row**. Shape: `(is_org_member, boolean, "org_uuid uuid")` or similar. If **zero rows**, the helper is missing — stop and write a preliminary migration to create it:

```sql
CREATE OR REPLACE FUNCTION public.is_org_member(org_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = org_uuid AND user_id = (select auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
```

Apply via `apply_migration` with name `ensure_is_org_member_helper` if missing. Then continue.

**Step 2: Capture current `flowsheets` columns**

Call `execute_sql`:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'flowsheets'
ORDER BY ordinal_position;
```

Record output. Expected: `id`, `project_id`, `name`, `graph_data`, `discharge_standards`, `created_at`, `updated_at`. No `proposal_data` yet.

**Step 3: Capture current `profiles` columns**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;
```

Expected: `id`, `full_name`, `company`, `role`, `subscription_tier`, `stripe_customer_id`, `stripe_subscription_id`, `subscription_period_end`, `created_at`. **No `company_logo_url` or `designer_title` yet**. (If they are there — Phase 4 was partly applied before — stop and reconcile manually.)

**Step 4: Confirm no existing `boq_line_items` or `project_proposals`**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('boq_line_items', 'project_proposals');
```

Expected: **zero rows**. If either exists, stop and investigate before running Migration 2 or 3.

**Step 5: Record a timestamped "before" snapshot**

Write a small file for the audit trail:

Create `docs/plans/schema-snapshots/2026-04-15-pre-phase-4.md` with the columns of `flowsheets`, `profiles`, and a list of current tables. This is for human reference — not load-bearing for execution, but useful if anything goes wrong.

(Use the Write tool. Include the output from Steps 2–4.)

**Step 6: Commit the snapshot**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add docs/plans/schema-snapshots/2026-04-15-pre-phase-4.md && \
git commit -m "Snapshot: Phase 4 pre-migration schema state"
```

---

### Task 2: Create `supabase/migrations/` directory and write Migration 1

**Files:**
- Create: `supabase/migrations/20260415000001_aquasim_v2_extend_flowsheets_profiles.sql`

**Step 1: Create the directory**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && mkdir -p supabase/migrations
```

**Step 2: Write Migration 1**

Create `supabase/migrations/20260415000001_aquasim_v2_extend_flowsheets_profiles.sql`:
```sql
-- AquaSim v2 — Migration 1: Extend flowsheets + profiles for proposal generation
--
-- Adds:
--   flowsheets.proposal_data  — client, designer, exec summary, design basis, disclaimer
--   profiles.company_logo_url — shown in proposal header
--   profiles.designer_title   — e.g. "Pr.Eng, Process Engineer"
--
-- Does NOT add company_name — the existing profiles.company column is reused.
--
-- Idempotent: uses IF NOT EXISTS where possible.

-- ---------- flowsheets ----------
ALTER TABLE public.flowsheets
  ADD COLUMN IF NOT EXISTS proposal_data jsonb;

COMMENT ON COLUMN public.flowsheets.proposal_data IS
'AquaSim v2 proposal metadata: { client: {name, project_code, location}, designer: {name, title, date}, executive_summary, design_basis, disclaimer }';

-- ---------- profiles ----------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_logo_url text;

COMMENT ON COLUMN public.profiles.company_logo_url IS
'URL to the company logo rendered in the proposal cover page';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS designer_title text;

COMMENT ON COLUMN public.profiles.designer_title IS
'Professional title shown in the proposal designer block, e.g. "Pr.Eng, Process Engineer"';
```

**Step 3: Do NOT apply yet** — Task 3 applies it via MCP so the migration is tracked by Supabase. Git commit happens in Task 3 after apply succeeds.

---

### Task 3: Apply Migration 1 via MCP

**Files:**
- (No new files — Task 2's SQL file gets committed after apply succeeds)

**Step 1: Apply via `mcp__supabase-chise__apply_migration`**

Call the tool with:
- `project_id`: `otikhvpmjijwgnabxspd`
- `name`: `aquasim_v2_extend_flowsheets_profiles`
- `query`: the full contents of `supabase/migrations/20260415000001_aquasim_v2_extend_flowsheets_profiles.sql`

Expected: Success (no error). If it errors on the `IF NOT EXISTS` clause (older Postgres), drop it and retry with plain `ADD COLUMN`.

**Step 2: Verify the columns exist**

Call `execute_sql`:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'flowsheets' AND column_name = 'proposal_data')
    OR (table_name = 'profiles' AND column_name IN ('company_logo_url', 'designer_title'))
  )
ORDER BY table_name, column_name;
```

Expected: **3 rows** — `flowsheets.proposal_data (jsonb)`, `profiles.company_logo_url (text)`, `profiles.designer_title (text)`.

**Step 3: Confirm the migration is recorded**

Call `mcp__supabase-chise__list_migrations` with `project_id: "otikhvpmjijwgnabxspd"`.

Expected: Last entry has `name: aquasim_v2_extend_flowsheets_profiles` (or similar — check the exact naming the tool records).

**Step 4: Commit the migration file**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add supabase/migrations/20260415000001_aquasim_v2_extend_flowsheets_profiles.sql && \
git commit -m "Migration 1: extend flowsheets with proposal_data + profiles with company_logo_url, designer_title"
```

---

### Task 4: Write Migration 2 — `boq_line_items` table

**Files:**
- Create: `supabase/migrations/20260415000002_aquasim_v2_boq_line_items.sql`

**Step 1: Write the SQL**

Create the file with:
```sql
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
```

---

### Task 5: Apply Migration 2 via MCP

**Step 1: Apply**

Call `mcp__supabase-chise__apply_migration` with:
- `project_id`: `otikhvpmjijwgnabxspd`
- `name`: `aquasim_v2_boq_line_items`
- `query`: the full SQL from Task 4

**Step 2: Verify table exists**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'boq_line_items'
ORDER BY ordinal_position;
```

Expected: 11 columns — `id, flowsheet_id, unit_node_id, category, description, quantity, unit, unit_price_zar, total_price_zar, source_citation, override_reason, created_at`.

**Step 3: Verify indexes**

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'boq_line_items' AND schemaname = 'public';
```

Expected: At least 3 — the PK `boq_line_items_pkey`, `boq_line_items_flowsheet_id_idx`, `boq_line_items_category_idx`.

**Step 4: Verify RLS enabled + 4 policies**

```sql
SELECT rowsecurity
FROM pg_tables
WHERE tablename = 'boq_line_items' AND schemaname = 'public';
```

Expected: `rowsecurity = true`.

```sql
SELECT polname, polcmd
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
WHERE c.relname = 'boq_line_items';
```

Expected: 4 rows — `boq_line_items_select_owner_or_org (r)`, `boq_line_items_insert_owner_or_org (a)`, `boq_line_items_update_owner_or_org (w)`, `boq_line_items_delete_owner_or_org (d)`.

**Step 5: Commit the migration file**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add supabase/migrations/20260415000002_aquasim_v2_boq_line_items.sql && \
git commit -m "Migration 2: boq_line_items table with RLS and indexes"
```

---

### Task 6: Write Migration 3 — `project_proposals` table

**Files:**
- Create: `supabase/migrations/20260415000003_aquasim_v2_project_proposals.sql`

**Step 1: Write the SQL**

```sql
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
```

---

### Task 7: Apply Migration 3 via MCP

**Step 1: Apply**

Call `apply_migration` with:
- `project_id`: `otikhvpmjijwgnabxspd`
- `name`: `aquasim_v2_project_proposals`
- `query`: the full SQL from Task 6

**Step 2: Verify columns**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'project_proposals'
ORDER BY ordinal_position;
```

Expected: 8 columns — `id, flowsheet_id, generated_by, generated_at, version, pdf_url, snapshot, notes`.

**Step 3: Verify constraints**

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.project_proposals'::regclass;
```

Expected: At least PK + FK to flowsheets + FK to profiles + `project_proposals_version_positive` + `project_proposals_version_unique`.

**Step 4: Verify indexes**

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'project_proposals' AND schemaname = 'public';
```

Expected: PK + `project_proposals_flowsheet_id_idx` + `project_proposals_generated_at_idx` + the unique constraint's implicit index.

**Step 5: Verify RLS + 3 policies (SELECT, INSERT, DELETE — no UPDATE)**

```sql
SELECT polname, polcmd FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
WHERE c.relname = 'project_proposals';
```

Expected: 3 rows. No UPDATE policy (proposals are immutable snapshots).

**Step 6: Commit the migration file**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add supabase/migrations/20260415000003_aquasim_v2_project_proposals.sql && \
git commit -m "Migration 3: project_proposals table with RLS, immutable snapshots"
```

---

### Task 8: Run Supabase security advisor

**Files:** none

**Step 1: Fetch security advisors**

Call `mcp__supabase-chise__get_advisors` with:
- `project_id`: `otikhvpmjijwgnabxspd`
- `type`: `security`

**Step 2: Review findings**

Expected: No `critical` or `error` level findings for `boq_line_items` or `project_proposals`. If any appear:
- Likely cause: an RLS policy typo or missed category
- Fix by writing a new migration (do NOT edit the applied files) e.g. `supabase/migrations/20260415000004_fix_boq_rls.sql`
- Apply via `apply_migration` and re-run advisors

If the advisor flags pre-existing issues on tables outside Phase 4 (e.g. `todos`, `10933C43CA48`), **ignore them** — they're not part of AquaSim and will be cleaned up separately.

**Step 3: Fetch performance advisors**

Call `get_advisors` with `type: performance`.

Expected: No `critical` findings for the new tables. The indexes in Migrations 2 and 3 should keep RLS checks fast.

If the advisor recommends an index that Phase 4 missed (e.g. on `unit_node_id`), apply it as a follow-up migration.

**Step 4: Record advisor output**

Write the findings to `docs/plans/schema-snapshots/2026-04-15-post-phase-4-advisors.md` for the audit trail. Commit:

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add docs/plans/schema-snapshots/2026-04-15-post-phase-4-advisors.md && \
git commit -m "Phase 4: Supabase advisor findings after migration"
```

---

### Task 9: Generate TypeScript types

**Files:**
- Modify: `apps/web/lib/supabase/database.types.ts` (or wherever the existing types file lives)

**Step 1: Locate the existing types file**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
find apps/web -name "database.types.ts" -o -name "supabase.types.ts" 2>/dev/null
```

If the file exists, note its path. If not, the project uses inline type imports — generate to `apps/web/lib/supabase/database.types.ts` as the new canonical location.

**Step 2: Generate types**

Call `mcp__supabase-chise__generate_typescript_types` with `project_id: "otikhvpmjijwgnabxspd"`.

The tool returns a big TypeScript file. Save its content to `apps/web/lib/supabase/database.types.ts`.

**Step 3: Verify the new tables appear**

Open the generated file and confirm the following types exist:
- `Database['public']['Tables']['boq_line_items']`
- `Database['public']['Tables']['project_proposals']`
- `Database['public']['Tables']['flowsheets']['Row']['proposal_data']` (Json | null)
- `Database['public']['Tables']['profiles']['Row']['company_logo_url']` (string | null)
- `Database['public']['Tables']['profiles']['Row']['designer_title']` (string | null)

**Step 4: Run TypeScript check on apps/web**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run check-types --filter=web
```
Expected: Clean. If any file in `apps/web` already imports a Database type and breaks due to new shape, fix the import.

**Step 5: Run full web build**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean build, 12 routes.

**Step 6: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/lib/supabase/database.types.ts && \
git commit -m "Regenerate Supabase TypeScript types with Phase 4 tables"
```

---

### Task 10: Smoke-test the schema from `apps/web`

**Files:**
- Create: `apps/web/lib/supabase/phase4-smoke.ts`

**Context:** A compile-only smoke test that imports the new tables and exercises the typed client. Nothing runs at runtime — this is a "does the import path work" check. Phase 7 writes the real consumer.

**Step 1: Create the file**

```typescript
import type { Database } from './database.types';
import type { BoQLineItem, AggregatedBoQ } from '@repo/sim-engine';

/**
 * Phase 4 smoke test — type-level only. Proves the Supabase types compile
 * alongside the sim-engine BoQ types, and the shapes line up.
 *
 * Phase 7 replaces this with real read/write functions.
 */
type DbBoqRow = Database['public']['Tables']['boq_line_items']['Row'];
type DbBoqInsert = Database['public']['Tables']['boq_line_items']['Insert'];
type DbProposalRow = Database['public']['Tables']['project_proposals']['Row'];

// Shape check: a BoQLineItem from sim-engine should be mappable to a DB insert.
function _typeCheckBoqInsert(item: BoQLineItem, flowsheetId: string, nodeId: string): DbBoqInsert {
  return {
    flowsheet_id: flowsheetId,
    unit_node_id: nodeId,
    category: item.category,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unit_price_zar: item.unitPriceZar,
    source_citation: item.sourceCitation,
    override_reason: item.overrideReason ?? null,
  };
}

// Shape check: a DB row should be readable in the same shape (reverse of above).
function _typeCheckBoqRead(row: DbBoqRow): { description: string; total: number } {
  return {
    description: row.description,
    total: Number(row.total_price_zar),  // numeric comes back as string from PG
  };
}

// Shape check: a proposal snapshot holds the aggregated BoQ shape.
function _typeCheckProposalSnapshot(agg: AggregatedBoQ): DbProposalRow['snapshot'] {
  return agg as unknown as DbProposalRow['snapshot'];
}

// Silence unused warnings by exporting as a namespace (type-level only)
export type _Phase4TypeChecks = {
  insert: typeof _typeCheckBoqInsert;
  read: typeof _typeCheckBoqRead;
  proposalSnapshot: typeof _typeCheckProposalSnapshot;
};
```

**Step 2: Run type check**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run check-types --filter=web
```
Expected: Clean. If any assertion fails, one of the following has drifted:
- `BoQLineItem` shape in `@repo/sim-engine`
- `boq_line_items` DB columns
- Category enum values (string literal must match CHECK constraint)

Fix by reconciling whichever side is out of sync.

**Step 3: Run web build**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean.

**Step 4: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/lib/supabase/phase4-smoke.ts && \
git commit -m "Add Phase 4 schema type smoke test in apps/web"
```

---

### Task 11: Final verification

**Files:** none

**Step 1: Sim-engine tests unchanged**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **118 passing** (unchanged).

**Step 2: Design-library tests unchanged**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/design-library && npx vitest run
```
Expected: **16 passing** (unchanged).

**Step 3: Type check across the monorepo**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run check-types
```
Expected: Clean for all packages.

**Step 4: Web build**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean, 12 routes.

**Step 5: Re-list migrations via MCP**

Call `list_migrations` with `project_id: "otikhvpmjijwgnabxspd"`.

Expected: Three new entries beyond the pre-Phase-4 count:
- `aquasim_v2_extend_flowsheets_profiles`
- `aquasim_v2_boq_line_items`
- `aquasim_v2_project_proposals`
(Names may include a prefix/suffix depending on how `apply_migration` records them — exact spelling doesn't matter; count does.)

**Step 6: Re-run security advisor for a clean final state**

Call `get_advisors` with `type: security`. No new critical findings.

**Step 7: Review branch commits**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git log --oneline main..HEAD | head -15
```
Expected: Phase 1a + 1b + 2 + 3 commits + ~8 new Phase 4 commits.

---

### Task 12: Phase 4 completion summary

**Files:**
- Create: `docs/plans/2026-04-15-aquasim-v2-phase-4-COMPLETE.md`

**Step 1: Write the summary**

```markdown
# Phase 4 Complete — Supabase Schema Migrations

**Completed:** YYYY-MM-DD
**Branch:** v2-proposal-generator
**Commits:** ~8 (see `git log main..HEAD`)

## What shipped
- New directory: `supabase/migrations/` checked into git
- **Migration 1** — Extended `flowsheets` with `proposal_data jsonb`; extended `profiles` with `company_logo_url text`, `designer_title text` (note: reused existing `company` column rather than adding `company_name`)
- **Migration 2** — New `boq_line_items` table with 11 columns, category CHECK constraint, flowsheet_id FK, 2 indexes, RLS with 4 policies (SELECT/INSERT/UPDATE/DELETE all gated on project ownership or org membership)
- **Migration 3** — New `project_proposals` table (immutable snapshots) with 8 columns, unique constraint on (flowsheet_id, version), 2 indexes, RLS with 3 policies (SELECT/INSERT/DELETE — no UPDATE because snapshots are immutable)
- Regenerated `apps/web/lib/supabase/database.types.ts` with the new table types
- Phase 4 type smoke test at `apps/web/lib/supabase/phase4-smoke.ts` proves the BoQ/sim-engine shapes line up with the DB

## Verification state
- Sim-engine tests: 118 passing (unchanged)
- Design-library tests: 16 passing (unchanged)
- Web build: clean, 12 routes
- Supabase security advisor: no critical findings for Phase 4 objects
- Supabase performance advisor: no critical findings for Phase 4 objects

## Deferred (not this phase)
- Real CRUD against the new tables from `apps/web` → Phase 7
- Version history UI → Phase 7
- Stripe tier enforcement on proposal generation → later phase
- Deprecating `simulation_runs` table → Phase 9 cleanup

## Deviations from plan
<list any deviations encountered during execution here>

## Next: Phase 5
UI design system overhaul using the `ui-ux-pro-max` skill — tokens, palette,
typography, component restyling, unit-palette redesign, canvas edge styling,
inspector redesign. No new sim-engine or schema work.

Draft plan: `docs/plans/YYYY-MM-DD-aquasim-v2-phase-5-ui-system.md`
```

**Step 2: Commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add docs/plans/2026-04-15-aquasim-v2-phase-4-COMPLETE.md && \
git commit -m "Phase 4 complete — Supabase schema migrations applied"
```

**Step 3: Do NOT merge to main.** Branch stays long-lived for Phase 5.

---

## Summary of commits expected for Phase 4

| # | Task | Commit message |
|---|---|---|
| 0 | Baseline | (no commit) |
| 1 | Pre-snapshot | `Snapshot: Phase 4 pre-migration schema state` |
| 3 | Migration 1 | `Migration 1: extend flowsheets with proposal_data + profiles with company_logo_url, designer_title` |
| 5 | Migration 2 | `Migration 2: boq_line_items table with RLS and indexes` |
| 7 | Migration 3 | `Migration 3: project_proposals table with RLS, immutable snapshots` |
| 8 | Advisors | `Phase 4: Supabase advisor findings after migration` |
| 9 | Types | `Regenerate Supabase TypeScript types with Phase 4 tables` |
| 10 | Smoke test | `Add Phase 4 schema type smoke test in apps/web` |
| 12 | Summary | `Phase 4 complete — Supabase schema migrations applied` |

Total: ~8 commits on top of Phase 3. Test count unchanged (134 combined). Schema has 2 new tables and 3 new columns. Branch ready for Phase 5.

---

## Key design decisions baked in

| Decision | Rationale |
|---|---|
| Reuse `profiles.company` instead of adding `company_name` | Column already exists; avoid redundancy |
| `boq_line_items.total_price_zar` is a `GENERATED ALWAYS AS STORED` column | Eliminates drift — the DB computes it, can't be wrong |
| `project_proposals` has no UPDATE policy | Proposals are immutable snapshots; re-generating creates a new row with `version += 1` |
| `project_proposals.delete` restricted to project **owner** (not org members) | Prevents accidental history loss by junior team members |
| RLS uses `(select auth.uid())` cached subquery | Existing pattern in this schema; faster than bare `auth.uid()` |
| Migration files saved to `supabase/migrations/` with timestamp prefix | Standard Supabase convention; reproducible schema |
| `apply_migration` records each migration in `supabase_migrations.schema_migrations` | Supabase tracks it automatically; `list_migrations` shows history |
| Unique constraint on `(flowsheet_id, version)` | Prevents two proposals with the same version number per flowsheet |
| Indexes on `flowsheet_id` for both new tables | RLS policies join on this column — keeps checks fast |

## Known risks

1. **MCP tool permission prompt** — each `apply_migration` call may require user approval in the Claude Code session. Plan for up to 3 prompts (one per migration) plus possibly 1 more if `is_org_member` needs creating.

2. **Schema drift** — if another developer (or a previous AquaSim phase) applied unrelated DDL to these tables between Phase 3 and Phase 4, the migrations might conflict. Task 1 Step 5 (pre-snapshot) catches this.

3. **Supabase advisor false positives** — the advisor sometimes flags `public.` functions missing explicit `search_path`. If it complains about `is_org_member`, apply a follow-up migration setting `SET search_path = public, pg_temp` on the function. Not critical for Phase 4 success.

4. **`numeric` → string conversion in Supabase client** — Postgres `numeric` types come back to JS as strings to preserve precision. The Phase 4 smoke test handles this via `Number(row.total_price_zar)`. Phase 7 needs to do the same consistently.

5. **Json column typing** — Supabase generates `Json` union types for jsonb columns, which are too loose for the proposal snapshot. Phase 7 will probably layer a typed wrapper (`as unknown as AggregatedBoQ`) or introduce a Zod parser. Not a Phase 4 concern.

6. **Types file path assumption** — Task 9 assumes the generated types live at `apps/web/lib/supabase/database.types.ts`. If the project uses a different path (e.g. `apps/web/types/database.types.ts`), adapt the file location and update any existing imports.
