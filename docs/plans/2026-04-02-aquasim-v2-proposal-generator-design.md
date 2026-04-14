# AquaSim v2 — WWTP Proposal Generator

**Date**: 2026-04-02
**Status**: Design approved, pending implementation plan
**Author**: Dean Jeggels (CH-ISE)
**Approach**: Incremental in-place upgrade of existing AquaSim codebase

---

## 1. Executive Summary

AquaSim v1 is a process simulator for wastewater treatment plants: engineers drag process units onto a React Flow canvas, run a steady-state mass balance, and check effluent compliance. v2 pivots the product from "simulator" to **proposal generator** — a tool that consulting engineers use to produce client-ready WWTP design documents (sizing, energy, OpEx, Bill of Quantities) with an auditable calculation record for every number.

The wedge is **easy usability + client-ready deliverables**. Engineers currently finish their sizing in the `WWTP Design.xlsm` spreadsheet (Marais-Ekama / WRC methodology, South Africa), then spend hours copying numbers into Word to format a proposal. v2 collapses those two steps: the proposal document is the UI, every number is traceable to an equation and a citation, and one click produces a PDF.

v1 infrastructure (Next.js 16, Supabase, Stripe, Netlify, React Flow) is retained. What changes is the **sim-engine interface** (richer per-unit outputs), the **unit library** (9 new unit types for a full biological WWTP), the **data model** (BoQ + proposals), the **UI** (ui-ux-pro-max overhaul), and the **deliverable** (live proposal document + PDF).

---

## 2. Context & Motivation

### 2.1 Current state (AquaSim v1)

- Next.js 16 + React Flow canvas + Supabase + Stripe + Netlify
- 10 process units: Influent, Primary Clarifier, Bioreactor (Aerobic/Anoxic/Anaerobic), Secondary Clarifier, Splitter, Mixer, Thickener, Effluent
- Steady-state mass balance sim-engine (`packages/sim-engine`) with 41 passing tests
- 7 Supabase tables: `profiles`, `organizations`, `org_members`, `projects`, `flowsheets`, `simulation_runs`, `templates`, `share_links`
- Existing `generate-report` Edge Function produces a basic HTML report (flowsheet summary + WQ table + compliance)
- Free / Pro / Enterprise Stripe tiers
- 5 phases built (Foundation, Sim Engine, Results, SaaS Polish, Launch)

### 2.2 Source of truth: WWTP Design.xlsm

`docs/WWTP Design.xlsm` is a 10-sheet calculator used by CH-ISE for real project sizing. Sheets:

| # | Sheet | Purpose |
|---|---|---|
| 0 | General | Cover |
| 1 | 0. Water Samples | **USER INPUT** — up to 11 WW samples + DWA limits (General/Special) |
| 2 | 1. Wastewater Characterisation | COD/TKN/TP fractionation |
| 3 | 2. Reactor Configuration | **USER INPUT** — ADWF, peak factor, process selection |
| 4 | 3. Kinetic & Stoich Constants | Marais-Ekama kinetic constants with temperature correction |
| 5 | 4. Bioreactor Design | Mass balance + nitrification + denitrification + alkalinity |
| 6 | 5. Reactor Sizing | Total volume split into aerobic / anoxic / anaerobic |
| 7 | 6. Aeration Design | O₂ demand + OTE + blower + diffuser count |
| 8 | 7. MBR Design | Membrane flux + SMU modules + air scour |
| 9 | Summary | Key outputs |

Methodology: **Marais-Ekama / WRC** (Ekama 1984, WRC TT-16/84), MLE and UCT processes, DWA discharge standards.

### 2.3 Problem with the xlsm

- Opaque formulas in merged cells; hard to audit
- No Bill of Quantities, no energy summary, no OpEx
- Missing units: screens, grit, equalisation tank, dewatering, chemical dosing, UV, inlet pumping, aeration blower as a standalone BoQ item
- Output is Excel; engineer still has to copy numbers into Word for the client proposal
- Single-user, single-file; no version control, no collaboration, no share links

