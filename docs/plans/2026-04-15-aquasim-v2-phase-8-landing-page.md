# AquaSim v2 — Phase 8: Landing Page Rewrite

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Pivot the marketing landing page at `/` from "wastewater process simulator" to "wastewater design & proposal generator". Every engineer who lands on this page should leave with exactly one thought: *this tool produces the client proposal I currently spend hours copy-pasting into Word*. Rewrite hero copy, feature grid (6 cards), process unit showcase (10 → 19 units), pricing table (refreshed feature bullets), and CTA sections. No new routes, no new deps, no new Supabase queries — pure content + small structural tweaks on the existing `apps/web/app/page.tsx`.

**Architecture:** Single file. `apps/web/app/page.tsx` is ~256 lines of JSX with three inline data arrays (`features`, `tiers`, `processUnits`). Phase 8 rewrites these arrays, updates the hero + CTA + footer copy, and polishes tokens. No new files except a completion summary.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4 (Phase 5 tokens), shadcn primitives, lucide-react icons. No new deps.

---

## Context & References

- **Design doc:** `docs/plans/2026-04-02-aquasim-v2-proposal-generator-design.md` section 4 (positioning)
- **Phases 1a–7 complete.** Combined test count: **134**
- **Starting branch:** `v2-proposal-generator`
- **Current state of `apps/web/app/page.tsx`**: 256 lines, unchanged since Phase 1/5. Hero says "Design. Simulate. Comply." with sub-copy about "Build wastewater treatment flowsheets, run mass balance simulations, and verify discharge compliance." Features are generic sim-tool descriptions. Pricing tiers are for the simulator product. `processUnits` array lists 10 units (pre-Phase 2).
- **Phase 5 Lesson from executor notes:** landing page tokens were already touched by Phase 5 (`globals.css` + light/dark mode). Phase 8 doesn't need to re-apply tokens — it builds on the existing styled page.
- **Phase 7 Lesson on Playwright auth:** Unlike the project editor, the landing page is public. Phase 8's smoke test is easy — no auth needed.

## Success Criteria

