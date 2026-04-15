# AquaSim v2 — Phase 9: Merge & Deploy

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. This is the highest-stakes phase — every task has a verification step, and the merge itself is explicitly gated on a regression pass.

**Goal:** Ship AquaSim v2 to production. Regression-test the whole stack on the long-running `v2-proposal-generator` feature branch, rewrite the root README, update the Obsidian progress log with the complete v2 history, merge to `main` with a `--no-ff` merge commit that captures the release notes, tag as `v2.0.0`, push, verify the Netlify deploy, smoke-test the live landing page, then record the ship in auto-memory.

**Architecture:** No code changes. This phase is verification + documentation + merge + deploy. The merge is a **non-fast-forward merge commit** that preserves the full 130-commit history of the branch under a single named merge node. The v2.0.0 tag is annotated and carries the release notes. Netlify auto-deploys from `main`.

**Tech Stack:** git + GitHub + Netlify (existing). No new deps.

---

## Context & References

- **Design doc:** `docs/plans/2026-04-02-aquasim-v2-proposal-generator-design.md`
- **Phases 1a–8 complete.** All execution commits are on `v2-proposal-generator`. Combined test count: **134** (118 sim-engine + 16 design-library). Web routes: 13.
- **Branch state (verified pre-plan):**
  - `main ↔ v2-proposal-generator` divergence: branch is 130 commits ahead, 0 commits behind. Clean fast-forward possible, but Phase 9 uses `--no-ff` for an explicit cut-over marker.
  - Remote: `https://github.com/DeanJeggels/WaterTreatment.git` (origin)
- **Supabase schema:** 4 migrations applied in Phase 4 (already live on production DB `otikhvpmjijwgnabxspd`). v1 code ignores the new columns/tables — schema is forward-compatible, so no DB rollback is needed if the code merge is reverted.
- **Netlify:** existing `netlify.toml` in the repo root. Auto-deploys on push to `main`. Env vars configured in the Netlify dashboard (verified via Phase 1 audit log).
- **Obsidian:** progress log lives at `/Users/deanjeggels/Documents/Obsidian Vault/CH-ISE/BioWin Clone/Progress Log.md`. **Do not rename the folder** — leave the folder name as-is, update the contents.

## Success Criteria

1. Full regression pass on `v2-proposal-generator`: all tests green, all packages type-check, web build clean, hardcoded-color grep clean, "simulator" grep clean on user-visible copy
2. Root `README.md` rewritten for v2 positioning with tech stack, quick start, phase summary
3. Obsidian Progress Log updated with a single consolidated entry for the v2 rebuild (phases 1a–8, ~130 commits, test count progression, key deliverables)
4. `main` is merged forward with a `--no-ff` merge commit whose message is the v2 release notes
5. Annotated tag `v2.0.0` exists on the merge commit with the same release notes
6. `main` and the tag are pushed to `origin`
7. Netlify deploy triggered and succeeds (verified via dashboard)
8. Production landing page at `https://aquasim.netlify.app` (or whatever the domain is) loads cleanly in a browser — no console errors, tabs navigate
9. Auto-memory updated with a project entry noting v2 is shipped
10. `v2-proposal-generator` branch is retained (not deleted) in case of rollback for at least 7 days post-ship

## Non-Goals

- **Writing new code** — Phase 9 is cut-over only. Any bugs discovered during regression testing become Phase 9.x follow-ups on a new branch, not new commits on `v2-proposal-generator`.
- **Changing the Netlify config** — `netlify.toml` stays as-is. If env vars are missing, the plan tells the executor to stop and set them in the dashboard.
- **Database rollback** — Phase 4 migrations stay applied on a revert; they're forward-compatible.
- **Stripe tier migration** — existing Free/Pro/Enterprise tiers keep working. Price changes are out of scope.
- **Post-launch announcements** (social, email, etc.) — that's a you-problem, not Claude's.
- **Deleting the `v2-proposal-generator` branch** after merge — keep it for rollback availability.

---

## Tasks

### Task 0: Verify pre-merge state

**Step 1: Branch and clean tree**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && git status && git branch --show-current
```
Expected: `On branch v2-proposal-generator`, working tree clean, branch name `v2-proposal-generator`.

**Step 2: Confirm divergence is one-sided**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
echo "Commits on branch not on main:" && git log main..v2-proposal-generator --oneline | wc -l && \
echo "Commits on main not on branch:" && git log v2-proposal-generator..main --oneline | wc -l
```
Expected: Branch-ahead count ≥ 130, main-ahead count **= 0**. If main is ahead, stop and resolve (rebase branch onto main first, then restart Phase 9).

