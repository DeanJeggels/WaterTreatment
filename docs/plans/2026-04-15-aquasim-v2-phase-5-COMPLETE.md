# Phase 5 Complete — UI Design System Overhaul

**Completed:** 2026-04-15
**Branch:** `v2-proposal-generator`
**Commits:** 11 on top of `61520b6 Add AquaSim v2 Phase 5 implementation plan`

## What shipped

### Design system
- `ui-ux-pro-max` invoked with the AquaSim consulting-engineer brief; recommendation persisted verbatim to [docs/design-system/2026-04-15-ui-ux-pro-max-brief.md](../design-system/2026-04-15-ui-ux-pro-max-brief.md)
- Named style: **Technical Slate** (derived from ui-ux-pro-max's "Dark Mode (OLED)" entry)
- `apps/web/app/globals.css` collapsed from two conflicting `:root`/`.dark` blocks (shadcn HSL + neutral oklch) into a single HSL set with complete `hsl()` values so Tailwind v4 `@theme inline` can reference them directly
- Palette: slate + green accent. Dark mode primary is green (#22C55E / `142 71% 45%`); light mode primary is slate-900 with green reserved as accent/ring so the palette stays restrained on white
- New canvas-specific tokens: `--canvas-bg`, `--canvas-dots`, `--canvas-edge`, `--canvas-edge-selected`, `--canvas-node-border`, `--canvas-node-border-selected`, `--canvas-handle`
- Chart tokens retuned for the new palette (green, sky, purple, amber, red)
- Radius kept at shadcn default `0.5rem` — skill did not recommend a change
- Tabular numerals enforced on `td`, `th`, and `.tabular` utility via `font-variant-numeric`

### Typography
- Geist → **Fira Sans** (body, 300/400/500/600/700) + **Fira Code** (mono, 400/500/600) via `next/font/google`
- `--font-sans` and `--font-mono` wired via `@theme inline`
- Metadata title + description updated for the "Design & Proposal Generator" positioning

### Theme toggle
- [apps/web/components/theme-provider.tsx](../../apps/web/components/theme-provider.tsx) — zero-dep Context + `useEffect` hydration from `aquasim-theme` in `localStorage`
- [apps/web/components/theme-toggle.tsx](../../apps/web/components/theme-toggle.tsx) — Sun/Moon ghost icon button
- SSR default stays dark (`<html className="dark">` + `suppressHydrationWarning`) so there's no light-mode flash on first paint
- Wired into dashboard header next to `SubscriptionManager`

### Layout primitives
- [apps/web/components/layout/page-shell.tsx](../../apps/web/components/layout/page-shell.tsx)
- [apps/web/components/layout/page-header.tsx](../../apps/web/components/layout/page-header.tsx)
- [apps/web/components/layout/empty-state.tsx](../../apps/web/components/layout/empty-state.tsx)
- Barrel export at `apps/web/components/layout/index.ts`
- Phase 6 (Inspector) and Phase 7 (Proposal view) inherit these without modification

### Canvas styling
- Removed hardcoded `#94a3b8` edge stroke from [Canvas.tsx](../../apps/web/components/canvas/Canvas.tsx) — edges now driven by `.react-flow__edge-path { stroke: var(--canvas-edge) }` rule in `globals.css`, with `.selected` variant switching to `--canvas-edge-selected`
- Background dots: `BackgroundVariant.Dots`, `gap=20`, `size=1`, `color="var(--canvas-dots)"` (muted-foreground at 18% alpha)
- MiniMap node/mask colors switched from hardcoded `hsl(var(--primary))` strings to `var(--primary)` / `var(--muted)`
- Handle styling (10×10 circles, primary fill, 2px background border) injected via `.react-flow__handle` global rule so it inherits the theme automatically
- [ProcessUnitNode.tsx](../../apps/web/components/canvas/custom-nodes/ProcessUnitNode.tsx) status borders: `green-500`/`red-500` → `border-primary`/`border-destructive` with matching shadow colors

### Unit palette
- [UnitPalette.tsx](../../apps/web/components/canvas/UnitPalette.tsx) rewritten with category grouping:
  `Flow I/O`, `Preliminary`, `Primary`, `Biological`, `Tertiary`, `Sludge`, `Utility`
- 19 unit types grouped via local `UNIT_CATEGORY` map (`UnitDefinition` does not carry a category field in `@repo/sim-engine` — the plan assumed it did; the deviation is noted below)
- Category labels in `uppercase tracking-wider` small-caps, Swiss-style
- Icon tint transitions from `muted-foreground` → `primary` on group hover
- Palette widened from `w-48` to `w-56` to accommodate longer labels at the new font size

### Tablet responsiveness (iPad Pro target)
- **Top bar** ([page.tsx:159-212](../../apps/web/app/project/[id]/flowsheet/[flowsheetId]/page.tsx#L159-L212)): button labels hide below `md:`, keeping icons with tooltips. Path crumbs (`project / flowsheet`) hide below `sm:` / `md:` to free space
- **Inspector panel**: on `lg:` (≥1024px) it stays as the permanent right rail; below `lg:` it collapses into a right-side Sheet triggered by a floating `SlidersHorizontal` button at `bottom-4 right-4`
- No horizontal-scroll leaks in the editor's main content flex row

### Hardcoded color audit
- `grep -rnE "(slate|gray|zinc|neutral)-[0-9]{2,3}" apps/web/components/ apps/web/app/` → **zero hits**
- Shadcn primitives under `apps/web/components/ui/` were already clean — the only leaks were in `canvas/` and they've been fixed

## Verification state

| Check | Result |
|---|---|
| Sim-engine tests | **118 passing** (unchanged) |
| Design-library tests | **16 passing** (unchanged) |
| Combined | **134 passing** (no logic changes this phase) |
| `turbo run check-types` | Clean (sim-engine, design-library, ui, web) |
| `turbo run build --filter=web` | Clean, 12 routes |
| Hardcoded color grep | No hits in `apps/web/{components,app}` |
| Before/after screenshots | `docs/design-system/before/` (4 dark) + `docs/design-system/after/` (4 dark + 4 light) |

## Deviations from plan

1. **`UnitDefinition.category` didn't exist.** The plan assumed the sim-engine type carried a `category: 'preliminary' | 'primary' | ...` field. It doesn't — only BOQ line items have a `category` field, and that's for civil/mechanical cost grouping. Worked around by introducing a local `UNIT_CATEGORY` map inside `UnitPalette.tsx`. No engine/type changes were needed. If we later want the engine to own categories, we'd add the field to `UnitDefinition` in `packages/sim-engine/src/types.ts` and remove the local map.

2. **`globals.css` had two conflicting `:root`/`.dark` blocks pre-Phase-5.** The first used shadcn HSL defaults, the second used neutral oklch and *overrode* the first. Phase 5 consolidates to a single HSL set; the pre-existing mess is preserved for reference in the design-system brief file.

3. **`Fira Code` replaces `Geist Mono` without a display face.** ui-ux-pro-max offered an optional display pairing but the brief explicitly rejects marketing display type — we stayed with Fira Sans body for headings too (at weight 600/700).

4. **Task 1 screenshots.** `/dashboard`, `/login`, `/project/new` all render as the login screen in unauthenticated Playwright sessions (they either are login or redirect to it server-side). The "before/after" diff is therefore most visible on `/` (landing, 540KB → 598KB dark / 588KB light) and the login page itself. A fully-auth'd capture would need session cookies plumbed into Playwright — left for a later polish pass.

5. **ui-ux-pro-max's "Horizontal Scroll Journey" pattern** was discarded. It's a landing-page conversion pattern for product showcases and makes no sense for a dashboard app. Only the palette/typography/effects portions of the recommendation were applied.

## Next: Phase 6

Inspector panel redesign with inline calculation records. Consumes the Phase 5 tokens + layout primitives without modification. Draft plan: `docs/plans/YYYY-MM-DD-aquasim-v2-phase-6-inspector.md`.

Branch stays on `v2-proposal-generator` — **do not merge to main**.