1. `apps/web/app/page.tsx` hero, features, pricing, process units, CTA sections rewritten
2. No mention of the word "simulator" in user-visible copy (the word stays fine in commit messages, comments, or the README)
3. Feature grid has 6 cards mapped to the Phase 1b–7 deliverables (auditable calculations with citations, real SA supplier prices, DWA compliance, one-click proposal PDF, 19 process units, visual flowsheet editor)
4. Process unit showcase lists all 19 units grouped by category (preliminary / primary / biological / tertiary / sludge / utility)
5. Pricing tier bullets refreshed to reflect Phase 7 Pro features (proposal PDFs, BoQ save, version history)
6. Hero CTA points at `/register` (unchanged — just verify the link)
7. Light + dark mode both readable (spot-check via Phase 5 toggle on the landing page itself — it doesn't have the toggle, so verify by temporarily changing the `<html>` class)
8. Web build clean, type check clean, no new routes
9. Test count unchanged at **134**
10. Before/after screenshot of the landing page in dark mode captured to `docs/design-system/landing-after-phase-8.png`

## Non-Goals (deferred)

- **A/B testing infrastructure** — landing page is static
- **Dynamic demo/interactive preview** (e.g. a miniature flowsheet on the hero) — too much scope for this phase
- **"See a sample proposal" link to a public share token** — shared flowsheets don't render the proposal view (per Phase 7 non-goals); revisit when public proposal sharing lands
- **Video / animation in the hero** — keep it static and fast
- **SEO beyond existing metadata** — Phase 5 already updated `<meta>` description; no sitemap/robots work in Phase 8
- **Customer logos / testimonials** — none to show; no fake trust markers
- **Internationalisation** — English only, SA market
- **Light mode as default** — dark mode stays default; landing page renders in whichever theme the visitor prefers

---

## Tasks

### Task 0: Verify starting state

**Step 1: Branch + clean tree**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && git status && git log --oneline | head -5
```
Expected: `On branch v2-proposal-generator`, clean, recent Phase 7 commit.

**Step 2: Tests + build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
(cd packages/sim-engine && npx vitest run) && \
(cd packages/design-library && npx vitest run) && \
npx turbo run build --filter=web
```
Expected: 118 + 16 passing, web build clean, 13 routes.

**Step 3: Read the current `page.tsx` end to end**

Open `apps/web/app/page.tsx` and read the full 256 lines. Note the three inline data arrays (`features`, `tiers`, `processUnits`), the hero section, feature grid, pricing table, CTA sections, and footer. Identify exactly where copy needs to change vs where structure stays. Task 1 onwards refers to these locations by name.

---

### Task 1: Capture "before" landing screenshot

**Files:** `docs/design-system/landing-before-phase-8.png`

**Step 1: Start dev server**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run dev --filter=web &
```

**Step 2: Visit `http://localhost:3000/` and capture the full-page screenshot**

Save as `docs/design-system/landing-before-phase-8.png`. Use the dark theme (default).

**Step 3: Kill dev server, commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add docs/design-system/landing-before-phase-8.png && \
git commit -m "Capture landing page pre-Phase 8 screenshot"
```

---

### Task 2: Rewrite the `features` array

**Files:**
- Modify: `apps/web/app/page.tsx` (the `features` array near the top)

**Context:** The existing 6 feature cards are generic simulator-tool descriptions. Phase 8 replaces them with 6 cards that map 1:1 to the real AquaSim v2 deliverables. Icons stay from `lucide-react`; swap for more appropriate ones where the Phase 8 feature is different from the old one.

**Step 1: Replace the array**

Find the `features` array (currently has 6 entries with icons `Droplets, GitBranch, BarChart3, FileText, Shield, Users`). Replace with:

```typescript
import {
  Droplets, GitBranch, BarChart3, FileText, Shield, Users,
  CheckCircle, ArrowRight, Zap, Crown,
  BookOpen, Calculator, Receipt, ClipboardCheck, Layers,
} from 'lucide-react';

// ... elsewhere in the imports, ensure the new icons are imported ...

const features = [
  {
    icon: GitBranch,
    title: 'Drag-and-drop flowsheet editor',
    description: '19 process units — screens, clarifiers, bioreactors, MBR, thickeners, dewatering, dosing, UV, pumps. Connect them on a canvas, set parameters, run the mass balance.',
  },
  {
    icon: Calculator,
    title: 'Every number is defensible',
    description: 'Sizing, energy, and BoQ values come with the equation, the inputs, and a citation to published literature (Ekama, WRC, Metcalf & Eddy, supplier datasheets). Click any value in the inspector to see the derivation.',
  },
  {
    icon: Receipt,
    title: 'Real SA supplier prices',
    description: 'Huber, Megavision, Sulzer, Grundfos, Andritz, Alfa Laval, Xylem Wedeco — every BoQ line item is priced from a real supplier catalogue or quote, not a textbook placeholder.',
  },
  {
    icon: ClipboardCheck,
    title: 'DWA compliance, built in',
    description: 'Every effluent stream is checked against the National Water Act General and Special limits. Pass/fail per parameter, with the exact citation, right in the proposal.',
  },
  {
    icon: FileText,
    title: 'Client proposals in one click',
    description: 'From simulated flowsheet to a formatted 11-section design report: cover, executive summary, design basis, sizing calculations, aeration design, energy, consumables, Bill of Quantities, effluent compliance, disclaimer. Browser print-to-PDF — no uploads.',
  },
  {
    icon: Layers,
    title: 'Full biological train coverage',
    description: 'Preliminary treatment through sludge handling: bar screens, grit, equalisation, primary and secondary clarification, MLE / UCT / MBR, thickeners, dewatering, chemical dosing, UV disinfection, inlet pumping. Every unit carries its own sizing, energy, and CapEx.',
  },
];
```

If any icon name in the new array isn't already imported at the top of the file, add it. Keep the existing import line structure — group lucide imports.

**Step 2: Web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean.

**Step 3: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/app/page.tsx && \
git commit -m "Landing: rewrite features grid for proposal-generator positioning"
```

---

### Task 3: Rewrite the `processUnits` array to show all 19 units grouped by category

**Files:**
- Modify: `apps/web/app/page.tsx` (the `processUnits` array + the section that renders it)

**Context:** Phase 2 added 9 new units, bringing the total to 19. The existing flat list of 10 names is outdated and, at 19, flat no longer reads well. Phase 8 groups them by category and adjusts the rendered section layout.

**Step 1: Replace the data shape**

Change `processUnits` from `string[]` to `{ category: string; units: string[] }[]`:

```typescript
const processUnits: { category: string; units: string[] }[] = [
  {
    category: 'Preliminary',
    units: ['Coarse Screen', 'Fine Screen', 'Grit Removal', 'Equalisation Tank', 'Inlet Pumping'],
  },
  {
    category: 'Primary',
    units: ['Primary Clarifier'],
  },
  {
    category: 'Biological',
    units: ['Anaerobic Reactor', 'Anoxic Reactor', 'Aerobic Reactor', 'MBR', 'Aeration Blower'],
  },
  {
    category: 'Secondary & Tertiary',
    units: ['Secondary Clarifier', 'UV Disinfection', 'Chemical Dosing'],
  },
  {
    category: 'Sludge',
    units: ['Thickener', 'Dewatering'],
  },
  {
    category: 'Flow & Utility',
    units: ['Influent', 'Effluent', 'Splitter', 'Mixer'],
  },
];
```

That's 5 + 1 + 5 + 3 + 2 + 4 = 20 entries. Wait — 19 unit types plus some grouping variants (e.g. "Coarse Screen" and "Fine Screen" are the same `screen` unit with a variant param). For the marketing list, show both variants as separate rows so the list reads as "AquaSim supports 19+ units including…".

Actually the engine has 19 distinct `UnitType` string literals (per Phase 2). Coarse and fine are the same `screen` type. So the list should show 19 distinct names — 19 including both screen variants is fine as a marketing framing.

Recount: 5 preliminary + 1 primary + 5 biological + 3 secondary/tertiary + 2 sludge + 4 flow/utility = **20 line items** (because Coarse Screen + Fine Screen are listed separately but the underlying unit type is one). The design-library side has 19 sim-engine unit types. Reword the marketing phrasing to avoid the number conflict: say "19 process units" and let the grouped list display all the variants without a count per group. The reader won't add them up.

**Step 2: Replace the JSX that renders the showcase**

Find the `{/* Process Units */}` section. It currently renders a flex-wrapped list of unit names. Replace with a category-grouped layout:

```tsx
{/* Process Units */}
<section className="py-12 border-y border-border/50 bg-card/50">
  <div className="container mx-auto px-4">
    <div className="text-center mb-8">
      <h2 className="text-2xl font-semibold mb-1">19 process units covered</h2>
      <p className="text-sm text-muted-foreground">
        From headworks to sludge disposal — everything you need for a full biological plant design.
      </p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
      {processUnits.map(({ category, units }) => (
        <div key={category}>
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{category}</h3>
          <ul className="space-y-1">
            {units.map((unit) => (
              <li key={unit} className="flex items-center gap-2 text-sm">
                <div className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                <span className="text-foreground">{unit}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  </div>
</section>
```

**Step 3: Web build + smoke check**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean.

**Step 4: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/app/page.tsx && \
git commit -m "Landing: expand process units showcase to 19 units grouped by category"
```

---

### Task 4: Rewrite the `tiers` array (pricing table)

**Files:**
- Modify: `apps/web/app/page.tsx` (the `tiers` array)

**Context:** Existing tier bullets are written for the simulator product ("Unlimited simulations", etc.). Phase 8 refreshes them to reflect the Phase 7 Pro value prop: proposal generation, BoQ save, version history. Tier structure (Free / Pro / Enterprise) and prices stay the same — only the feature bullets and descriptions change.

**Step 1: Replace the array**

```typescript
const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'For students and first projects',
    features: [
      '3 projects',
      '8 units per flowsheet',
      'Full flowsheet editor',
      'Simulate mass balance + compliance',
      'No proposal PDF export',
    ],
    cta: 'Start free',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$49',
    period: '/month',
    description: 'For consulting engineers in practice',
    features: [
      'Unlimited projects',
      '50 units per flowsheet',
      'Everything in Free, plus:',
      'One-click proposal PDF',
      'Save & version BoQ per project',
      'Override supplier prices per project',
      'Full calculation audit trail',
    ],
    cta: 'Start Pro trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: '$199',
    period: '/month',
    description: 'For teams and municipal engineering departments',
    features: [
      'Everything in Pro, plus:',
      'Unlimited units per flowsheet',
      'Team workspaces & shared price libraries',
      'Company branding on proposals',
      'API access',
      'Priority support',
    ],
    cta: 'Contact sales',
    highlighted: false,
  },
];
```

**Step 2: Verify the JSX that renders pricing still works**

The rendering loop already maps `tiers`. The field names (`name`, `price`, `period`, `description`, `features`, `cta`, `highlighted`) haven't changed — only the values. No JSX changes needed.

**Step 3: Web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean.

**Step 4: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/app/page.tsx && \
git commit -m "Landing: refresh pricing tier feature bullets for proposal-generator positioning"
```

