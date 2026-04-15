# Phase 9 Complete — AquaSim v2 Shipped

**Completed:** 2026-04-15
**Merge commit:** `81de07c27f6727a0d63308e8b49bde77728da409`
**Tag:** `v2.0.0` (annotated, points at the merge commit)
**Deploy URL:** https://aquasimulation.netlify.app/

## What shipped

- **`v2-proposal-generator` merged into `main`** with a `--no-ff` merge commit carrying the full v2 release notes. Merge commit has two parents: `fb3a00d` (old main tip) and `80b37d8` (branch tip). 132 commits came across via the merge.
- **`v2.0.0` annotated tag** created at the merge commit with a short-form release note. Verified pointer: `git rev-parse v2.0.0^{commit}` == `git rev-parse HEAD`.
- **Root `README.md` rewritten** for v2 positioning — dropped the Turborepo-starter scaffolding, added tech stack table, monorepo layout, quick start, env vars, Supabase project info, 9-phase table, test count progression.
- **Obsidian Progress Log** at `/Users/deanjeggels/Documents/Obsidian Vault/CH-ISE/BioWin Clone/Progress Log.md` extended with a "Phase 6: AquaSim v2" consolidated entry (v1 phases preserved above it).
- **Obsidian README** at `/Users/deanjeggels/Documents/Obsidian Vault/CH-ISE/BioWin Clone/README.md` title + status line updated: "Wastewater Treatment Process Simulator" → "Wastewater Design & Proposal Generator"; phase line → "v2 Shipped (2026-04-15)".
- **Auto-memory updated**: new `project_aquasim_v2_shipped.md` entry + one line in `MEMORY.md` under Project.
- **Pushed to origin**:
  - `main` → origin/main (`1eb4191..81de07c`, 136 commits advanced)
  - `v2.0.0` tag
  - `v2-proposal-generator` branch (for rollback availability)
- **`v2-proposal-generator` branch retained** (not deleted). Safe to delete on or after 2026-04-22.

## Verification state

| Check | On branch (pre-merge) | On main (post-merge) |
|---|---|---|
| Sim-engine tests | 118 passing | 118 passing |
| Design-library tests | 16 passing | 16 passing |
| Combined | **134** | **134** |
| `turbo run check-types` | 4/4 tasks clean | 4/4 tasks clean |
| `turbo run build --filter=web` | Clean, 13 routes | Clean, 13 routes |
| Hardcoded color grep (`slate|gray|zinc|neutral`) in `apps/web/{app,components,lib}` | No hits | No hits |
| `simulator` grep on user-visible copy | **1 hit, fixed** (see deviation 1) | No hits |
| Supabase security advisor (AquaSim tables) | No new critical findings | n/a |
| Merge commit parents | n/a | 2 parents confirmed |
| Tag points at merge commit | n/a | Confirmed |

GitHub state verified via `gh api`:
- `repos/DeanJeggels/WaterTreatment/commits/main` → `81de07c27...`
- `repos/DeanJeggels/WaterTreatment/tags v2.0.0` → `81de07c27...`
- `repos/DeanJeggels/WaterTreatment/branches/v2-proposal-generator` → `80b37d83...`

## Commits pushed in Phase 9

1. `Landing: remove residual 'simulator' mention from email template` (`9084ba0`, on branch — discovered during Task 1 regression)
2. `README: rewrite for AquaSim v2 ship` (`80b37d8`, on branch)
3. `Merge: AquaSim v2 — Wastewater Design & Proposal Generator` (`81de07c`, on main, `--no-ff`)

Plus:
- Tag: `v2.0.0`
- (Not yet committed) `Phase 9 complete — AquaSim v2 shipped` — this file, committed and pushed after operator confirms Netlify deploy succeeded

## Deviations from plan

1. **One "simulator" leak caught and fixed during Task 1 regression.** The Phase 8 grep was scoped to `apps/web/app/` and missed `apps/web/lib/email-templates/confirmation.html:37` which had `WASTEWATER PROCESS SIMULATOR` in the header paragraph of the signup confirmation email. Phase 9's regression grep was broader (`apps/web/{app,components,lib}`) and caught it. Fixed on the branch with commit `9084ba0` before the merge. The grep on main post-merge is clean.

