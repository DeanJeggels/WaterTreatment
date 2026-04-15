# Phase 8 Complete — Landing Page Rewrite

**Completed:** 2026-04-15
**Branch:** `v2-proposal-generator`
**Commits:** 6 on top of `4bbfc04 Add AquaSim v2 Phase 8 implementation plan` + 1 summary

## What shipped

Every edit was to [apps/web/app/page.tsx](../../apps/web/app/page.tsx) — single file, ~260 lines, pure content/structural rewrite. No new files, no new deps, no new routes.

### Hero
- Badge: "Web-based wastewater process simulator" → "Wastewater design & proposal generator"
- Tagline: "Design. Simulate. **Comply.**" → "Design. Simulate. **Deliver.**" (kept "Simulate" as the verb engineers do, pivoted the payoff from compliance to the deliverable)
- Sub-copy pivoted to "From wastewater sample to client-ready design proposal in the same tool. Auditable calculations, real South African supplier prices, and one-click PDF export."
- CTA copy lowercased ("Start free", "Sign in") for engineer-to-engineer voice
- Added "Built for SA consulting engineers." to the under-CTA line

### Features grid (6 cards)
Replaced the generic simulator-tool cards with Phase 1b–7 deliverables:
1. **Drag-and-drop flowsheet editor** (GitBranch) — 19 process units
2. **Every number is defensible** (Calculator) — equation + inputs + citation per value
3. **Real SA supplier prices** (Receipt) — Huber, Megavision, Sulzer, Grundfos, Andritz, Alfa Laval, Xylem Wedeco
4. **DWA compliance, built in** (ClipboardCheck) — NWA General/Special limits
5. **Client proposals in one click** (FileText) — 11-section design report + browser print-to-PDF
6. **Full biological train coverage** (Layers) — preliminary through sludge

New lucide-react icons added to the existing import: `Calculator`, `Receipt`, `ClipboardCheck`, `Layers`. Unused `Droplets`, `BarChart3`, `Shield`, `Users` dropped.

### Process units showcase
- `processUnits` data shape changed from `string[]` (10 names) to `{ category; units[] }[]` (6 categories, 20 line items across them)
- Section rendering replaced — previously a flat arrow-chain of 10 pills, now a 3-column grid of category groups, each with a small bullet list
- Section heading added: "19 process units covered" with sub-copy "From headworks to sludge disposal — everything you need for a full biological plant design."
- Ordering follows the real-world design workflow: Preliminary → Primary → Biological → Secondary & Tertiary → Sludge → Flow & Utility
- Section padding bumped from `py-8` to `py-12` to breathe better at the new density

### Pricing tiers
- Prices and tier structure unchanged (`$0` / `$49` / `$199`, Free / Pro / Enterprise) — Stripe depends on them
- Free bullets refreshed — added "Mass balance + compliance checks" and the honest "No proposal PDF export"
- Pro bullets pivoted to Phase 7 value: "One-click proposal PDF", "Save & version BoQ per project", "Override supplier prices per project", "Full calculation audit trail"
- Enterprise bullets refreshed: "Team workspaces & shared price libraries", "Company branding on proposals", "API access", "Priority support"
- Descriptions lowercased / tightened for voice consistency

### CTA section
- Heading: "Ready to modernize your process design?" → "Stop building proposals in Word."
- Sub-copy rewritten to frame AquaSim as the single workflow from calculation → BoQ → proposal export
- Button copy: "Create Your Free Account" → "Create your free account"

### Footer
- Right-side text: "Wastewater Treatment Process Simulator" → "Wastewater design & proposal generator"

### Screenshots
- `docs/design-system/landing-before-phase-8.png` (dark, 599 KB)
- `docs/design-system/landing-after-phase-8.png` (dark, 868 KB — page grew because it has more content)
- `docs/design-system/landing-after-phase-8-light.png` (light, 853 KB)

Light-mode capture confirms Phase 5 tokens render correctly on the landing page without hardcoded leaks.

### Tooling added
- [scripts/landing-screenshot.mjs](../../scripts/landing-screenshot.mjs) — reuses the Playwright pattern from Phases 5/6/7. Supports `THEME=light` to force light mode via an init script + post-load class removal, since the landing page has no theme toggle.

## Verification state

| Check | Result |
|---|---|
| Sim-engine tests | **118 passing** (unchanged) |
| Design-library tests | **16 passing** (unchanged) |
| Combined | **134 passing** |
| `turbo run check-types` | Clean (sim-engine, design-library, ui, web) |
| `turbo run build --filter=web` | Clean, **13 routes** (unchanged) |
| `grep -i simulator apps/web/app/` | **No matches** — user-visible copy is simulator-free |

## Deviations from plan

1. **Task 6 committed nothing.** The grep came back empty — no residual "simulator" mentions in `apps/web/app/`. Plan anticipated this ("if any") so no deviation in spirit, just noting the commit count is one less than the upper end of the plan's 6-8 estimate.

2. **Dropped unused icon imports.** The plan said to "add the new icons" but didn't say what to do with the ones no longer used. `Droplets`, `BarChart3`, `Shield`, `Users` were removed from the import since they're unreferenced. `GitBranch`, `FileText`, `CheckCircle`, `ArrowRight`, `Zap`, `Crown` kept because they're still in use. TypeScript/ESLint would flag unused imports anyway.

3. **Light-mode screenshot via Playwright, not DevTools.** Plan suggested manual DevTools edit of `<html>` class. I scripted it in [landing-screenshot.mjs](../../scripts/landing-screenshot.mjs) so the capture is reproducible. The script removes `dark` class post-load (after Tailwind's CSS has applied) which works because the landing page reads `.dark` at render time.

## Commits

```
0f17cc9 Capture landing page post-Phase 8 screenshots (dark + light)
b938911 Landing: rewrite hero, CTA section, and footer for proposal-generator positioning
f54c3a8 Landing: refresh pricing tier feature bullets for proposal-generator positioning
d2e8663 Landing: expand process units showcase to 19 units grouped by category
34ef9ba Landing: rewrite features grid for proposal-generator positioning
8b70ec8 Capture landing page pre-Phase 8 screenshot
```

## Next: Phase 9

Merge-to-main + deploy. Regression smoke test the full stack on `v2-proposal-generator`, verify every previous phase still holds, merge into `main`, push, update the README, update the Obsidian progress log.

Branch stays on `v2-proposal-generator` — **do not merge to main**.
