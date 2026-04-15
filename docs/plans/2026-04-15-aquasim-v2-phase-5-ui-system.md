# AquaSim v2 — Phase 5: UI Design System Overhaul

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.
> **SECONDARY SUB-SKILL:** During Task 2, invoke `ui-ux-pro-max` to produce the design-system recommendation. The plan treats its output as an input — record the recommendation, then the remaining tasks apply it.

**Goal:** Replace AquaSim's generic shadcn default theme with a bespoke design system tailored for consulting engineers: trustworthy, technical, dense information display, dark-mode-first (current default), tablet-responsive, WCAG AA contrast. Refine CSS variables in `globals.css`, update typography, audit every shadcn primitive for hardcoded color leaks, style the React Flow canvas + unit palette, and add a functional dark/light toggle. Phase 6 (Inspector) and Phase 7 (Proposal view) inherit these tokens without touching them again.

**Architecture:** Tailwind v4 native CSS config — no `tailwind.config.ts` file. All design tokens live in `apps/web/app/globals.css` as CSS custom properties under `:root` (light) and `.dark` (dark). Typography imports via `next/font` in `layout.tsx`. New shared primitives (`PageShell`, `PageHeader`, `EmptyState`) go under `apps/web/components/layout/`. Canvas and unit-palette styling updates happen in-place in the existing `components/canvas/` directory.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4 (CSS-native config), shadcn/ui (11 existing primitives), base-ui Dialog, React Flow, lucide-react, sonner (toasts), Geist font (current — likely changing). Working on branch `v2-proposal-generator` (Phases 1a + 1b + 2 + 3 + 4 complete).

---

## Context & References

- **Design doc:** `docs/plans/2026-04-02-aquasim-v2-proposal-generator-design.md` section 8.5 (design system scope)
- **Phase 4 complete:** `docs/plans/2026-04-15-aquasim-v2-phase-4-COMPLETE.md`
- **Starting test count:** 134 combined (118 sim-engine + 16 design-library) — **unchanged** by Phase 5 (no logic changes)
- **Starting branch:** `v2-proposal-generator`

### Current UI inventory (verified pre-Phase 5)

| Path | What's there |
|---|---|
| `apps/web/app/globals.css` | Tailwind v4 `@import "tailwindcss"` + shadcn CSS variables (light + dark) + `@custom-variant dark` |
| `apps/web/app/layout.tsx` | Geist font, `<html className="dark">` (dark mode is current default), Sonner Toaster |
| `apps/web/components/ui/` | 11 shadcn primitives: badge, button, card, dialog, input, label, separator, sheet, table, tabs, tooltip |
| `apps/web/components/canvas/` | React Flow canvas + custom nodes + unit palette |
| `apps/web/components/inspector/` | Unit inspector panel (Phase 6 redesigns) |
| `apps/web/components/results/` | ResultsPanel — slated for **deletion** per design doc (content moves to Proposal view in Phase 7) |
| `apps/web/components/help-tooltip.tsx` | Contextual help tooltip |
| `apps/web/components/error-boundary.tsx` | React error boundary |

### Current token palette (shadcn defaults)

Light: near-white background, near-black foreground, **blue primary** (`221.2 83.2% 53.3%` HSL). Dark: near-black background, near-white foreground, lighter blue primary. These are the shadcn defaults — **Phase 5 replaces them** based on `ui-ux-pro-max`'s recommendation.

## Success Criteria

1. `ui-ux-pro-max` has been invoked with AquaSim's design brief and its recommendation is saved to `docs/design-system/2026-04-15-ui-ux-pro-max-brief.md`
2. `apps/web/app/globals.css` uses the new CSS variables (both `:root` and `.dark` blocks updated)
3. Typography in `layout.tsx` matches the recommended font pairing (or stays Geist if the skill recommends it)
4. All 11 existing shadcn primitives audit clean: `grep -rn "#[0-9a-fA-F]\{3,\}" apps/web/components/ui/` returns only token-referencing usages (no raw hex leaks)
5. New layout primitives exist: `PageShell`, `PageHeader`, `EmptyState`
6. React Flow canvas edges, nodes, handles, and background use the new tokens (no hardcoded slate/gray leaks)
7. Unit palette left rail is redesigned with category grouping and clean visual hierarchy
8. Dark/light mode toggle exists and persists the choice (localStorage)
9. Key pages render correctly in both light and dark mode: `/`, `/dashboard`, `/project/new`, `/project/[id]/flowsheet/[fsid]`
10. Tablet breakpoint (`md:` ≥ 768px) works — no horizontal scrollbars on iPad Pro viewport
11. Test count unchanged at **134** (no sim-engine/design-library changes)
12. Web build clean, TypeScript clean
13. Manual visual verification: before/after screenshots captured for the 4 key pages

## Non-Goals (deferred)