**Step 3: Fetch latest from origin to confirm nothing changed remotely**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git fetch origin && \
git log origin/main..main --oneline && echo "--- (local main ahead of origin/main; none expected)" && \
git log main..origin/main --oneline && echo "--- (origin/main ahead of local main — MUST be empty)"
```
Expected: Both logs empty. If `origin/main` is ahead of local `main`, someone pushed to main — stop, pull, re-run Phase 9 from Task 0.

---

### Task 1: Full regression pass

**Files:** none (verification only)

**Context:** Before the merge, run every check that matters, in parallel where possible, so the merge is only ever done on a known-green state.

**Step 1: Sim-engine tests**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: **118 passing**.

**Step 2: Design-library tests**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/design-library && npx vitest run
```
Expected: **16 passing**.

**Step 3: Type check entire monorepo**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run check-types
```
Expected: Clean, all packages green.

**Step 4: Web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean, **13 routes**, zero TypeScript errors, zero lint errors.

**Step 5: Hardcoded-color grep on the whole web app**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
grep -rnE "(slate|gray|zinc|neutral)-[0-9]{2,3}" apps/web/app apps/web/components apps/web/lib 2>&1 | head -20 || echo "ALL SEMANTIC"
```
Expected: `ALL SEMANTIC` — or only legitimate references (e.g. inside an icon SVG's raw hex that happened to be named `gray`). Review each hit if present.

**Step 6: "Simulator" user-visible grep**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
grep -rn -i "simulator" apps/web/app apps/web/components 2>&1 | grep -v .next | grep -v node_modules | head -20 || echo "CLEAN"
```
Expected: `CLEAN`, or only hits in comments/metadata that aren't user-visible. If any hit a rendered JSX string, stop and fix on the branch before merging.

**Step 7: Supabase security advisor on the project**

Call `mcp__supabase-chise__get_advisors` with `project_id: "otikhvpmjijwgnabxspd"` and `type: "security"`.

Expected: No new critical/error findings on AquaSim tables (`flowsheets`, `profiles`, `boq_line_items`, `project_proposals`, `simulation_runs`, `projects`, `organizations`, `org_members`, `share_links`, `templates`). Pre-existing findings on non-AquaSim tables (`todos`, `fdr_*`, `10933C43CA48`, `644D3C43CA48`) are out of scope.

If any new critical finding exists on an AquaSim table, **stop and fix on the branch** before merging.

**Step 8: Branch commit count sanity check**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git log main..v2-proposal-generator --oneline | wc -l
```
Expected: ≥ 130. Record the exact number for the release notes in Task 4.

**Step 9: No commits needed yet** — this task is verification only. If any step fails, stop and fix before proceeding.

---

### Task 2: Rewrite the root README

**Files:**
- Modify: `README.md`

**Context:** The current root README is 159 lines scaffolded from create-turbo. Phase 9 rewrites it with v2 positioning, tech stack, package layout, quick start, and a phase summary.

**Step 1: Replace the contents**

Open `README.md` and replace entirely with:

````markdown
# AquaSim

**Wastewater design & proposal generator** for consulting engineers.

From wastewater sample to client-ready design proposal in one tool.
Drag-and-drop flowsheet editor, auditable calculations with published-literature
citations, real South African supplier prices, DWA compliance checking,
and one-click proposal PDF export via browser print.

---

## What's in the box

- **19 process units** covering a full biological WWTP: screens, grit, equalisation,
  primary and secondary clarifiers, MLE / UCT / MBR biological reactors, thickeners,
  dewatering, chemical dosing, UV disinfection, inlet pumping, aeration blowers
- **Auditable calculations** — every derived number carries its equation, inputs,
  result, and citation (Ekama, WRC TT-16/84, Metcalf & Eddy, supplier datasheets)
- **Bill of Quantities engine** with real SA supplier prices from Huber, Megavision,
  Sulzer, Grundfos, Andritz, Alfa Laval, Xylem Wedeco, and others
- **DWA General + Special discharge limits** built in, effluent pass/fail per parameter
- **11-section proposal document**: cover, executive summary, design basis, process
  description, sizing calculations, aeration design, energy analysis, consumables,
  Bill of Quantities, effluent compliance, disclaimer
- **Browser print-to-PDF** — no server-side rendering, no PDF dependencies
- **Dark mode by default**, tablet responsive, WCAG AA contrast

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 |
| Styling | Tailwind CSS v4 (CSS-native config), shadcn/ui |
| Canvas | React Flow (@xyflow/react) |
| State | Zustand (flowsheet, simulation, project stores) |
| Backend | Supabase (Postgres + Auth + RLS + Edge Functions) |
| Billing | Stripe (Free / Pro / Enterprise tiers) |
| Hosting | Netlify with @netlify/plugin-nextjs |
| Monorepo | Turborepo |
| Tests | Vitest (134 passing — 118 sim-engine + 16 design-library) |

## Monorepo layout

```
aquasim/
├── apps/
│   └── web/                     # Next.js app — landing, auth, dashboard, flowsheet + proposal editors
├── packages/
│   ├── sim-engine/              # Pure TS sim engine: 19 unit models, graph simulator, BoQ aggregator
│   └── design-library/          # SA reference data: supplier prices, DWA limits, kinetic constants
├── docs/
│   ├── WWTP Design.xlsm         # Source spreadsheet — the original Marais-Ekama calculator
│   └── plans/                   # All v2 rebuild plans + completion summaries
├── supabase/
│   └── migrations/              # Versioned SQL migrations (4 applied in Phase 4)
└── netlify.toml
```

## Running locally

```bash
# Install
npm install

# Dev server (on http://localhost:3000)
npx turbo run dev --filter=web

# Run tests
cd packages/sim-engine && npx vitest run
cd packages/design-library && npx vitest run

# Build
npx turbo run build --filter=web
```

## Environment variables

Set in `apps/web/.env.local` and Netlify dashboard:

```
NEXT_PUBLIC_SUPABASE_URL=https://otikhvpmjijwgnabxspd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
STRIPE_SECRET_KEY=<Stripe secret key>          # optional — Pro tier disabled if missing
STRIPE_PRO_PRICE_ID=<Stripe price ID for Pro>  # optional
STRIPE_ENTERPRISE_PRICE_ID=<Stripe price ID>   # optional
```

## Supabase project

`otikhvpmjijwgnabxspd` (ATA, CH-ISE org).

**Tables**: `profiles`, `organizations`, `org_members`, `projects`, `flowsheets`,
`simulation_runs` (deprecated), `templates`, `share_links`, `boq_line_items` (new in v2),
`project_proposals` (new in v2).

**Edge functions**: `generate-report` (legacy, unused in v2), `stripe-webhook`.

## The v2 rebuild

AquaSim v2 was a 9-phase rebuild on the `v2-proposal-generator` branch. Each
phase has a plan document and a completion summary in `docs/plans/`.

| Phase | Scope | Output |
|---|---|---|
| 1a | Sim-engine interface refactor | Non-breaking `ProcessResult` extension with v2 fields |
| 1b | Real sizing/energy/BoQ on the 10 existing units | Every unit emits calculation records with citations |
| 2 | 9 new unit models | Screens, grit, equalisation, MBR, aeration blower, dewatering, dosing, UV, inlet pumping |
| 3 | BoQ engine + @repo/design-library | `aggregateBoQ()`, 28 supplier-price entries, DWA limits, kinetic constants |
| 4 | Supabase schema migrations | `boq_line_items`, `project_proposals`, extended `flowsheets` + `profiles` |
| 5 | UI design system overhaul | Phase 5 tokens, theme toggle, layout primitives, canvas polish |
| 6 | Inspector redesign | `CalculationRecordCard` centerpiece, 8 section components |
| 7 | Proposal view + PDF generation | 11-section live document, `@media print` styling, Save BoQ + Generate PDF |
| 8 | Landing page rewrite | Hero, features, process units, pricing copy pivot |
| 9 | Merge & deploy | This phase |

**Test count progression:** 41 → 51 → 74 → 108 → 134 combined.

## License

Proprietary. CH-ISE (PTY) LTD, South Africa.
````

**Step 2: Web build — confirm nothing depends on README**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean.

**Step 3: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add README.md && \
git commit -m "README: rewrite for AquaSim v2 ship"
```

---

### Task 3: Update the Obsidian Progress Log

**Files:**
- Modify: `/Users/deanjeggels/Documents/Obsidian Vault/CH-ISE/BioWin Clone/Progress Log.md`
- Possibly: `/Users/deanjeggels/Documents/Obsidian Vault/CH-ISE/BioWin Clone/README.md`

**Context:** Obsidian lives outside the git repo but is the user's system of record. Phase 9 adds a single consolidated entry for the whole v2 rebuild.

**Step 1: Read the current Progress Log to see where to insert**

Use the `Read` tool to open the Progress Log. The existing file has entries for Phases 1-5 (v1) and a rename/bug-fix entry from earlier. The new entry goes at the **top** under the existing "Bug Fixes & Rebrand" entry from 2026-04-02.

**Step 2: Append a new "v2 Rebuild — COMPLETE" section**

Insert after the most recent entry:

```markdown
## Phase 6: AquaSim v2 — Wastewater Design & Proposal Generator (2026-04-02 → 2026-04-15)

### Rebuild summary
A 9-phase rebuild pivoted AquaSim from a process simulator into a client-ready design & proposal generator for SA consulting engineers. Every phase had its own plan document and completion summary under `docs/plans/` in the repo.

### What shipped
- **19 process units** (10 existing + 9 new): screens, grit, equalisation, MBR, aeration blower, dewatering, chemical dosing, UV disinfection, inlet pumping
- **Auditable calculations**: every derived number has an equation, inputs, result, and citation (Ekama, WRC, Metcalf & Eddy, supplier datasheets)
- **Bill of Quantities engine** with 28 real SA supplier prices (Huber, Megavision, Sulzer, Grundfos, Andritz, Alfa Laval, Xylem Wedeco)
- **DWA General + Special discharge limits** built into effluent compliance checks
- **11-section proposal document** at `/project/[id]/proposal/[fsid]` with live editing + browser print-to-PDF
- **@repo/design-library** workspace package (supplier prices, DWA limits, Marais-Ekama kinetic constants, SA typical influent)
- **4 Supabase migrations** applied to `otikhvpmjijwgnabxspd` (boq_line_items, project_proposals, flowsheets.proposal_data, profiles.company_logo_url + designer_title)
- **Phase 5 design system**: new token palette, dark/light toggle, layout primitives (PageShell, PageHeader, EmptyState), React Flow canvas polish, unit palette grouped by category
- **Phase 6 inspector**: `CalculationRecordCard` centerpiece + 8 section components
- **Phase 8 landing page**: hero/features/pricing/process units copy rewritten for the proposal-generator positioning

### Test count progression
- Start of v2: 41 passing
- Phase 1a: 61 passing
- Phase 1b: 74 passing
- Phase 2: 108 passing
- Phase 3: 134 combined (118 sim-engine + 16 design-library)
- Phases 4-8: 134 (UI + schema, no new test logic)

### Commits + ship
- ~130 commits on `v2-proposal-generator` branch
- Merged to `main` with `--no-ff` merge commit on 2026-04-15
- Tagged as `v2.0.0`
- Deployed via Netlify from `main`
- Branch retained for ≥ 7 days post-ship for rollback availability

### Key files
- `docs/plans/` — 9 plan docs + 9 completion summaries
- `docs/plans/2026-04-02-aquasim-v2-proposal-generator-design.md` — master design doc
- `README.md` — rewritten at ship time

### Deferred to later
- Server-rendered PDF (Playwright in Edge Function) — v1 uses browser print only
- `/settings` page for company branding
- BoQ override UI (schema ready, UI deferred)
- Version history browser UI for `project_proposals`
- Proposal view on shared tokens
- Multi-region support (SA only for v1)
```

**Step 3: Update the Obsidian README index if needed**

The existing Obsidian README.md at `/Users/deanjeggels/Documents/Obsidian Vault/CH-ISE/BioWin Clone/README.md` probably has a status line or phase summary. Update the "Phase" line to read:

```markdown
- **Phase**: v2 Shipped (2026-04-15) — Wastewater design & proposal generator
```

Leave the rest of the README alone unless it's obviously stale.

**Step 4: Obsidian updates don't require a git commit** — they're in the vault, not the repo. Note the updates in the Phase 9 completion summary (Task 12) instead.

---

### Task 4: Draft the merge commit / release notes

**Files:** none yet — this task prepares the text that Task 5 uses when merging

**Context:** The `--no-ff` merge commit message becomes the v2 release notes. Write it carefully — it gets read every time someone looks at `main`'s history or the GitHub release.

**Step 1: Draft the release notes**

Write the following into a temporary file `/tmp/v2-release-notes.md` (or paste-ready text kept in a scratch buffer):

```
Merge: AquaSim v2 — Wastewater Design & Proposal Generator

Pivots AquaSim from a process simulator into a client-ready design &
proposal generator for South African consulting engineers. 9-phase
rebuild on the v2-proposal-generator branch.

Headlines
- 19 process units covering a full biological WWTP
- Auditable calculations with equations, inputs, results, and citations
- Bill of Quantities with real SA supplier prices
- DWA General + Special compliance built in
- 11-section live proposal document at /project/[id]/proposal/[fsid]
- Browser print-to-PDF (no server-rendering in v1)
- Dark mode default, tablet responsive, WCAG AA contrast

What's new
- @repo/design-library workspace package (supplier prices, DWA limits,
  Marais-Ekama kinetic constants, SA typical influent defaults)
- 4 Supabase migrations: boq_line_items, project_proposals,
  flowsheets.proposal_data, profiles.company_logo_url, designer_title
- Inspector redesign: CalculationRecordCard centerpiece + 8 section
  components, semantic tokens throughout
- Project editor Flowsheet ↔ Proposal tab toggle
- Landing page rewritten for the proposal-generator positioning

Test count progression
- v1 baseline: 41 passing
- Phase 1a: 61
- Phase 1b: 74
- Phase 2: 108
- Phase 3 onwards: 134 combined (118 sim-engine + 16 design-library)

Compatibility
- Schema is forward-compatible. v1 code does not query the new columns
  or tables, so reverting this merge does not require a DB rollback.
- Stripe Free/Pro/Enterprise tiers and prices unchanged.
- Existing flowsheets continue to work — the graph_data shape is
  unchanged; only new optional output fields appear.

Deferred to future phases
- Server-rendered PDF via Playwright Edge Function
- /settings page for company branding
- BoQ override UI (schema ready)
- Version history browser UI
- Proposal view on shared tokens
- Multi-region support

Plan documents and completion summaries for all 9 phases are in
docs/plans/.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

**Step 2: Verify the text is ready**

Proofread. No typos. No references to things not actually shipped. No hedging. This text is permanent on main's history.

---

### Task 5: Merge `v2-proposal-generator` → `main`

**Files:** none (git operation)

**Step 1: Check out main**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && git checkout main
```
Expected: `Switched to branch 'main'`, clean tree.

**Step 2: Verify main is up to date with origin** (re-check — origin could have shifted during Phase 9)

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && git fetch origin && git log main..origin/main --oneline
```
Expected: empty output.

**Step 3: Run the `--no-ff` merge with the release notes**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git merge --no-ff v2-proposal-generator -m "$(cat <<'EOF'
Merge: AquaSim v2 — Wastewater Design & Proposal Generator

Pivots AquaSim from a process simulator into a client-ready design &
proposal generator for South African consulting engineers. 9-phase
rebuild on the v2-proposal-generator branch.

Headlines
- 19 process units covering a full biological WWTP
- Auditable calculations with equations, inputs, results, and citations
- Bill of Quantities with real SA supplier prices
- DWA General + Special compliance built in
- 11-section live proposal document at /project/[id]/proposal/[fsid]
- Browser print-to-PDF (no server-rendering in v1)
- Dark mode default, tablet responsive, WCAG AA contrast

What's new
- @repo/design-library workspace package (supplier prices, DWA limits,
  Marais-Ekama kinetic constants, SA typical influent defaults)
- 4 Supabase migrations: boq_line_items, project_proposals,
  flowsheets.proposal_data, profiles.company_logo_url, designer_title
- Inspector redesign: CalculationRecordCard centerpiece + 8 section
  components, semantic tokens throughout
- Project editor Flowsheet ↔ Proposal tab toggle
- Landing page rewritten for the proposal-generator positioning

Test count progression
- v1 baseline: 41 passing
- Phase 1a: 61
- Phase 1b: 74
- Phase 2: 108
- Phase 3 onwards: 134 combined (118 sim-engine + 16 design-library)

Compatibility
- Schema is forward-compatible. v1 code does not query the new columns
  or tables, so reverting this merge does not require a DB rollback.
- Stripe Free/Pro/Enterprise tiers and prices unchanged.
- Existing flowsheets continue to work — the graph_data shape is
  unchanged; only new optional output fields appear.

Deferred to future phases
- Server-rendered PDF via Playwright Edge Function
- /settings page for company branding
- BoQ override UI (schema ready)
- Version history browser UI
- Proposal view on shared tokens
- Multi-region support

Plan documents and completion summaries for all 9 phases are in
docs/plans/.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

Expected: Merge succeeds with no conflicts. `main` is now at a new merge commit that has both `main`'s previous tip and `v2-proposal-generator`'s tip as parents.

**Step 4: Verify the merge commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git log --merges main -1 && \
echo "---" && \
git show --stat HEAD | head -30
```
Expected: One merge commit at HEAD with two parents.

**Step 5: Post-merge regression pass — CRITICAL**

Re-run the full verification on `main` to confirm nothing got weird during the merge:

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
(cd packages/sim-engine && npx vitest run) && \
(cd packages/design-library && npx vitest run) && \
npx turbo run check-types && \
npx turbo run build --filter=web
```
Expected: 118 + 16 tests passing, type check clean, web build clean (13 routes).

**If any check fails**, **DO NOT PUSH**. Investigate immediately. Rollback with `git reset --hard origin/main` only if necessary (this wipes the local merge — the branch is still intact).

**Step 6: No commit needed** — the merge commit itself is the commit.

---

### Task 6: Tag as `v2.0.0`

**Files:** none (git tag)

**Step 1: Create an annotated tag at the merge commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git tag -a v2.0.0 -m "$(cat <<'EOF'
AquaSim v2.0.0 — Wastewater Design & Proposal Generator

Pivots AquaSim from a process simulator into a client-ready design &
proposal generator. 19 process units, auditable calculations with
citations, BoQ with real SA supplier prices, DWA compliance checks,
11-section live proposal document, browser print-to-PDF.

See the merge commit for full release notes.
EOF
)"
```

**Step 2: Verify the tag**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && git tag -l v2.0.0 -n20
```
Expected: `v2.0.0` with the release notes printed.