2. **Local main was 2 commits ahead of origin/main at Task 0.** The commits were `fb3a00d Add AquaSim v2 Phase 1a implementation plan` and `c8c9376 Add AquaSim v2 design doc — WWTP proposal generator` — design docs that were committed to local main at the start of the v2 work but never pushed. These are ancestors of the branch anyway and pushed cleanly with the merge. Not a blocker; plan's Task 0 only gates on "origin/main ahead of local main" which was empty.

3. **GitHub account had to be switched before pushing.** The local `gh` CLI had two accounts authenticated, with `deancorserv` active. That account does not have push access to `DeanJeggels/WaterTreatment`. First push attempt failed with 403. Resolved with `gh auth switch -u DeanJeggels` + `gh auth setup-git`, then the push succeeded. Noted in the auto-memory so future sessions know.

4. **Task 8 done via operator confirmation; Task 9 partial (HTTP-level).** I don't have browser access from this environment, so Task 8 (Netlify dashboard) was verified by the operator, and Task 9 was executed as a curl-based HTTP smoke test from this session (see "User-verified" below). The live site returns 200, the new title + hero + CTA + feature copy are present, `simulator` occurrences on `/` are zero, and the auth-gated routes (`/dashboard`, `/project/[id]/proposal/[fsid]`) return the expected 307. The remaining browser-only checks (DevTools console errors, click-through nav, iPad Pro visual) are the operator's to run at leisure.

5. **Task 12 commit finalised after deploy confirmation.** Per the plan's Task 12 Step 2, the completion summary gets committed directly on main after the merge. I held the commit until the deploy URL was confirmed, then updated this file with the URL + HTTP smoke results before committing.

## User-verified

- **Task 8 (Netlify deploy)**: Operator confirmed the deploy published at `https://aquasimulation.netlify.app/`.
- **Task 9 (HTTP smoke test)** from this session — all assertions against the live `/`:
  - HTTP 200, ~92 KB HTML response
  - `<title>`: `AquaSim — Wastewater Design & Proposal Generator` ✓
  - Hero badge "Wastewater design" present ✓
  - Tagline "Deliver" present ✓
  - CTA "Stop building proposals" present ✓
  - Feature "Real SA supplier prices" present ✓
  - `simulator` occurrences on live `/`: **0**
- **Additional route checks:**
  - `/login` → 200
  - `/register` → 200
  - `/dashboard` → 307 (auth gate working)
  - `/project/demo/proposal/demo` → 307 (Phase 7 proposal route deployed, middleware gating correctly)
- **Full browser smoke (DevTools console, click-through navigation, iPad Pro viewport)** is still the operator's to run at leisure. The HTTP-level checks above confirm the new build is live and the expected copy landed — visual regressions or console errors are the only thing a browser session can catch beyond what curl + grep proved.

## Rollback plan (for reference, not expected to be needed)

If a critical issue surfaces in production within the first 7 days:

1. `git checkout main && git revert -m 1 81de07c` — creates a revert commit
2. `git push origin main` — Netlify redeploys v1 automatically
3. Supabase migrations stay applied — schema is forward-compatible, v1 code ignores the new columns/tables
4. `v2-proposal-generator` branch is still intact on origin — fix on a new branch and re-ship

## Post-ship deferred work (re-capped from earlier phases)

- Server-rendered PDF via Playwright Edge Function
- `/settings` page for company branding
- BoQ override UI (schema ready in `boq_line_items`, UI deferred)
- Version history browser UI for `project_proposals`
- Proposal view on shared `/shared/[token]` routes
- Multi-region support (SA-only in v1)
- `flowsheets.discharge_standards` column unification with `DWA_LIMITS`
- `simulation_runs` table cleanup (deprecated in v2, still in schema)

## Next

Start collecting real user feedback from 2–3 beta engineers. Iterate based on what they actually use vs what we assumed they'd use.