- **Inspector panel redesign** → Phase 6 (inherits Phase 5 tokens)
- **Proposal view page** → Phase 7 (inherits Phase 5 tokens)
- **Landing page copy/positioning rewrite** → Phase 8 (Phase 5 only updates visual tokens on the existing page)
- **Storybook / visual regression CI** → later polish if needed
- **i18n / RTL support** → out of scope for v1
- **Motion/animation library** (Framer Motion, GSAP) → the skill may recommend some subtle animations but no new dep unless it insists
- **Accessibility audit beyond color contrast** (screen reader, keyboard nav) → important but later polish

---

## Design brief (input to `ui-ux-pro-max`)

This is the exact brief to give the skill in Task 2. It is intentionally opinionated so the skill's output is predictable:

> **Product**: AquaSim v2 — a web-based wastewater treatment plant design and proposal generator.
>
> **Target user**: Consulting process engineers in South Africa designing 50 m³/d – 10 ML/d plants for municipal and industrial clients. They currently live in Excel and Word.
>
> **Wedge**: Replace Excel + Word with one tool that produces client-ready proposal PDFs on a single click. Trust and auditability are paramount — every number has a citation.
>
> **Positioning**: "Design. Simulate. Comply." Technical, not marketing.
>
> **Feel**: Bloomberg Terminal meets Notion. Dense information display without being hostile. Engineers will stare at this for hours — it needs to age well.
>
> **Must avoid**: Marketing-site gradients, parallax scrolling, hero animations, oversized display type, playful color accents, glassmorphism, neumorphism.
>
> **Must have**: Dark mode (current default) AND light mode, WCAG AA contrast, responsive from tablet (768px) upward. No mobile support needed — engineers use laptops and tablets.
>
> **Color**: Water/environmental adjacency is OK but avoid cliché aggressive blues. Something more restrained — think teal-leaning deep green, or slate with a precise accent. Dark mode should feel like a dark IDE, not a black void.
>
> **Typography**: Readable at small sizes (calculation records show equations at ~12px). Prefer a geometric sans (body) + monospace (for equations, numbers) pairing. Optional display face for proposal section headings.
>
> **Stack**: Next.js 16 + React 19 + Tailwind CSS v4 (CSS-native config, no `tailwind.config.ts`) + shadcn/ui + base-ui Dialog + React Flow + lucide-react.
>
> **Output I want from you**:
> 1. Named style (e.g. "Technical Swiss")
> 2. Light palette: `--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--border`, `--input`, `--ring` — all as HSL triplets (shadcn-style)
> 3. Dark palette: same keys as above
> 4. Radius scale: `--radius` (shadcn default is 0.5rem — recommend whether to change)
> 5. Font pairing: body + mono + optional display; with `next/font` import strings
> 6. Any specific spacing / letter-spacing / line-height recommendations for dense technical UIs
> 7. Canvas tokens: edge stroke color, node border color, handle color, canvas background pattern (dotted vs lined vs plain)
> 8. Dark-mode-specific notes (e.g. "in dark mode use a slightly warmer foreground")

## Tasks

### Task 0: Verify starting state

**Step 1: Confirm branch + clean tree**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && git status && git log --oneline | head -5
```
Expected: `On branch v2-proposal-generator`, working tree clean, recent commit from Phase 4.

**Step 2: Confirm tests still green**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: 118 passing.

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/design-library && npx vitest run
```
Expected: 16 passing.

**Step 3: Confirm web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean, 12 routes.

---

### Task 1: Capture "before" screenshots

**Files:**
- Create: `docs/design-system/before/` (directory)

**Context:** Visual diff is the only reliable way to verify a design-system overhaul. Capture the 4 key pages in their current state before changing anything.

**Step 1: Start dev server**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run dev --filter=web &
```
Wait ~15 seconds for Next.js to be ready, then visit `http://localhost:3000` in a browser.