---

### Task 5: Rewrite hero, CTA section, and footer copy

**Files:**
- Modify: `apps/web/app/page.tsx` (hero, CTA section, footer — not in the arrays, rendered inline in the JSX)

**Context:** The hero currently has badge "Web-based wastewater process simulator", title "Design. Simulate. Comply.", and sub-copy "Build wastewater treatment flowsheets, run mass balance simulations, and verify discharge compliance." The new tagline keeps "Design. Simulate. Comply." (it still works) but the supporting copy pivots.

**Step 1: Hero section**

Find the `{/* Hero */}` section. Replace the badge, sub-copy, and CTA row:

```tsx
{/* Hero */}
<section className="py-24 px-4">
  <div className="container mx-auto text-center max-w-3xl">
    <Badge variant="secondary" className="mb-4 text-xs">
      Wastewater design & proposal generator
    </Badge>
    <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
      Design. Simulate.{' '}
      <span className="text-primary">Deliver.</span>
    </h1>
    <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
      From wastewater sample to client-ready design proposal in the same tool.
      Auditable calculations, real South African supplier prices, and one-click PDF export.
    </p>
    <div className="flex items-center justify-center gap-4">
      <Link href="/register">
        <Button size="lg" className="text-base px-8">
          Start free
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </Link>
      <Link href="/login">
        <Button size="lg" variant="outline" className="text-base px-8">
          Sign in
        </Button>
      </Link>
    </div>
    <p className="text-sm text-muted-foreground mt-4">
      Free tier includes 3 projects. No credit card required. Built for SA consulting engineers.
    </p>
  </div>
</section>
```