**Step 3: Confirm the tag points at the merge commit**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git rev-parse v2.0.0 && git rev-parse HEAD
```
Expected: Both hashes match.

---

### Task 7: Push `main` + tag to origin

**Files:** none (push operation)

**Context:** This is the point of no return — pushing triggers the Netlify deploy. Everything before this task is reversible locally.

**Step 1: Push main**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && git push origin main
```
Expected: Fast-forward push succeeds. The output shows the new commits going up.

**Step 2: Push the tag**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && git push origin v2.0.0
```
Expected: `new tag v2.0.0 -> v2.0.0`.

**Step 3: Verify on GitHub**

Open `https://github.com/DeanJeggels/WaterTreatment` in a browser. Verify:
- `main` branch shows the new merge commit at the top
- `Releases` / tags section shows `v2.0.0`
- The merge commit has both parents visible

**Step 4: Push the feature branch too (for reference / rollback availability)**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && git push origin v2-proposal-generator
```
Expected: Success or "Everything up-to-date" if it was already pushed during earlier phase runs.

---

### Task 8: Verify Netlify deploy

**Files:** none (external verification)

**Context:** Netlify watches `main` and auto-deploys on push. The deploy runs `npx turbo run build --filter=web` inside the Netlify build environment.

**Step 1: Open the Netlify dashboard for the AquaSim site**

(Executor: you may not have Netlify CLI installed. Open the dashboard in a browser and navigate to the AquaSim / WaterTreatment site's "Deploys" tab.)

**Step 2: Verify a new deploy started**

Expected: A fresh deploy appears at the top, status "Building" or "Published". Triggered by the push to main.

**Step 3: Wait for the deploy to finish**

Typical build time: 2–5 minutes. Monitor for errors. Common failure modes:
- Missing env var in Netlify (Supabase URL, anon key) → set it in the dashboard, trigger redeploy
- Turbo cache corruption → clear cache, redeploy
- Type error that slipped past the local check (rare, but possible on Netlify's clean install)

**Step 4: Once deployed, verify the deploy URL**

Click the deploy URL from the dashboard. Open it in a browser.

Expected: The landing page loads. Hero shows the new "Wastewater design & proposal generator" badge. No console errors.

**Step 5: Record the deploy URL** in the Phase 9 completion summary (Task 12).

---

### Task 9: Production smoke test

**Files:** none

**Context:** The landing page is public — smoke-test it end to end. Authenticated routes need a test user, which the executor may not have on production; focus on what's accessible without auth.

**Step 1: Landing page**

Visit the production URL. Verify:
- Hero, feature grid, process units, pricing, CTA, footer all render
- Click "Start free" → navigates to `/register`
- Click "Sign in" → navigates to `/login`
- Click a pricing CTA → navigates to `/register`
- Open DevTools → Console → confirm no errors

**Step 2: Auth pages**

Visit `/login` and `/register`. Confirm they render without errors. Don't create a real account just for the smoke test.

**Step 3: Dark/light mode**

The landing page defaults to dark mode. Confirm via the root HTML class. Light mode isn't toggleable from the landing page but should render correctly if manually enabled via DevTools.

**Step 4: Tablet viewport**

Use DevTools device toolbar → iPad Pro. Confirm the landing page reads well at 1024 width.

**Step 5: If any issue surfaces**

Note it for a Phase 9.x follow-up. Do not push fixes directly to main; use a new short-lived branch.

---

### Task 10: Update auto-memory

**Files:**
- Modify: `/Users/deanjeggels/.claude/projects/-Users-deanjeggels-Documents-CH-ISE-Test/memory/project_aquasim_v2_shipped.md` (new)
- Modify: `/Users/deanjeggels/.claude/projects/-Users-deanjeggels-Documents-CH-ISE-Test/memory/MEMORY.md` (append entry)

**Context:** Auto-memory is the project's long-term context for future Claude sessions. Record that v2 is shipped so future sessions don't ask basic questions.

**Step 1: Write the memory file**

Create `/Users/deanjeggels/.claude/projects/-Users-deanjeggels-Documents-CH-ISE-Test/memory/project_aquasim_v2_shipped.md`:

```markdown
---
name: AquaSim v2 shipped
description: AquaSim v2 (wastewater design & proposal generator) was merged to main and deployed on 2026-04-15
type: project
---