**Step 2: Capture screenshots of these pages in current (dark) theme:**
1. Landing page `/`
2. Login page `/login` (or `/sign-in`)
3. Dashboard `/dashboard` (requires auth — use a test user or describe what's visible)
4. Project editor `/project/[id]/flowsheet/[fsid]` with a template flowsheet loaded

Save each as PNG under `docs/design-system/before/`:
- `landing-dark.png`
- `login-dark.png`
- `dashboard-dark.png`
- `project-editor-dark.png`

**Step 3: If the page has any text manually highlighting hardcoded colors**, note them in a text file `docs/design-system/before/notes.md`. Look especially for:
- Unit palette node colors
- Canvas edge color (current is `#94a3b8` slate-400 per audit log)
- Status badges
- Alert/toast colors

**Step 4: Commit the snapshots**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add docs/design-system/before/ && \
git commit -m "Capture Phase 5 pre-overhaul screenshots"
```

**Step 5: Kill the dev server**

---

### Task 2: Invoke `ui-ux-pro-max` and record the recommendation

**Files:**
- Create: `docs/design-system/2026-04-15-ui-ux-pro-max-brief.md`

**Context:** This task hands off to the `ui-ux-pro-max` skill which produces the actual design token recommendation. The plan cannot predict the exact output — it defines the brief and how to record the answer.

**Step 1: Invoke the skill**

Call `Skill` with:
- `skill: "ui-ux-pro-max"`
- `args: "design a design system for a Next.js + Tailwind v4 + shadcn consulting-engineer SaaS"`

When the skill loads, paste the **full design brief** from the "Design brief" section above as the first message. Include the explicit "Output I want from you" list — the skill tends to produce unstructured output otherwise, and the plan needs structured tokens.

**Step 2: Capture the skill's output**

The skill returns (roughly):
1. A style name
2. Light + dark HSL palettes
3. Font pairing recommendation
4. Radius scale
5. Canvas-specific tokens
6. Dark mode notes

Save the complete output verbatim to `docs/design-system/2026-04-15-ui-ux-pro-max-brief.md`. Structure the file as:
```markdown
# AquaSim v2 — Design System (from ui-ux-pro-max)

**Brief given:** <copy of the design brief>

**Style name:** <e.g. "Technical Swiss">

## Light palette (HSL triplets — shadcn-style)
--background: X Y% Z%
--foreground: X Y% Z%
... (all tokens)

## Dark palette
--background: X Y% Z%
... (all tokens)

## Radius
--radius: Xrem

## Typography
Body: <font name> — `next/font` import: `import { X } from 'next/font/google'`
Mono: <font name> — import
Display: <font name> (optional)

## Canvas tokens
- Edge stroke: <token or hex>
- Node border: <token>
- Selected node: <token>
- Handle color: <token>
- Background: <dotted / lined / plain>

## Dark mode notes
<skill's commentary>
```

**Step 3: Commit the recommendation**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add docs/design-system/2026-04-15-ui-ux-pro-max-brief.md && \
git commit -m "Record ui-ux-pro-max design system recommendation for AquaSim v2"
```

> **If the skill output is ambiguous** (e.g. missing a token, hand-waving about fonts): **stop and re-invoke** with a pointed follow-up like "give me the exact HSL triplet for `--muted-foreground` in dark mode". Do not guess. The recommendation is the ground truth for every subsequent task.

---

### Task 3: Update `globals.css` with new CSS variables

**Files:**
- Modify: `apps/web/app/globals.css`

**Step 1: Back up the current `globals.css`**

Save a copy of the file contents in a comment block at the top of `docs/design-system/2026-04-15-ui-ux-pro-max-brief.md` under a `## Previous globals.css tokens` heading, so the diff is recoverable.

**Step 2: Replace the `:root` and `.dark` blocks**

Update `apps/web/app/globals.css` — replace the token values in the `:root { ... }` block with the light palette from the recommendation, and replace the token values in the `.dark { ... }` block with the dark palette. Keep the token **names** identical (the shadcn components depend on them).

**Important invariants:**
- Do not rename `--primary`, `--foreground`, etc. — shadcn components reference them by name
- Keep `--radius` (update value per recommendation)
- Keep `--chart-1..5` — Recharts uses them; either update per the recommendation or leave existing values if the skill didn't address chart palette
- Add any **new** tokens the recommendation introduces (e.g. `--canvas-bg`, `--canvas-edge`, `--canvas-node-border`) after the existing block with a `/* AquaSim v2 canvas tokens */` comment

**Step 3: Run web build to verify no syntax errors**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean build. Any CSS parse error will show up here.

**Step 4: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/app/globals.css && \
git commit -m "globals.css: apply ui-ux-pro-max light + dark tokens"
```

---

### Task 4: Update typography via `next/font`

**Files:**
- Modify: `apps/web/app/layout.tsx`

**Context:** Current setup imports Geist. The skill may keep Geist (it's a solid choice for technical UIs) or recommend something else. If unchanged, commit nothing — just note in the completion summary.

**Step 1: Read current layout.tsx**

Check the existing `import { Geist } from 'next/font/google';` and the className composition.

**Step 2: Update the font imports per the recommendation**

Example if the skill recommends Inter (body) + JetBrains Mono (equations):
```typescript
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { cn } from '@/lib/utils';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AquaSim — Wastewater Process Design & Proposal Generator',
  description: 'Design wastewater treatment plants, simulate process performance, and produce client-ready proposal PDFs — all in your browser.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn('dark font-sans', inter.variable, mono.variable)}>
      <body className="antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
```

**Step 3: If the skill recommends a display font** (optional, for proposal headings), add it as a third import with its own `--font-display` CSS variable. Wire it into the `html` className.

**Step 4: Also update the `<meta>` description** — the current copy says "process simulator" but Phase 5 is the branding pivot to "design & proposal generator". Match the recommendation's positioning line if it offered one.

**Step 5: Run the web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean.

**Step 6: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/app/layout.tsx && \
git commit -m "layout: apply ui-ux-pro-max font pairing + update metadata"
```

---

### Task 5: Dark/light mode toggle

**Files:**
- Create: `apps/web/components/theme-toggle.tsx`
- Create: `apps/web/components/theme-provider.tsx`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/(dashboard)/dashboard/page.tsx` (or wherever the dashboard header lives)

**Context:** Dark mode is currently hard-coded via `<html className="dark">`. Phase 5 makes it toggleable and persistent. Use the no-dependency approach (manual localStorage + class toggle) rather than pulling in `next-themes` — keeps the dep footprint tight and avoids hydration-warning issues in Next.js 16.

**Step 1: Create the theme provider**

Create `apps/web/components/theme-provider.tsx`:
```typescript
'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    const stored = localStorage.getItem('aquasim-theme') as Theme | null;
    const initial = stored ?? 'dark';
    setThemeState(initial);
    document.documentElement.classList.toggle('dark', initial === 'dark');
  }, []);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    localStorage.setItem('aquasim-theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
```

**Step 2: Create the toggle button**

Create `apps/web/components/theme-toggle.tsx`:
```typescript
'use client';

import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from './theme-provider';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
```

**Step 3: Wrap the app in the provider**

Modify `apps/web/app/layout.tsx` — add `<ThemeProvider>` around `{children}`:
```typescript
import { ThemeProvider } from '@/components/theme-provider';

// ...

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cn('dark font-sans', /* font vars */)}>
      <body className="antialiased">
        <ThemeProvider>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