### 2.4 Why AquaSim v1 isn't enough

v1 models water quality but not sizing, energy, cost, or consumables. The `generate-report` function produces a thin compliance report, not a full design document. The sim-engine unit interface returns only `WaterQuality[]`, so there's no place to attach sizing dimensions, kW, BoQ line items, or calculation records.

---

## 3. Goals & Non-Goals

### Goals
1. Replace the xlsm as the production design tool used by consulting engineers in South Africa
2. Produce a client-ready design proposal PDF with one click
3. Every number in the proposal is traceable to an equation, inputs, and a citation (no magic numbers)
4. Cover a full biological WWTP: preliminary → primary → biological → tertiary → sludge handling
5. Include energy analysis (installed kW + kWh/day), consumables (chemicals L/day), and a Bill of Quantities with real supplier prices
6. Reuse v1 infrastructure (Supabase, Stripe, Netlify, React Flow canvas)
7. ui-ux-pro-max quality on the UI

### Non-goals (v1)
- International discharge standards (US EPA, EU UWWTD) — SA only
- Dynamic simulation (ASM1/ASM2d) — steady-state Marais-Ekama only
- Anaerobic digester, RO, advanced tertiary, odour control — v2+
- Automated pricing updates — prices are static TS modules, updated via PRs
- Plant operation optimisation / SCADA integration
- Rebuild of auth, Stripe, landing page architecture, or Supabase schema from scratch
- Migration of existing users away from AquaSim (they get auto-upgraded)

---

## 4. Target User & Wedge

### Target user
Consulting process engineers in South Africa designing biological WWTPs for municipal, industrial, and private clients. Typical project scale: 50 m³/d – 10 ML/d. They currently use `WWTP Design.xlsm` (or their own personal spreadsheet) to size the plant, then manually produce a Word proposal.

### Wedge
**Deliverables + easy usability.** Engineers don't switch tools for features; they switch when a tool saves them hours on *each project*. v2 collapses sizing and proposal-writing into a single workflow: the proposal document is the UI, calculations are live, and the PDF is always one click away.

### Differentiation vs alternatives
| Tool | Strength | Why engineers switch to v2 |
|---|---|---|
| `WWTP Design.xlsm` | Trusted methodology | v2 has the same methodology + produces the proposal automatically |
| BioWin / GPS-X / SUMO | Dynamic simulation | v2 is web-based, cheaper, focused on design (not operations) |
| Manual Excel + Word | Full flexibility | v2 eliminates the copy-paste step entirely |

---

## 5. Architecture

### 5.1 Module boundaries

```
aquasim/
├── apps/web/                        # Next.js 16 app (existing, UI overhaul)
│   ├── app/
│   │   ├── project/[id]/
│   │   │   ├── flowsheet/[fsid]/    # Canvas + inspector
│   │   │   └── proposal/[fsid]/     # ★ NEW — live proposal document
│   │   ├── library/
│   │   │   ├── units/               # ★ NEW — browse the 18 unit types
│   │   │   └── prices/              # ★ NEW — browse supplier price library
│   │   ├── settings/                # ★ NEW — company branding
│   │   └── (dashboard)/dashboard/   # Project list (existing)
│   └── lib/
│       ├── proposal/                # ★ NEW — ProposalDocument React tree
│       └── boq/                     # ★ NEW — BoQ aggregation engine
│
├── packages/
│   ├── sim-engine/                  # EXISTING — v2 major version bump
│   │   ├── units/                   # 18 unit models (9 existing + 9 new)
│   │   ├── graph/                   # Topological sim (unchanged)
│   │   └── calculation-record.ts    # ★ NEW — structured equation records
│   ├── design-library/              # ★ NEW — static reference data
│   │   ├── dwa-limits.ts            # SA discharge standards
│   │   ├── supplier-prices.ts       # Huber/Xylem/Sulzer/Grundfos/... + citations
│   │   ├── kinetic-constants.ts     # Marais-Ekama constants
│   │   └── defaults.ts              # SA typical influent quality
│   └── shared-types/                # EXISTING — extended
│
└── Supabase Edge Functions/
    └── generate-proposal/           # ★ NEW — replaces generate-report
```