AquaSim v2 shipped to main on 2026-04-15 as a 9-phase rebuild.

**Why:** Pivoted from "wastewater process simulator" to "wastewater design & proposal generator" — the real wedge for SA consulting engineers is collapsing the sim-to-Word-proposal cycle into one tool.

**What shipped:**
- 19 process units covering a full biological WWTP
- Auditable calculations with citations (Ekama, WRC TT-16/84, Metcalf & Eddy, supplier datasheets)
- BoQ engine with 28 real SA supplier-price entries (Huber, Megavision, Sulzer, Grundfos, Andritz, Alfa Laval, Xylem Wedeco)
- @repo/design-library workspace package
- 4 Supabase migrations (boq_line_items, project_proposals, extended flowsheets + profiles)
- 11-section live proposal document at /project/[id]/proposal/[fsid]
- Browser print-to-PDF via @media print
- Dark mode default, tablet responsive
- 134 combined tests passing (118 sim-engine + 16 design-library)

**How to apply:** Future sessions working on AquaSim should assume v2 is live. If asked about "the proposal view" or "calculation records" or "BoQ engine" — they exist as of 2026-04-15. The relevant code is under `apps/web/lib/proposal/`, `apps/web/components/inspector/`, `packages/sim-engine/src/boq/`, and `packages/design-library/src/`. All plan docs and completion summaries live under `docs/plans/`.