Important: the `dark` class on `<html>` stays as the SSR default (so the initial paint is dark), and `suppressHydrationWarning` prevents React complaining about the `useEffect` toggle. The provider's `useEffect` then syncs to localStorage on mount.

**Step 4: Add the toggle to the dashboard header**

Find `apps/web/app/(dashboard)/dashboard/page.tsx` (or whatever file has the dashboard header). Import `ThemeToggle` and add it to the header's right-side controls, next to `SubscriptionManager`:
```tsx
import { ThemeToggle } from '@/components/theme-toggle';

// Inside the header div:
<SubscriptionManager currentTier={tier} stripeConfigured={!!process.env.STRIPE_SECRET_KEY} />
<ThemeToggle />
<form action="/auth/signout" method="post">
  <Button type="submit" variant="ghost" size="sm">Sign Out</Button>
</form>
```

**Step 5: Run web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean.

**Step 6: Quick manual smoke test**

Start the dev server, visit `/dashboard`, click the theme toggle, confirm the page switches between dark and light without a refresh. Reload the page — it should remember the choice.

**Step 7: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/components/theme-provider.tsx \
        apps/web/components/theme-toggle.tsx \
        apps/web/app/layout.tsx \
        apps/web/app/\(dashboard\)/dashboard/page.tsx && \
git commit -m "Add dark/light theme toggle with localStorage persistence"
```

---

### Task 6: Audit shadcn primitives for hardcoded colors

**Files:**
- Modify: as needed under `apps/web/components/ui/`

**Context:** Shadcn primitives should reference tokens exclusively (`bg-background`, `text-foreground`, `border-border`, etc.) — but sometimes leak hardcoded values during copy-paste. Phase 5 audits and fixes.

**Step 1: Grep for hardcoded hex leaks in component files**

Run:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
grep -rn "#[0-9a-fA-F]\{3,\}" apps/web/components/ui/ apps/web/components/canvas/ apps/web/components/inspector/ apps/web/components/help-tooltip.tsx apps/web/components/error-boundary.tsx 2>&1 || echo "NO HEX LEAKS"
```

Record the hits. Some are legitimate (icon SVGs embedded inline may need hex) — most should be converted to tokens.

**Step 2: Grep for hardcoded slate / gray / blue leaks**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
grep -rnE "(slate|gray|zinc|neutral|blue|red|green|yellow)-[0-9]{2,3}" apps/web/components/ 2>&1 | head -50
```

These are likely leaks — Tailwind's named palette shouldn't appear in primitive components. They should be `bg-muted`, `border-border`, `text-foreground`, etc.

**Step 3: For each leak, replace with the semantic token**

Common mappings:
| Hardcoded | Semantic token |
|---|---|
| `text-slate-500` / `text-gray-500` | `text-muted-foreground` |
| `border-slate-200` / `border-gray-200` | `border-border` |
| `bg-slate-50` / `bg-gray-50` | `bg-muted` |
| `bg-slate-100` / `bg-gray-100` | `bg-muted` |
| `text-slate-900` / `text-gray-900` | `text-foreground` |
| `bg-blue-500` / `bg-blue-600` (as primary) | `bg-primary` |
| `text-white` (on `bg-primary`) | `text-primary-foreground` |
| `bg-red-500` (destructive) | `bg-destructive` |
| `#94a3b8` (edge stroke — known from audit log) | new token `--canvas-edge` or `hsl(var(--border))` |