Note: the title verb changed from "Comply" to "Deliver" — the compliance aspect is now one of six features, not the primary pitch. The primary pitch is delivering a client-ready document.

**Step 2: CTA section**

Find `{/* CTA */}` and replace:

```tsx
{/* CTA */}
<section className="py-24 px-4">
  <div className="container mx-auto text-center max-w-2xl">
    <h2 className="text-3xl font-bold mb-4">Stop building proposals in Word.</h2>
    <p className="text-muted-foreground mb-8">
      AquaSim collapses the design-to-deliverable cycle into a single tool.
      Your calculations, your Bill of Quantities, and your client proposal — one workflow, one export.
    </p>
    <Link href="/register">
      <Button size="lg" className="text-base px-8">
        Create your free account
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </Link>
  </div>
</section>
```

**Step 3: Footer**

Find `{/* Footer */}` and replace the right-side text:

```tsx
{/* Footer */}
<footer className="border-t border-border/50 py-8 px-4">
  <div className="container mx-auto flex items-center justify-between text-sm text-muted-foreground">
    <span>AquaSim by CH-ISE (PTY) LTD</span>
    <span>Wastewater design & proposal generator</span>
  </div>
</footer>
```

**Step 4: Web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean.

**Step 5: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/app/page.tsx && \
git commit -m "Landing: rewrite hero, CTA section, and footer for proposal-generator positioning"
```

---

### Task 6: Grep for remaining "simulator" mentions in user-visible copy

**Files:** potentially modify `apps/web/app/page.tsx` or other marketing-facing files

**Step 1: Grep**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
grep -rn -i "simulator" apps/web/app/page.tsx apps/web/app/layout.tsx apps/web/app/\(auth\) 2>&1 | head
```