**Branch note:** The `v2-proposal-generator` branch was retained (not deleted) for at least 7 days post-ship for rollback availability. Safe to delete on or after 2026-04-22.

**Supabase project:** `otikhvpmjijwgnabxspd` (ATA, CH-ISE org). Migrations in `supabase/migrations/` under 4 files prefixed `20260415000001..004`.

**Repo:** `https://github.com/DeanJeggels/WaterTreatment` — tag `v2.0.0`.
```

**Step 2: Update `MEMORY.md` index**

Read `/Users/deanjeggels/.claude/projects/-Users-deanjeggels-Documents-CH-ISE-Test/memory/MEMORY.md` and add one line under the "Project" section:

```markdown
- [project_aquasim_v2_shipped.md](project_aquasim_v2_shipped.md) — AquaSim v2 shipped 2026-04-15, wastewater design & proposal generator, 9-phase rebuild
```

**Step 3: No git commit** — memory files live outside the repo.

---

### Task 11: Final verification on main

**Step 1: Full regression on main**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && git status && git branch --show-current
```
Expected: `On branch main`, clean tree.

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
(cd packages/sim-engine && npx vitest run) && \
(cd packages/design-library && npx vitest run) && \
npx turbo run check-types && \
npx turbo run build --filter=web
```
Expected: 118 + 16 passing, type check clean, web build clean.

**Step 2: Git log sanity check**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git log --oneline -5 && \
echo "---" && \
git tag -l v2.0.0 && \
echo "---" && \
git log origin/main..main --oneline
```
Expected: HEAD is the merge commit, v2.0.0 tag exists, no local-ahead commits (everything's pushed).

**Step 3: Netlify deploy URL recorded**

Record the deploy URL (e.g. `https://aquasim.netlify.app`) for the completion summary in Task 12.

---

### Task 12: Phase 9 completion summary

**Files:**
- Create: `docs/plans/2026-04-15-aquasim-v2-phase-9-COMPLETE.md`

**Step 1: Write the summary**

```markdown
# Phase 9 Complete — AquaSim v2 Shipped

**Completed:** 2026-04-15
**Merge commit:** <sha>
**Tag:** `v2.0.0`
**Deploy URL:** <netlify URL>

## What shipped
- `v2-proposal-generator` merged into `main` with a `--no-ff` merge commit carrying the full v2 release notes
- `v2.0.0` annotated tag at the merge commit
- Root `README.md` rewritten for v2 positioning with tech stack, layout, quick start, phase summary
- Obsidian Progress Log updated with a consolidated v2 entry
- Auto-memory updated with `project_aquasim_v2_shipped.md` + `MEMORY.md` index entry
- Netlify deploy from `main` verified successful
- Production landing page smoke-tested in dark mode + tablet viewport
- `v2-proposal-generator` branch retained for ≥ 7 days post-ship

## Verification state
- Sim-engine tests: 118 passing
- Design-library tests: 16 passing
- Combined: 134 passing
- Type check: clean across monorepo
- Web build: clean, 13 routes
- "simulator" grep on user-visible copy: clean
- Hardcoded color grep: clean
- Supabase security advisor (AquaSim tables): no new critical findings
- Merge commit has two parents, tag points at merge commit
- Netlify deploy succeeded, landing page loads without console errors

## Commits pushed in Phase 9
1. `README: rewrite for AquaSim v2 ship`
2. `Merge: AquaSim v2 — Wastewater Design & Proposal Generator` (--no-ff)
3. `Phase 9 complete — AquaSim v2 shipped` (this summary)

Plus tag: `v2.0.0`

## Deviations from plan
<list any>

## Rollback plan (for reference, not expected to be needed)
If a critical issue surfaces in production within the first 7 days:
1. `git revert -m 1 <merge commit sha>` on main
2. Push main
3. Netlify redeploys v1 automatically
4. Supabase migrations stay applied — the schema is forward-compatible, v1 code ignores the new columns/tables
5. `v2-proposal-generator` branch is still intact — fix on a new branch and re-ship

## Post-ship deferred work (re-capped from earlier phases)
- Server-rendered PDF via Playwright Edge Function
- `/settings` page for company branding
- BoQ override UI (schema ready in boq_line_items, UI deferred)
- Version history browser UI for project_proposals
- Proposal view on shared /shared/[token] routes
- Multi-region support (SA-only in v1)
- `flowsheets.discharge_standards` column unification with DWA_LIMITS
- `simulation_runs` table cleanup (deprecated in v2, still in schema)

## Next
Start collecting real user feedback from 2-3 beta engineers. Iterate
based on what they actually use vs what we assumed they'd use.
```

**Step 2: Commit on main**

This is the first and only commit we make directly on main after the merge. Keep it scoped to the completion summary only.

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add docs/plans/2026-04-15-aquasim-v2-phase-9-COMPLETE.md && \
git commit -m "Phase 9 complete — AquaSim v2 shipped" && \
git push origin main
```

**Step 3: Re-verify Netlify builds this second push successfully**

A second deploy triggers. Wait for it. Nothing should change user-visible; this deploy only adds a docs file.

---

## Summary of commits expected for Phase 9

| # | Task | Commit (on which branch) | Message |
|---|---|---|---|
| 0 | Pre-merge verify | — | (no commit) |
| 1 | Regression | — | (no commit) |
| 2 | README rewrite | `v2-proposal-generator` | `README: rewrite for AquaSim v2 ship` |
| 3 | Obsidian update | — | (no git commit — Obsidian is outside the repo) |
| 4 | Release notes draft | — | (no commit) |
| 5 | Merge to main | `main` | `Merge: AquaSim v2 — Wastewater Design & Proposal Generator` (--no-ff) |
| 6 | Tag v2.0.0 | — | (tag, not a commit) |
| 7 | Push main + tag | — | (push, not a commit) |
| 8 | Netlify verify | — | (no commit) |
| 9 | Prod smoke test | — | (no commit) |
| 10 | Memory update | — | (no git commit — memory is outside the repo) |
| 11 | Final verify | — | (no commit) |
| 12 | Phase 9 summary | `main` | `Phase 9 complete — AquaSim v2 shipped` |

Total: 3 commits on the repo (2 on `v2-proposal-generator` / the README one gets pulled in via the merge, 1 merge commit, 1 completion summary directly on main), 1 tag, 2 pushes.

---

## Notes for the executor

1. **This is the highest-stakes phase.** Every task has a verification step. If any verification fails, STOP, do not proceed. Investigate before continuing.

2. **The merge is explicitly `--no-ff`.** Even though fast-forward would work, the `--no-ff` gives us a named merge commit on main that's easy to revert if needed. The merge commit message is the v2 release notes and becomes permanent history.

3. **Do NOT squash.** 130+ commits of detailed phase history should be preserved. Squashing loses the audit trail.

4. **Do NOT delete the `v2-proposal-generator` branch.** Retention for ≥ 7 days post-ship is the rollback safety net. A calendar reminder or auto-memory note is fine; just don't `git branch -d` it from Task 5 onwards.

5. **Verification-before-completion applies with extra rigor here.** Run the full sim-engine + design-library + type check + web build on `v2-proposal-generator` BEFORE merging, and AGAIN on `main` AFTER merging. Two separate runs, each passing fresh. No "I ran it recently, it's probably still green" shortcuts.

6. **If Netlify deploy fails**, the most likely causes are:
   - Missing env var in Netlify dashboard (Supabase URL/anon key)
   - Node version mismatch (Netlify defaults to Node 18; ensure the project's expected version matches)
   - Turbo cache problem (clear cache + redeploy)
   Investigate the Netlify build logs. Do not push panic commits.

7. **Post-merge regression pass is CRITICAL.** Merge commits can introduce weird state if any part of the merge machinery misbehaves. Always re-run the full suite on `main` immediately after merging, BEFORE pushing.

8. **Pushing to main is the point of no return.** Everything before `git push origin main` is locally reversible. Everything after triggers a Netlify production deploy. Pause, re-verify, then push.

9. **The rollback plan in Task 12 is a documented safety net, not a plan to execute.** Only use it if a truly critical production issue appears within the first few days. Schema changes stay applied — they're forward-compatible.

10. **If the user is not available** to set Netlify env vars or verify the deploy dashboard, stop at Task 7 Step 4 and report. The push has happened but the deploy verification is a user-facing step.

11. **The Phase 9 completion summary is the last commit.** After it, Phase 9 is done and AquaSim v2 is shipped.