**Step 4: Run the web build after each file change**

Commit each file's fixes as a separate commit for a clean history:
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/components/ui/<file>.tsx && \
git commit -m "ui/<component>: replace hardcoded colors with semantic tokens"
```

**Step 5: Re-grep to confirm clean**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
grep -rnE "(slate|gray|zinc|neutral|blue|red|green|yellow)-[0-9]{2,3}" apps/web/components/ui/ 2>&1 || echo "ALL SEMANTIC"
```
Expected: `ALL SEMANTIC` (or only comments/documentation).

**Step 6: Final commit if any stragglers**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/components/ui/ && \
git commit -m "ui primitives: final token audit pass"
```

---

### Task 7: Create layout primitives

**Files:**
- Create: `apps/web/components/layout/page-shell.tsx`
- Create: `apps/web/components/layout/page-header.tsx`
- Create: `apps/web/components/layout/empty-state.tsx`

**Context:** New shared layout components for Phase 6/7/8 to build on. Without these, each page reinvents its own container/header markup.

**Step 1: Create `PageShell`**

```typescript
// apps/web/components/layout/page-shell.tsx
import { cn } from '@/lib/utils';

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
}

/** Top-level page container — consistent max-width, padding, and background */
export function PageShell({ children, className }: PageShellProps) {
  return (
    <div className={cn('min-h-screen bg-background text-foreground', className)}>
      {children}
    </div>
  );
}
```

**Step 2: Create `PageHeader`**

```typescript
// apps/web/components/layout/page-header.tsx
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

/** Consistent page header — title + description + right-aligned actions */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-border pb-6 mb-8', className)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
```

**Step 3: Create `EmptyState`**

```typescript
// apps/web/components/layout/empty-state.tsx
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/** Empty state for tables, lists, canvases — icon + title + description + optional action */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 px-6 py-16 text-center',
      className,
    )}>
      {Icon && <Icon className="h-10 w-10 text-muted-foreground/60 mb-4" />}
      <h3 className="text-base font-medium text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
```

**Step 4: Add an `index.ts` barrel**

Create `apps/web/components/layout/index.ts`:
```typescript
export { PageShell } from './page-shell';
export { PageHeader } from './page-header';
export { EmptyState } from './empty-state';
```

**Step 5: Web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean.

**Step 6: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/components/layout/ && \
git commit -m "Add PageShell, PageHeader, EmptyState layout primitives"
```

---

### Task 8: Style the React Flow canvas

**Files:**
- Modify: `apps/web/components/canvas/Canvas.tsx` (or wherever the `<ReactFlow>` component is rendered)
- Modify: `apps/web/components/canvas/custom-nodes/ProcessUnitNode.tsx`
- Modify: `apps/web/app/globals.css` (add canvas-specific CSS if needed)

**Context:** The Audit Log flagged that edge strokes were changed to `#94a3b8` (slate-400) during Phase 4. Replace that with a token reference. Node borders currently use a mix of gray/green/red — align with semantic tokens (`border-border`, `border-primary`, `border-destructive`).

**Step 1: Inspect current canvas code**

Read `apps/web/components/canvas/Canvas.tsx` to find:
- The `<ReactFlow>` component and its edge/node style props
- Any `defaultEdgeOptions` or `edgeTypes` with hardcoded styles
- The canvas background component (`<Background>` from `@xyflow/react`)

**Step 2: Update edge styling to use tokens**

In `Canvas.tsx`, if there's a `defaultEdgeOptions` prop with a hardcoded `stroke: '#94a3b8'`, replace with a CSS variable reference:
```tsx
const defaultEdgeOptions = {
  type: 'smoothstep',
  style: { stroke: 'hsl(var(--border))', strokeWidth: 2 },
  markerEnd: { type: MarkerType.Arrow, color: 'hsl(var(--border))' },
};
```

React Flow accepts CSS variables in inline styles. If this doesn't work at runtime (some versions strip them), use a class instead:
```css
/* add to globals.css */
.react-flow__edge-path { stroke: hsl(var(--border)); stroke-width: 2; }
.react-flow__edge.selected .react-flow__edge-path { stroke: hsl(var(--primary)); }
```

**Step 3: Update `<Background>` component**

```tsx
<Background
  color="hsl(var(--muted-foreground) / 0.15)"
  gap={20}
  size={1}
  variant={BackgroundVariant.Dots}
/>
```

(Pattern recommended by ui-ux-pro-max — dots, lines, or plain. Use whatever Task 2 captured.)

**Step 4: Update `ProcessUnitNode.tsx`**

This is the custom node component. Replace any hardcoded Tailwind colors with semantic tokens:

Before (example):
```tsx
<div className={cn(
  'rounded-lg border-2 bg-white shadow-md',
  isSelected && 'border-blue-500',
  !isSelected && 'border-gray-200',
  hasError && 'border-red-500',
)}>
```

