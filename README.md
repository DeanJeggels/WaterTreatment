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
