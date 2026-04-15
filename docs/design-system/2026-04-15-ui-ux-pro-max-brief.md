# AquaSim v2 — Design System (from ui-ux-pro-max)

**Generated:** 2026-04-15 via `ui-ux-pro-max` CLI (`search.py --design-system`)
**Query:** `consulting engineer SaaS wastewater dark-mode-first technical dense dashboard`
**Project:** AquaSim v2

---

## Brief given

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
> **Must have**: Dark mode (current default) AND light mode, WCAG AA contrast, responsive from tablet (768px) upward.
>
> **Color**: Water/environmental adjacency OK but avoid cliché aggressive blues. Teal-leaning deep green or slate with a precise accent.
>
> **Typography**: Readable at small sizes (~12px). Prefer geometric sans body + monospace for equations/numbers.

---

## Style name

**Dark Mode (OLED) — Technical Slate** (extended from skill's "Dark Mode (OLED)" entry for a consulting-engineer SaaS context)

**Rationale:** ui-ux-pro-max flagged Dark Mode (OLED) with slate-900/slate-800 neutrals and green positive indicators. The pattern suggestion ("Horizontal Scroll Journey") is ignored — that's a landing-page pattern, not applicable to a dashboard app. The value is in the palette + typography + effects guidance.

**Skill's raw anti-patterns:** Light mode default, slow rendering.

**Skill's key effects:** Minimal glow (text-shadow, used sparingly), dark-to-light transitions, low white emission, high readability, visible focus.

---

## Light palette (HSL triplets — shadcn-style)

```
--background: 0 0% 100%
--foreground: 222 47% 11%
--card: 0 0% 100%
--card-foreground: 222 47% 11%
--popover: 0 0% 100%
--popover-foreground: 222 47% 11%
--primary: 222 47% 11%
--primary-foreground: 210 40% 98%
--secondary: 210 40% 96%
--secondary-foreground: 222 47% 11%
--muted: 210 40% 96%
--muted-foreground: 215 16% 47%
--accent: 142 71% 45%
--accent-foreground: 0 0% 100%
--destructive: 0 72% 51%
--destructive-foreground: 210 40% 98%
--border: 214 32% 91%
--input: 214 32% 91%
--ring: 142 71% 45%
```

Light mode uses slate-900 foreground on white, with the green accent reserved for CTAs and focus rings. Primary buttons are slate-900 (not green) so the palette stays restrained — green appears only as "success" semantic.

---

## Dark palette

```
--background: 229 84% 5%
--foreground: 210 40% 98%
--card: 222 47% 11%
--card-foreground: 210 40% 98%
--popover: 222 47% 11%
--popover-foreground: 210 40% 98%
--primary: 142 71% 45%
--primary-foreground: 229 84% 5%
--secondary: 217 33% 17%
--secondary-foreground: 210 40% 98%
--muted: 217 33% 17%
--muted-foreground: 215 20% 65%
--accent: 217 33% 17%
--accent-foreground: 210 40% 98%
--destructive: 0 63% 40%
--destructive-foreground: 210 40% 98%
--border: 217 33% 17%
--input: 217 33% 17%
--ring: 142 71% 45%
```

Dark mode takes cue from the skill's raw palette:
- background `#020617` → `229 84% 5%` (slate-950)
- card `#0F172A` → `222 47% 11%` (slate-900)
- secondary/muted `#1E293B` → `217 33% 17%` (slate-800)
- primary `#22C55E` → `142 71% 45%` (green-500)
- foreground `#F8FAFC` → `210 40% 98%` (slate-50)

In dark mode the green is promoted to primary (for visibility on dark surfaces), in light mode it's demoted to accent (too much green on white = loud).

**Dark mode notes:** foreground is slightly warmer than pure white (slate-50, not true `0 0% 100%`) to reduce eye fatigue during long work sessions. Card backgrounds sit 6% lighter than the page background for subtle elevation without needing shadows.

---

## Radius

```
--radius: 0.5rem
```

Kept at shadcn default (skill did not address). 0.5rem is neutral: not brutalist-square, not marketing-friendly-rounded.

---

## Typography

Body: **Fira Sans** — `import { Fira_Sans } from 'next/font/google'`
Mono: **Fira Code** — `import { Fira_Code } from 'next/font/google'`

Both from ui-ux-pro-max directly: *"Fira Code + Fira Sans — dashboard, data, analytics, code, technical, precise. Best for dashboards, analytics, data visualization, admin panels."*

No display face: AquaSim is not a marketing app. Headings use Fira Sans in a higher weight (600/700). Equations and BOQ numbers use Fira Code so decimal alignment and digit kerning are consistent.

**Font variables to wire:**
- `--font-sans` → Fira Sans
- `--font-mono` → Fira Code

Geist (current) gets swapped out.

---

## Density / line-height / spacing notes

- Body line-height: 1.5 (Tailwind `leading-relaxed` on paragraphs, default `leading-normal` on UI chrome)
- Line length: tables and proposal prose capped at 75ch
- Numeric cells use `font-variant-numeric: tabular-nums` (critical for BOQ columns — already default for Fira Code)
- Letter spacing: default; the category labels in the unit palette may use `tracking-wide uppercase` at text-xs for subtle Swiss-style hierarchy

---

## Canvas tokens (React Flow)

Added as new CSS variables beyond the shadcn set:

```
--canvas-bg: hsl(var(--background))
--canvas-dots: hsl(var(--muted-foreground) / 0.18)
--canvas-edge: hsl(var(--border))
--canvas-edge-selected: hsl(var(--primary))
--canvas-node-border: hsl(var(--border))
--canvas-node-border-selected: hsl(var(--primary))
--canvas-handle: hsl(var(--primary))
```

**Background pattern:** dots (`BackgroundVariant.Dots`), `gap=20`, `size=1`. Dots beat lines here — lines imply a rigid grid, dots suggest "freeform schematic".

---

## Dark mode commentary

1. Use `hsl(var(--foreground))` not pure white — the slate-50 warmth makes dense tables readable for hours without causing "glowing white text" eye strain.
2. Elevation via background lightness, not box-shadow. Shadows look cheap in pure dark mode.
3. Focus rings use `--ring` (green) — high contrast on both light and dark, and semantically consistent with the CTA color.
4. Destructive stays red in both modes (low saturation in dark to avoid buzz).

---

## Pre-delivery checklist (from skill)

- [x] No emojis as icons (using lucide-react SVG)
- [ ] cursor-pointer on all clickable elements
- [ ] Hover transitions 150–300ms
- [ ] Light mode contrast 4.5:1+
- [ ] Visible focus states
- [ ] prefers-reduced-motion respected
- [ ] Responsive 768px–1440px+ (tablet-first, no mobile)

---

## Previous globals.css tokens (backup before Phase 5 overwrite)

The pre-Phase-5 `apps/web/app/globals.css` had **two** `:root` blocks and **two** `.dark` blocks — the first used shadcn HSL defaults, the second neutral oklch values. The second (neutral) block effectively overrode the first. Phase 5 consolidates both to a single HSL set.

Pre-overwrite values saved:

```css
/* First block (shadcn HSL defaults, blue primary) */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  --secondary: 210 40% 96.1%;
  /* ... */
}
.dark {
  --background: 222.2 84% 4.9%;
  --primary: 217.2 91.2% 59.8%;
  /* ... */
}

/* Second block (neutral oklch, overrides first) */
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  /* ... */
}
.dark {
  --background: oklch(0.145 0 0);
  --primary: oklch(0.922 0 0);
  /* ... */
}
```

Both blocks are replaced in Task 3.