After:
```tsx
<div className={cn(
  'rounded-lg border-2 bg-card text-card-foreground shadow-sm transition-colors',
  isSelected && 'border-primary shadow-md',
  !isSelected && 'border-border',
  hasError && 'border-destructive',
)}>
```

Update any inline `style={{ ... }}` props the same way — use token references.

**Step 5: Update node handle colors**

React Flow handles (connection points) have default gray styling. Override via CSS in `globals.css`:
```css
.react-flow__handle {
  background: hsl(var(--primary));
  border: 2px solid hsl(var(--background));
  width: 10px;
  height: 10px;
}
.react-flow__handle-connecting {
  background: hsl(var(--primary) / 0.6);
}
```

**Step 6: Web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean.

**Step 7: Manual smoke test**

Start dev server, open a flowsheet in the editor, verify:
- Edges render with the new token color
- Selecting a node shows the primary-colored border
- The background dots are subtle, not aggressive
- Handles are visible and appropriately sized

**Step 8: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/components/canvas/ apps/web/app/globals.css && \
git commit -m "Canvas: token-based edge, node, handle, and background styling"
```

---

### Task 9: Redesign the unit palette left rail

**Files:**
- Modify: `apps/web/components/canvas/UnitPalette.tsx` (or wherever the palette lives)

**Context:** The palette is the engineer's workshop tray. With 19 unit types now (10 Phase 1 + 9 Phase 2), grouping by category is essential — currently they're probably listed flat. Group by `category` field from `UnitDefinition`.

**Step 1: Read the current palette**

Find and read `UnitPalette.tsx`. Note its current structure.

**Step 2: Refactor to group by category**

The unit definitions already have a `category` field (from Phase 1a / Phase 2 — `'preliminary' | 'primary' | 'biological' | 'tertiary' | 'sludge' | 'utility'`). Group the flat list into sections:

```typescript
import { unitDefinitions } from '@repo/sim-engine';
import type { UnitType, UnitDefinition } from '@repo/sim-engine';

type Category = UnitDefinition['category'];

const CATEGORY_LABELS: Record<Category, string> = {
  preliminary: 'Preliminary',
  primary: 'Primary',
  biological: 'Biological',
  tertiary: 'Tertiary',
  sludge: 'Sludge',
  utility: 'Utility',
};

const CATEGORY_ORDER: Category[] = [
  'preliminary', 'primary', 'biological', 'tertiary', 'sludge', 'utility',
];

// Group unitDefinitions by category, preserving the order
function groupByCategory(): Record<Category, UnitDefinition[]> {
  const groups: Record<Category, UnitDefinition[]> = {
    preliminary: [], primary: [], biological: [],
    tertiary: [], sludge: [], utility: [],
  };
  for (const def of Object.values(unitDefinitions)) {
    groups[def.category].push(def);
  }
  return groups;
}

export function UnitPalette() {
  const groups = groupByCategory();

  return (
    <aside className="w-56 border-r border-border bg-card/30 overflow-y-auto">
      {CATEGORY_ORDER.map((category) => {
        const units = groups[category];
        if (units.length === 0) return null;
        return (
          <div key={category} className="px-3 py-4 border-b border-border/50 last:border-b-0">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              {CATEGORY_LABELS[category]}
            </h3>
            <ul className="space-y-1">
              {units.map((def) => (
                <UnitPaletteItem key={def.type} definition={def} />
              ))}
            </ul>
          </div>
        );
      })}
    </aside>
  );
}

function UnitPaletteItem({ definition }: { definition: UnitDefinition }) {
  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/reactflow', definition.type);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <li>
      <div
        draggable
        onDragStart={onDragStart}
        className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground cursor-grab active:cursor-grabbing transition-colors"
        title={definition.description}
      >
        {/* icon — use the definition.icon field + iconMap from ProcessUnitNode */}
        <span className="h-4 w-4 text-muted-foreground group-hover:text-accent-foreground">
          {/* <IconComponent name={definition.icon} /> */}
        </span>
        <span className="truncate">{definition.label}</span>
      </div>
    </li>
  );
}
```

**Step 3: Adapt the icon rendering**

The existing `ProcessUnitNode.tsx` already has an `iconMap` (per the Phase 2 executor's notes). Import that same map (or extract it into a shared utility) and use it in `UnitPaletteItem` so the palette icons match the canvas icons.

**Step 4: Web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean.

**Step 5: Smoke test**

Open a flowsheet in the editor. Verify:
- Palette shows 6 category groups (or however many have units)
- Each group is labeled and separated by a subtle border
- Dragging a unit from the palette still creates a node on the canvas
- Hover shows the description tooltip
- Styling matches the rest of the app (tokens)

**Step 6: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/components/canvas/UnitPalette.tsx && \
git commit -m "UnitPalette: category grouping + token-based styling"
```

---

### Task 10: Tablet responsiveness audit