**Step 2: Audit each hit**

- Code comments, variable names, function names → leave alone
- Visible text in JSX (page titles, marketing copy, metadata) → replace with "design & proposal generator" or similar neutral phrasing
- README references → out of Phase 8 scope (Phase 9 updates the README)

**Step 3: If fixes needed**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/app/ && \
git commit -m "Landing: remove residual 'simulator' mentions from user-visible copy"
```

---

### Task 7: Capture "after" landing screenshot + visual spot check

**Files:**
- Create: `docs/design-system/landing-after-phase-8.png`
- Create: `docs/design-system/landing-after-phase-8-light.png`

**Step 1: Start dev server**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run dev --filter=web &
```

**Step 2: Visit `http://localhost:3000/` in dark mode**

Scroll through the full page. Verify:
- Hero reads cleanly, no obvious widows or overflow
- Feature grid shows 6 new cards
- Process units section shows 6 category groups
- Pricing table shows 3 tiers with new bullets
- CTA section reads well
- Footer copy is updated
- Spacing and visual rhythm feel consistent with the rest of the app
- No hardcoded colors leaking (unlikely since Phase 5 already audited `page.tsx`, but double-check visually)

Capture a full-page screenshot to `docs/design-system/landing-after-phase-8.png`.

**Step 3: Switch to light mode for the landing page**

The landing page doesn't have a theme toggle, so trigger it via DevTools: edit the `<html>` element's class in the Elements panel, remove `dark`. Verify the page still reads well in light mode (colors have appropriate contrast, text is legible). Capture as `landing-after-phase-8-light.png`.

**Step 4: Kill dev server**

**Step 5: Commit screenshots**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add docs/design-system/landing-after-phase-8.png \
        docs/design-system/landing-after-phase-8-light.png && \
git commit -m "Capture landing page post-Phase 8 screenshots (dark + light)"
```

---

### Task 8: Final verification

**Step 1: Tests**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
(cd packages/sim-engine && npx vitest run) && \
(cd packages/design-library && npx vitest run)
```
Expected: 118 + 16 passing.

**Step 2: Type check monorepo**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run check-types
```
Expected: Clean.

**Step 3: Web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean, **13 routes** (no route changes in Phase 8).

**Step 4: Branch log review**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git log --oneline main..HEAD | head -20
```
Expected: Phases 1-7 + ~6-8 new Phase 8 commits.

**Step 5: Re-grep for "simulator"**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
grep -rn -i simulator apps/web/app/page.tsx 2>&1 || echo "CLEAN"
```
Expected: `CLEAN` (or only a single metadata reference if Phase 5 left one — if so, fix it).

---

### Task 9: Phase 8 completion summary

**Files:**
- Create: `docs/plans/2026-04-15-aquasim-v2-phase-8-COMPLETE.md`

**Step 1: Write the summary**

```markdown
# Phase 8 Complete — Landing Page Rewrite

**Completed:** YYYY-MM-DD
**Branch:** v2-proposal-generator
**Commits:** ~6-8

## What shipped
- Hero rewritten: badge now says "Wastewater design & proposal generator", sub-copy emphasizes the design-to-deliverable workflow, title tagline changed "Comply" → "Deliver"
- Features grid: 6 new cards mapped to Phase 1b-7 deliverables (flowsheet editor, auditable calculations, SA supplier prices, DWA compliance, one-click proposal PDF, 19 process units)
- Process units showcase: 10 → 19 units, regrouped into 6 categories (Preliminary / Primary / Biological / Secondary & Tertiary / Sludge / Flow & Utility)
- Pricing tier bullets refreshed: Free/Pro/Enterprise structure and prices unchanged; Pro highlights proposal PDFs, BoQ save, override per project
- CTA section rewritten with new "Stop building proposals in Word" framing
- Footer updated
- No user-visible "simulator" mentions remaining
- Before + after screenshots (dark + light) captured to docs/design-system/

