# Phase 5 Pre-Overhaul Notes

Snapshot captured 2026-04-15 via `scripts/screenshot.mjs` @ 1440×900.

## Known hardcoded color leaks (pre-audit)

- `apps/web/components/canvas/Canvas.tsx:87` — `stroke: '#94a3b8'` (slate-400) for edge default style
- Audit will scan remaining `slate|gray|zinc|neutral|blue-\d+` Tailwind leaks across `components/`

## Page coverage

- `/` landing — rendered fully (largest PNG, has marketing hero)
- `/login`, `/dashboard`, `/project/new` — captured at ~67KB each; dashboard and project routes are server-gated and redirect to `/login` without auth, so these are effectively login screenshots. Acceptable for now; Phase 5 will replace the full layout anyway.

## Current theme default

`<html className="dark">` in `app/layout.tsx` — SSR-default dark.