### 5.2 Data flow (one design run)

```
Engineer drags units onto canvas
  → Inspector shows unit inputs, fills in with defaults from design-library
  → sim-engine runs: topological sort → per-unit calculate() → iterative convergence
  → Each unit emits UnitOutputs { waterQuality, sizing, energy, consumables, capex, calculationRecords }
  → BoQ engine aggregates capex.lineItems across all units → grouped by category → totals
  → Proposal view re-renders live document with all sections
  → Engineer clicks "Generate Proposal PDF" → browser print dialog → save as PDF
```

### 5.3 What stays unchanged
Auth, Stripe, RLS, middleware, share links, organisations, project list, React Flow library, Netlify deploy pipeline. The graph sim algorithm (Kahn's + DFS back-edge + iterative convergence) is unchanged; only the type of data it passes between nodes changes.

### 5.4 What's deleted
The existing `ResultsPanel` component (tabbed bottom panel with Chart/Table/Compliance). Its contents are redistributed:
- **Chart** (COD/BOD/NH3 progression) → figure inside the proposal document
- **Mass balance table** → section 5 of the proposal document
- **Compliance check** → section 10 of the proposal document

---

## 6. Unit Library & Sim-Engine Interface

### 6.1 v2 unit interface (breaking change)

```typescript
// packages/sim-engine/src/calculation-record.ts
export interface CalculationRecord {
  label: string;           // "Aerobic volume"
  symbol: string;          // "Va"
  equation: string;        // "Va = Vt × (1 − fxt)"
  inputs: Record<string, { value: number; unit: string; source: string }>;
  result: { value: number; unit: string };
  citation: string;        // "Ekama (1984) WRC TT-16/84, eq 4.12"
}

export interface Dimension { value: number; unit: string }

export interface BoQLineItem {
  category: 'civil' | 'mechanical' | 'electrical' | 'chemicals' | 'instrumentation';
  description: string;
  quantity: number;
  unit: string;            // 'm3', 'ea', 'kW', 'L/month'
  unitPriceZar: number;
  sourceCitation: string;  // "Huber ROTAMAT quote 2025"
}

export interface UnitOutputs {
  waterQuality: WaterQuality[];
  sizing: Record<string, Dimension>;
  energy: {
    installedKW: number;
    dailyKWh: number;
    records: CalculationRecord[];
  };
  consumables: Array<{
    item: string;
    daily: number;
    unit: string;          // "L/day" | "kg/day"
    citation: string;
  }>;
  capex: {
    lineItems: BoQLineItem[];
    total: number;         // ZAR
  };
  calculationRecords: CalculationRecord[];
  warnings: string[];
}

export interface PlantContext {
  ambientTemperature: { min: number; max: number };   // °C
  siteElevation: number;                                // m
  dischargeStandard: 'General' | 'Special';
  designFlows: { adwf: number; awwf: number; pwwf: number };  // m³/d
}

export interface UnitModel {
  id: string;
  name: string;
  category: 'preliminary' | 'primary' | 'biological' | 'tertiary' | 'sludge' | 'utility';
  calculate(
    inputs: WaterQuality[],
    config: UnitConfig,
    ctx: PlantContext
  ): UnitOutputs;
  validate(config: UnitConfig): ValidationResult;
  defaultConfig(): UnitConfig;
}
```

**Migration from v1**: each existing unit's `calculate()` returns only `waterQuality`. The v2 refactor wraps each call to produce the full `UnitOutputs` struct. Sizing/energy/capex for existing units (aerobic bioreactor, clarifiers, thickener) is implemented during Phase 1 of the migration.

### 6.2 The 18 units

| # | Unit | Category | Primary sizing method | Energy model | Primary citation |
|---|---|---|---|---|---|
| 1 | Influent | utility | Flow + WQ source | — | User input |
| 2 | Coarse screen | preliminary | Bar spacing × approach velocity × peak flow | — | Metcalf & Eddy Ch. 5 |
| 3 | Fine screen | preliminary | Hydraulic capacity per manufacturer curve | kW cleaning drive | Huber ROTAMAT datasheet |
| 4 | Grit removal (aerated) | preliminary | HRT 3–5 min @ PWWF | Air scour kW | Metcalf & Eddy Ch. 5 |
| 5 | Equalisation tank | preliminary | Cumulative mass diagram (hourly flow + load) | Mixing ≈ 5 W/m³ | Metcalf & Eddy Ch. 5 |
| 6 | Primary clarifier | primary | SOR 40 m³/m²·d ADWF, 100 peak | — | WRC TT-16/84 |
| 7 | Bioreactor — Anaerobic | biological | HRT + mass fraction | Mixing kW | Ekama 1984 |
| 8 | Bioreactor — Anoxic | biological | Denitrification potential Dp1 | Mixing kW | Ekama 1984 eq 4.15 |
| 9 | Bioreactor — Aerobic | biological | Sludge age Rs + MLSS | O₂ demand → blower | Ekama 1984 eq 4.8 |
| 10 | MBR | biological | J × A = Q; SMU modules from flux rating | Air scour kW | Judd (2011) *The MBR Book* |
| 11 | Aeration blower | utility | Am³/hr from O₂ demand + OTE | kW = Q × ΔP / η | ASCE 2-06 |
| 12 | Secondary clarifier | biological | SOR ≤ 1 m/h peak; SLR ≤ 6 kg/m²·h | — | WRC TT-16/84 |
| 13 | Thickener | sludge | SLR 40 kg/m²·d | Mixing kW | Metcalf & Eddy Ch. 14 |
| 14 | Dewatering (belt press / centrifuge) | sludge | Solids loading + polymer dose | kW + polymer L/d | Alfa Laval / Andritz |
| 15 | Chemical dosing | utility | Stoichiometric dose × Q | Pump kW | Metcalf & Eddy Ch. 9 |
| 16 | UV disinfection | tertiary | Fluence × Q ≥ 40 mJ/cm² | Lamp kW | USEPA UVDGM 2006 |
| 17 | Inlet pumping | utility | TDH × Q × ρ × g / η | kW | Grundfos / KSB curves |
| 18 | Splitter / Mixer | utility | Flow bookkeeping | — | — |

### 6.3 Graph simulation
Unchanged from v1. Kahn's algorithm for topological sort, DFS back-edge detection for recycle streams (RAS, internal a-recycle), iterative convergence. Only the payload type between nodes changes from `WaterQuality[]` to `UnitOutputs`.

---

## 7. Data Model & Schema

### 7.1 Kept without change
`profiles`, `organizations`, `org_members`, `projects`, `templates`, `share_links`

### 7.2 Extended
```sql
ALTER TABLE flowsheets ADD COLUMN proposal_data jsonb;
-- proposal_data shape:
-- {
--   "client": {"name": "...", "project_code": "...", "location": "..."},
--   "designer": {"name": "...", "title": "Pr.Eng", "date": "2026-04-02"},
--   "executive_summary": "...",
--   "design_basis": {...},
--   "disclaimer": "..."
-- }

ALTER TABLE profiles ADD COLUMN company_name text;
ALTER TABLE profiles ADD COLUMN company_logo_url text;
ALTER TABLE profiles ADD COLUMN designer_title text;
```

### 7.3 New tables

```sql
CREATE TABLE boq_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flowsheet_id uuid NOT NULL REFERENCES flowsheets(id) ON DELETE CASCADE,
  unit_node_id text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'civil', 'mechanical', 'electrical', 'chemicals', 'instrumentation'
  )),
  description text NOT NULL,
  quantity numeric NOT NULL,
  unit text NOT NULL,
  unit_price_zar numeric NOT NULL,
  total_price_zar numeric GENERATED ALWAYS AS (quantity * unit_price_zar) STORED,
  source_citation text NOT NULL,
  override_reason text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX boq_line_items_flowsheet_id_idx ON boq_line_items(flowsheet_id);

CREATE TABLE project_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flowsheet_id uuid NOT NULL REFERENCES flowsheets(id) ON DELETE CASCADE,
  generated_by uuid REFERENCES auth.users(id),
  generated_at timestamptz DEFAULT now(),
  version integer NOT NULL,
  pdf_url text,
  snapshot jsonb NOT NULL
);
CREATE INDEX project_proposals_flowsheet_id_idx ON project_proposals(flowsheet_id);
```

### 7.4 Deprecated
`simulation_runs` — retained in schema for backward compatibility but no longer written. Calculation history lives in `project_proposals.snapshot`.

### 7.5 RLS
All new tables follow the existing pattern: users access rows belonging to flowsheets they own or are organisation members of. Uses the existing `is_org_member()` security definer helper.

---

## 8. UI & UX Flow

### 8.1 Navigation
- `/dashboard` — project list (minor polish)
- `/project/[id]/flowsheet/[fsid]` — flowsheet tab (canvas + inspector)
- `/project/[id]/proposal/[fsid]` — proposal tab (live document)
- `/library/units` — browse the 18 unit types with formulas and citations
- `/library/prices` — browse supplier price library
- `/settings` — user profile + company branding (logo, title, disclaimer default)

### 8.2 Project editor layout (Flowsheet view)

```
┌─────────────────────────────────────────────────────────────┐
│ Top: Project · [Flowsheet | Proposal] tabs · Save · Share   │
│      · [Generate Proposal PDF]                              │
├────────┬───────────────────────────────────┬────────────────┤
│ Unit   │                                   │ Inspector      │
│ palette│  React Flow canvas                │ - Config       │
│ (18    │  (18 node types, grouped by       │ - Calculations │
│ units) │   category)                       │   (inline      │
│        │                                   │    equations)  │
│        │                                   │ - BoQ lines    │
│        │                                   │ - Warnings     │
├────────┴───────────────────────────────────┴────────────────┤
│ Status bar: 14/18 units configured · 3 warnings · Converged │
└─────────────────────────────────────────────────────────────┘
```

### 8.3 Inspector calculation rendering

For each calculation record:
```
Aerobic volume (Va)
  Va = Vt × (1 − fxt)
    Vt  = 250 m³     (total reactor volume, from sizing)
    fxt = 0.25       (selected anoxic fraction)
  = 187.5 m³
  📖 Ekama (1984) WRC TT-16/84, eq 4.12
```
Citation links drill into `/library/units/[unit]#citation-X`.

### 8.4 Proposal document sections (11)
1. **Cover page** — client, project code, date, designer, company logo
2. **Executive summary** — auto-generated + editable narrative
3. **Design basis** — flows, influent quality, effluent standards, process selection rationale
4. **Process description** — auto-generated flowsheet figure + unit narratives
5. **Sizing calculations** — per unit, calculation records rendered as in inspector
6. **Aeration design** — blower size, diffuser count, OTE with α/β/Ω/F corrections
7. **Energy analysis** — installed kW table, kWh/day, annual energy cost estimate
8. **Consumables** — chemicals L/month, annual cost
9. **Bill of Quantities** — line items by category, totals
10. **Effluent compliance** — table vs DWA limits, pass/fail per parameter
11. **Disclaimer** — editable in settings

Editable fields: client name, executive summary narrative, disclaimer.
Calculated fields: read-only; clicking drills back into the flowsheet.

### 8.5 Design system
ui-ux-pro-max will be invoked during the UI overhaul phase of implementation. Covers: typography, palette, component tokens, empty states, dark mode support, tablet responsiveness.

Shadcn primitives used: Dialog, Card, Button, Badge, Input, Select, Tabs, Collapsible, Separator, Tooltip, Sheet, Table, Toast.

---

## 9. Proposal PDF & BoQ Engine

### 9.1 BoQ aggregation
```
flowsheet.nodes
  → per-unit calculate() emits UnitOutputs.capex.lineItems
  → BoQEngine.aggregate(nodes)
    → group by category (civil / mech / elec / chemicals / instr)
    → apply project-level overrides (discount, margin)
    → persist to boq_line_items table
    → compute category subtotals + grand total
  → ProposalDocument renders BoQ section 9
```

Supplier prices come from `packages/design-library/supplier-prices.ts` — a static TypeScript module, versioned in git, updated via PR. Each price entry carries `{description, unitPriceZar, unit, supplier, sourceCitation}`. Engineers override prices per-project via the inspector; overrides persist to `boq_line_items.unit_price_zar` with `override_reason`.

### 9.2 PDF generation

**v1 — Browser print-to-PDF**
- Proposal view IS the PDF source (WYSIWYG)
- CSS `@media print` controls page breaks, headers, footers, margins
- User clicks "Generate Proposal PDF" → browser print dialog → save as PDF
- Zero server cost, zero latency, zero new infra

**v2 (future) — Server-rendered PDF**
- Supabase Edge Function renders HTML via Playwright → binary PDF
- Stored in Supabase Storage, linked from `project_proposals.pdf_url`
- Used for share links, archive, version history

v1 ships browser print only. v2 is a future enhancement if real users need server-side rendering.

### 9.3 Proposal template
Single React component tree at `apps/web/lib/proposal/ProposalDocument.tsx`. Props: `{flowsheet, calculations, boq, proposalData, profile}`. Tailwind with `print:` variants for page break control. Co-located section components under `apps/web/lib/proposal/sections/`.

---

## 10. Testing, Migration & Rollout

### 10.1 Testing strategy
- **Vitest unit tests** (`packages/sim-engine/tests/`): every unit model tested for sizing, energy, consumables, capex, and calculation-record integrity. Target: 120+ tests (up from 41)
- **Vitest integration tests**: full plant trains (MLE, UCT, MLE+MBR) run end-to-end with proposal data validated
- **Snapshot tests**: `ProposalDocument` renders deterministic output for golden-flowsheet fixtures
- **Playwright E2E**: create project → drop units → run sim → view proposal → click Generate PDF → verify downloaded file
- **Visual regression** (optional, v2): proposal PDF rendering via Playwright screenshots

### 10.2 Migration plan (phased on `v2-proposal-generator` branch)

| Phase | Scope | Output |
|---|---|---|
| 1 | sim-engine v2 interface refactor | Breaking change; all 41 existing tests updated to new `UnitOutputs` shape |
| 2 | Add 9 new unit models | Screens, grit, EQ, MBR, blower, dewatering, dosing, UV, inlet pumping with tests |
| 3 | BoQ engine + design-library | Supplier prices, DWA limits, defaults, kinetic constants all in code |
| 4 | Schema migrations | `boq_line_items`, `project_proposals`, `ALTER flowsheets`, `ALTER profiles`; RLS policies |
| 5 | UI design system overhaul | ui-ux-pro-max invoked for tokens, typography, palette, component restyling |
| 6 | Inspector redesign | Inline calculation-record rendering |
| 7 | Proposal view | Live document + 11 sections + PDF via browser print |
| 8 | Landing page rewrite | Positioning pivot from "simulator" to "proposal generator" |
| 9 | Merge to main + deploy | Cut-over with feature flag |

### 10.3 Rollout
- Feature flag `NEXT_PUBLIC_ENABLE_V2` gates the new UI during development; production points at v1 until flip
- Beta: Dean + 2–3 trusted consulting engineers (real projects)
- Existing users auto-upgraded on cut-over; existing flowsheets carry over (graph format unchanged — only new output fields)
- Stripe tiers unchanged at launch; evaluate limits after 4 weeks of usage

### 10.4 Documentation
- `docs/plans/` — design docs + implementation plans
- `README.md` — v2 positioning rewrite
- `packages/sim-engine/README.md` — v2 unit interface guide
- `packages/design-library/README.md` — supplier data sourcing + update process
- Obsidian vault `CH-ISE/BioWin Clone/` (rename to `CH-ISE/AquaSim/`) — update Progress Log with Phase 6 entry

---

## 11. Open Questions & Risks

### Open questions
1. **Supplier prices** — do we have access to recent Huber, Xylem, Sulzer, Grundfos, Alfa Laval SA price lists, or do we need to source them fresh? Initial v1 can ship with indicative ranges that engineers override.
2. **Company branding assets** — CH-ISE logo / proposal template preferences for Dean's own use case.
3. **Stripe tier rebalance** — does the "consulting engineer" user profile need different limits than the current Free/Pro/Enterprise tiers (designed for the old positioning)?

### Risks
1. **Unit interface refactor breaks all 41 existing tests.** Mitigated by updating tests in lockstep during Phase 1 and using TypeScript's type system to force every callsite.
2. **Supplier price staleness.** Prices in `design-library` will drift from reality. Mitigated by (a) version tagging in git, (b) displaying "Price source: [supplier, date]" in the inspector, (c) easy per-project override.
3. **Browser print-to-PDF inconsistency.** Different browsers render page breaks differently. Mitigated by targeting Chrome/Edge as the recommended browser and documenting in-app.
4. **ui-ux-pro-max timeline risk.** UI overhaul phase may expand if the design system is more ambitious than needed. Mitigated by scoping the overhaul to: tokens, inspector, proposal view, landing page — leaving auth/dashboard/settings for a post-launch polish pass.
5. **Scope creep.** "Full plant + energy + opex + BoQ" is already large. Mitigated by strictly deferring anaerobic digester, RO, advanced tertiary, and odour control to v2.

---

## 12. Appendix — Key Citations

- **Marais, G.v.R. & Ekama, G.A. (1976)** — "The activated sludge process Part I: Steady state behaviour", *Water SA* 2(4), 163–200
- **WRC TT-16/84 (1984)** — Ekama et al., *Theory, Design and Operation of Nutrient Removal Activated Sludge Processes*, Water Research Commission, South Africa
- **Henze, M., van Loosdrecht, M.C.M., Ekama, G.A., Brdjanovic, D. (2008)** — *Biological Wastewater Treatment: Principles, Modelling and Design*, IWA Publishing
- **Metcalf & Eddy / Tchobanoglous et al. (2014)** — *Wastewater Engineering: Treatment and Resource Recovery*, 5th ed., McGraw-Hill
- **Judd, S. (2011)** — *The MBR Book: Principles and Applications of Membrane Bioreactors*, 2nd ed., Butterworth-Heinemann
- **ASCE 2-06** — *Measurement of Oxygen Transfer in Clean Water*, American Society of Civil Engineers
- **USEPA UVDGM 2006** — *Ultraviolet Disinfection Guidance Manual*, US Environmental Protection Agency
- **DWA (South Africa)** — General & Special Limits, National Water Act
- **Supplier datasheets** — Huber ROTAMAT, Xylem Sanitaire, Sulzer HST, Grundfos, KSB, Alfa Laval, Andritz, Megavision

---

*Design approved 2026-04-02. Next step: implementation plan via `superpowers:writing-plans`.*