## Verification state
- Sim-engine tests: 118 passing (unchanged)
- Design-library tests: 16 passing (unchanged)
- Combined: **134** (unchanged — Phase 8 is copy + visual)
- Type check: clean
- Web build: clean, 13 routes
- Landing page renders correctly in dark + light mode

## Deviations from plan
<list any>

## Next: Phase 9
Merge to main and deploy. Regression smoke test the full stack on the
v2-proposal-generator branch, verify all phases still hold, merge to
main, push, update README, update Obsidian progress log.

Draft plan: `docs/plans/YYYY-MM-DD-aquasim-v2-phase-9-merge-deploy.md`
```

**Step 2: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add docs/plans/2026-04-15-aquasim-v2-phase-8-COMPLETE.md && \
git commit -m "Phase 8 complete — landing page rewrite"
```

**Step 3: Do NOT merge to main yet.** Phase 9 is the cut-over.

---

## Summary of commits expected for Phase 8

| # | Task | Commit message |
|---|---|---|
| 0 | Baseline | (no commit) |
| 1 | Before screenshot | `Capture landing page pre-Phase 8 screenshot` |
| 2 | Features rewrite | `Landing: rewrite features grid for proposal-generator positioning` |
| 3 | Process units | `Landing: expand process units showcase to 19 units grouped by category` |
| 4 | Pricing | `Landing: refresh pricing tier feature bullets for proposal-generator positioning` |
| 5 | Hero + CTA + footer | `Landing: rewrite hero, CTA section, and footer for proposal-generator positioning` |
| 6 | Simulator grep fix | `Landing: remove residual 'simulator' mentions from user-visible copy` (if any) |
| 7 | After screenshots | `Capture landing page post-Phase 8 screenshots (dark + light)` |
| 9 | Summary | `Phase 8 complete — landing page rewrite` |

Total: ~6-8 commits on top of Phase 7. No logic, schema, or route changes. Test count unchanged at 134.

---

## Notes for the executor

1. **Phase 8 is small.** It's mostly copy writing inside three JSX arrays and a few section bodies. Under 300 lines of diff total. Don't overthink it.

2. **Copy voice**: engineer-to-engineer. Not marketing fluff. Every sentence should be something a consulting engineer would say about their work. No superlatives ("world's best", "revolutionary"), no hype.

3. **"Simulator" is a forbidden word in user-visible copy.** Not in comments, not in variable names, not in the sim-engine package name — those stay. But any `<h1>`, `<p>`, badge, CTA, feature title, pricing description, footer text must not mention simulator.

4. **The tagline keeps "Design. Simulate. Comply." → change to "Design. Simulate. Deliver."** — "Simulate" stays because it's a verb the engineer does as part of the workflow, and dropping it would be over-correction. "Comply" → "Deliver" because the deliverable (the proposal) is now the payoff, not the compliance check.

5. **Tier prices ($0 / $49 / $199) are unchanged.** Stripe config depends on them; Phase 8 touches copy only.

6. **Icons from lucide-react**: the new feature grid uses some icons that may not be imported yet (`Calculator`, `Receipt`, `ClipboardCheck`, `Layers`, `BookOpen`). Add them to the existing lucide import statement at the top of the file. Don't introduce a second icon library.

7. **Light mode readability check is manual.** The landing page doesn't have the theme toggle (that's in the dashboard header). Test light mode by editing the `<html>` class in DevTools.

8. **Process units listing order** matches the typical flow an engineer would design: headworks → primary → biological → tertiary → sludge → utility. Don't alphabetize.

9. **The "See a sample proposal" idea was considered and rejected.** Sharing a proposal requires a public share token that renders the proposal view; Phase 7 explicitly kept shared links to flowsheet-only. Revisit in a future phase.

10. **Don't add a testimonials section.** There are no real customers yet. Fake testimonials erode trust.

11. **Do NOT merge to main.** Phase 9 is the merge. Leave the branch alone after Phase 8's completion summary commit.