**Files:**
- As needed — likely `apps/web/app/(dashboard)/dashboard/page.tsx`, `apps/web/app/project/[id]/flowsheet/[fsid]/page.tsx`, and the project editor layout

**Context:** Target device is iPad Pro (1024×1366 portrait, 1366×1024 landscape). The engineer opens a proposal on-site to show a client. No horizontal scrollbars, no overflow. Mobile phones are not supported (too dense for this use case).

**Step 1: Start dev server, open DevTools → Device toolbar → iPad Pro**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run dev --filter=web &
```

Test each key page in both orientations:
1. `/` landing
2. `/login`
3. `/dashboard`
4. `/project/new`
5. `/project/[id]/flowsheet/[fsid]` — this is the hardest: canvas + palette + inspector must all fit

**Step 2: Note breakages**

Common issues on the project editor:
- Unit palette left rail (w-56) + canvas + inspector right rail (w-80 typical) = ~700px minimum → works on iPad Pro landscape (1366) but cramped portrait (1024). **Fix**: collapse the right inspector panel to a floating Sheet on `<md`.
- Top bar buttons overflow → hide text labels, show icons only below `md:`.
- Dashboard project grid → drop from 3 cols to 2 cols below `md:` (probably already correct, verify).

**Step 3: Apply fixes with Tailwind breakpoint prefixes**

Example for the inspector → Sheet on tablet:
```tsx
<div className="hidden lg:block w-80 border-l border-border"> 
  <Inspector /> 
</div>
<Sheet>
  <SheetTrigger asChild>
    <Button className="lg:hidden fixed bottom-4 right-4" size="icon">
      <Wrench className="h-4 w-4" />
    </Button>
  </SheetTrigger>
  <SheetContent side="right" className="w-[90vw] sm:w-80">
    <Inspector />
  </SheetContent>
</Sheet>
```

**Step 4: Commit per fix**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/app/project/... && \
git commit -m "Project editor: collapse inspector to Sheet below lg breakpoint"
```

Repeat for each breakage. Each commit is a separate "fix <scope>" change.

**Step 5: Re-test in both orientations**

Iterate until no page has horizontal scroll or overflow at 1024 width.

---

### Task 11: Capture "after" screenshots

**Files:**
- Create: `docs/design-system/after/` (directory)

**Step 1: Start dev server**

Same as Task 1 Step 1.

**Step 2: Capture the same 4 pages from Task 1**

Save as PNG under `docs/design-system/after/`:
- `landing-dark.png`
- `login-dark.png`
- `dashboard-dark.png`
- `project-editor-dark.png`

**Step 3: Also capture the 4 pages in LIGHT mode**

Toggle to light mode using the new theme toggle and save:
- `landing-light.png`
- `login-light.png`
- `dashboard-light.png`
- `project-editor-light.png`

**Step 4: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add docs/design-system/after/ && \
git commit -m "Capture Phase 5 post-overhaul screenshots (dark + light)"
```

---

### Task 12: Final verification

**Step 1: Sim-engine + design-library tests unchanged**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: 118.

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/design-library && npx vitest run
```
Expected: 16.

**Step 2: Type check across monorepo**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run check-types
```
Expected: Clean everywhere.

**Step 3: Web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean, 12 routes.

**Step 4: Final hardcoded-color grep**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
grep -rnE "(slate|gray|zinc|neutral)-[0-9]{2,3}" apps/web/components/ apps/web/app/ 2>&1 | head -20
```
Expected: Few or zero hits. Any remaining hits should be semantically intentional (e.g. a specific data-viz ramp).

**Step 5: Commit review**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git log --oneline main..HEAD | head -30
```
Expected: Phases 1-4 + ~15-20 new Phase 5 commits.

---

### Task 13: Phase 5 completion summary

**Files:**
- Create: `docs/plans/2026-04-15-aquasim-v2-phase-5-COMPLETE.md`

**Step 1: Write the summary**

```markdown
# Phase 5 Complete — UI Design System Overhaul

**Completed:** YYYY-MM-DD
**Branch:** v2-proposal-generator
**Commits:** ~15-20 (see `git log main..HEAD`)

## What shipped

### Design system
- New CSS variables in `apps/web/app/globals.css` (both light and dark) per `ui-ux-pro-max` recommendation
- Recommendation recorded in `docs/design-system/2026-04-15-ui-ux-pro-max-brief.md`
- Font pairing: <body> + <mono> [+ <display>] via `next/font`
- Radius scale updated / kept at 0.5rem
- Canvas-specific tokens: `--canvas-bg`, edge stroke, node border, handle color

### Theme toggle
- New `ThemeProvider` with localStorage persistence at `apps/web/components/theme-provider.tsx`
- `ThemeToggle` button in the dashboard header
- Dark mode remains the default; light mode selectable

### Layout primitives
- `PageShell`, `PageHeader`, `EmptyState` under `apps/web/components/layout/`
- Phase 6 and Phase 7 will consume these without modification

### Canvas styling
- React Flow edges, nodes, handles, and background use semantic tokens
- No more hardcoded `#94a3b8` slate leaks
- Dots background pattern per ui-ux-pro-max recommendation

### Unit palette
- Grouped by category (preliminary / primary / biological / tertiary / sludge / utility)
- Clean visual hierarchy with category headers
- Icons inherited from existing iconMap (ProcessUnitNode sharing)

### Tablet responsiveness
- iPad Pro portrait (1024w) and landscape (1366w) verified
- Inspector panel collapses to a Sheet below `lg:` breakpoint
- Top bar button labels hide below `md:`

### Hardcoded color audit
- `grep -rnE "(slate|gray|zinc|neutral)-[0-9]{2,3}" apps/web/components/` near-empty
- All semantic tokens used consistently

## Verification state
- Sim-engine tests: 118 passing (unchanged)
- Design-library tests: 16 passing (unchanged)
- Combined: **134 passing** (unchanged — no logic changes)
- Type check: clean
- Web build: clean, 12 routes
- Visual: before/after screenshots in `docs/design-system/{before,after}/`

## Deviations from plan
<list any>

## Next: Phase 6
Inspector panel redesign with inline calculation records. Uses the tokens and
layout primitives from Phase 5.

Draft plan: `docs/plans/YYYY-MM-DD-aquasim-v2-phase-6-inspector.md`
```

**Step 2: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add docs/plans/2026-04-15-aquasim-v2-phase-5-COMPLETE.md && \
git commit -m "Phase 5 complete — UI design system overhaul"
```

**Step 3: Do NOT merge to main.** Branch stays for Phase 6.

---

## Summary of commits expected for Phase 5

| # | Task | Commit message |
|---|---|---|
| 0 | Baseline | (no commit) |
| 1 | Before screenshots | `Capture Phase 5 pre-overhaul screenshots` |
| 2 | Skill recommendation | `Record ui-ux-pro-max design system recommendation for AquaSim v2` |
| 3 | globals.css tokens | `globals.css: apply ui-ux-pro-max light + dark tokens` |
| 4 | Typography | `layout: apply ui-ux-pro-max font pairing + update metadata` |
| 5 | Theme toggle | `Add dark/light theme toggle with localStorage persistence` |
| 6 | Shadcn audit | Multiple: `ui/<component>: replace hardcoded colors with semantic tokens` |
| 7 | Layout primitives | `Add PageShell, PageHeader, EmptyState layout primitives` |
| 8 | Canvas styling | `Canvas: token-based edge, node, handle, and background styling` |
| 9 | Unit palette | `UnitPalette: category grouping + token-based styling` |
| 10 | Tablet fixes | Multiple: `<page>: collapse <section> to Sheet below lg breakpoint` |
| 11 | After screenshots | `Capture Phase 5 post-overhaul screenshots (dark + light)` |
| 13 | Summary | `Phase 5 complete — UI design system overhaul` |

Total: ~15-20 commits on top of Phase 4, test count unchanged (134), branch ready for Phase 6.

---

## Notes for the executor

1. **Task 2 is a hand-off.** Do not guess tokens, fonts, or palettes. Invoke `ui-ux-pro-max` with the brief verbatim and take its recommendation as ground truth. If the output is ambiguous, re-invoke with pointed follow-ups.

2. **Visual work resists TDD.** Phase 5 has no new test files because the work is visual. The verification is: build clean, type check clean, manual smoke test in browser, before/after screenshots committed. Trust the eye, not a test runner, for "does this look right".

3. **Tailwind v4 has no `tailwind.config.ts`.** Everything lives in `globals.css`. If you find yourself reaching for a config file, stop and re-orient.

4. **Dark mode is the default.** The `<html className="dark">` in `layout.tsx` is the SSR initial paint. The `ThemeProvider` syncs from localStorage on mount. Do not remove the initial `dark` class — that would cause a light-mode flash on page load.

5. **Existing shadcn primitives should NOT be rewritten from scratch** — they're already well-structured. Phase 5 just refines their token usage and any leaked hardcoded colors.

6. **The `ResultsPanel` component is slated for deletion** per the design doc, but Phase 5 leaves it alone. Phase 7 (Proposal view) deletes it when replacing its content.

7. **If `ui-ux-pro-max` recommends a new dependency** (e.g. Framer Motion, `next-themes`), prefer the zero-dep alternative unless the dep is clearly justified. Phase 5 tries to keep the bundle thin.

8. **Icon imports**: the project uses `lucide-react`. Don't introduce a second icon library.

9. **Tablet fixes in Task 10 may touch multiple files.** Commit each fix as its own commit with a scoped message — makes bisecting easier if something breaks.

10. **If the `ui-ux-pro-max` skill is not available in the execution environment**, stop and report. Phase 5 is blocked without it. Do not fake a design system by picking tokens yourself.
