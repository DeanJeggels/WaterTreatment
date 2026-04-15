# AquaSim v2 — Phase 7: Proposal View + PDF Generation

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Build the payoff of the entire rebuild — a live proposal document at `/project/[id]/proposal/[flowsheetId]` that renders an 11-section engineering design report from the current flowsheet, live-updates as the engineer tweaks parameters, persists editable narrative fields to `flowsheets.proposal_data`, saves BoQ line items to `boq_line_items` on explicit save, and produces a client-ready PDF via browser print-to-PDF. Delete the legacy `ResultsPanel`. Replace the old "Generate Report" flow with the new persistence → print pipeline.

**Architecture:** New client-side route parallel to the existing flowsheet editor. Both routes share the same Zustand stores (`project-store`, `flowsheet-store`, `simulation-store`) so switching tabs is instant. A shared `<ProjectEditorTabs>` component renders the Flowsheet ↔ Proposal toggle on both pages. The proposal document is a React component tree under `apps/web/lib/proposal/` — one orchestrator plus 11 section components. It consumes `nodeResults` from `simulation-store`, runs `aggregateBoQ()` locally, compares effluent against DWA limits from `@repo/design-library`, and renders live. Editable fields (client name, executive summary narrative, disclaimer) persist to `flowsheets.proposal_data` with a 1 s debounce. The "Generate Proposal PDF" button persists a snapshot to `boq_line_items` + `project_proposals` then calls `window.print()`. A CSS `@media print` block styles the document for print (page breaks, hidden chrome, tight margins).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, shadcn + Phase 5 tokens, Zustand stores, Supabase client (`@supabase/ssr`), `@repo/sim-engine` (`aggregateBoQ`), `@repo/design-library` (`DWA_LIMITS`). No new deps.

---

## Context & References

- **Design doc:** `docs/plans/2026-04-02-aquasim-v2-proposal-generator-design.md` sections 4 (UI flow), 5 (proposal sections), 9 (PDF + BoQ engine)
- **Phases 1a–6 complete.** Combined test count: **134** (118 sim-engine + 16 design-library)
- **Starting branch:** `v2-proposal-generator`

### Current project editor state (from Phase 6 executor notes)

- Project editor page: `apps/web/app/project/[id]/flowsheet/[flowsheetId]/page.tsx`
- Client component, composes: `Canvas`, `UnitPalette`, `InspectorPanel` (Phase 6 redesign), `ResultsPanel` (legacy — **deleted in Task 1**)
- Has a `handleGenerateReport` function that calls the existing `generate-report` Edge Function — **replaced** by the new persistence+print pipeline in Tasks 10–11
- Gates PDF generation on `limits.pdfReports` from `useSubscription` — **preserved** (free tier still blocked)
- No `layout.tsx` under `/project/[id]/` — each page defines its own chrome. Phase 7 does not introduce a layout; instead, a shared `<ProjectEditorTabs>` component is imported by both routes
- Type widening from Phase 6: `SimulationResults.nodeResults` is now `Record<string, ProcessResult>`. The proposal view relies on this — don't revert it
- `ResultsPanel` is also referenced by `apps/web/app/shared/[token]/page.tsx`. Phase 7 removes the import there and replaces with a minimal inline "results not available on shared view" block — shared pages keep showing the flowsheet without the tabbed results panel

### Phase 4 schema (available for persistence)

- `flowsheets.proposal_data jsonb` — holds `{ client, designer, executive_summary, design_basis, disclaimer }`
- `profiles.company_logo_url text`, `profiles.designer_title text` — populated via `/settings` (Phase 5 didn't build this; Phase 7 uses defaults if empty)
- `boq_line_items` — 12-column table, `total_price_zar` generated, 4 RLS policies — one row per priced item
- `project_proposals` — 8-column immutable snapshot table, unique `(flowsheet_id, version)`, 3 RLS policies (no UPDATE)

### The 11 proposal sections (from design doc section 5)

| # | Section | Source |
|---|---|---|
| 1 | Cover page | `proposal_data.client`, `proposal_data.designer`, `profiles.company_*` |
| 2 | Executive summary | Auto-generated (grand total, installed kW, unit count) + editable narrative |
| 3 | Design basis | `flowsheets.discharge_standards`, influent unit config, project description |
| 4 | Process description | Auto-generated flowsheet figure (read-only React Flow) + unit narratives |
| 5 | Sizing calculations | `nodeResult.calculationRecords` per unit, grouped by unit |
| 6 | Aeration design | `AerationBlower` unit outputs + `BioreactorAerobic.energy.records` (O₂ demand) |
| 7 | Energy analysis | Sum of `nodeResult.energy.installedKW` + `dailyKWh`, annual cost estimate |
| 8 | Consumables | Sum of `nodeResult.consumables`, annualized, tabulated |
| 9 | Bill of Quantities | `aggregateBoQ()` result, grouped by category |
| 10 | Effluent compliance | Final effluent vs `DWA_LIMITS[standard]`, pass/fail per parameter |
| 11 | Disclaimer | `proposal_data.disclaimer` (editable) with default text |

## Success Criteria

1. New route `/project/[id]/proposal/[flowsheetId]` exists and renders the live proposal document
2. Both routes (`flowsheet` + `proposal`) have a tab toggle at the top that navigates between them without losing state (because stores persist)
3. Legacy `ResultsPanel` component deleted. `apps/web/components/results/` directory deleted (or emptied). The shared-page reference is cleaned up.
4. All 11 proposal sections render with data from the current flowsheet
5. Editable fields (client name, exec summary narrative, disclaimer) persist to `flowsheets.proposal_data` with a 1 s debounce
6. "Save BoQ" button writes all current `capex.lineItems` to `boq_line_items` (replaces existing rows for that flowsheet to avoid duplicates)
7. "Generate Proposal PDF" button: (a) saves BoQ if dirty, (b) inserts a new `project_proposals` row with the full snapshot, (c) calls `window.print()`
8. Subscription gate preserved — free tier can't generate PDFs (toast error)
9. `@media print` CSS hides app chrome (tabs, toolbar, sidebar) and styles the proposal for print (page breaks between sections, A4 margins, header on every page)
10. Manual smoke test: generate a proposal from a full plant, print preview shows readable output across ~5–10 pages
11. Web build clean, type check clean
12. Test count unchanged at **134** (Phase 7 is UI + persistence only — no new sim-engine logic)
13. Hardcoded-color grep on new files returns clean

## Non-Goals (deferred)

- **Server-rendered PDF** (Playwright in an Edge Function) — `@media print` + browser print is v1 per design doc
- **PDF uploads to Supabase Storage** (`project_proposals.pdf_url`) — browser print doesn't produce a file we can intercept; `pdf_url` stays NULL in v1
- **Version history UI** (show prior `project_proposals` snapshots) — later polish
- **Proposal templates / project brief scaffolding** — engineer fills everything manually in v1
- **Engineer BoQ override UX** (inline price editing) — Phase 7 reads from `aggregateBoQ` without overrides; override path is wired but the UI is a later phase
- **Share link support** for proposal view — shared `/shared/[token]` page shows the flowsheet only, not the proposal (revisit if real users need it)
- **`/settings` page to edit `profiles.company_logo_url` / `designer_title`** — use sensible defaults if empty; Phase 8 or later adds a settings page
- **i18n / unit conversion** (metric vs imperial) — SA only, all metric
- **KaTeX equation rendering** — plain strings via the existing Phase 6 `CalculationRecordCard` component

---

## Tasks

### Task 0: Verify starting state

**Step 1: Branch + clean tree**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && git status && git log --oneline | head -5
```
Expected: `On branch v2-proposal-generator`, clean tree, recent Phase 6 commit.

**Step 2: Tests green + build clean**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
(cd packages/sim-engine && npx vitest run) && \
(cd packages/design-library && npx vitest run) && \
npx turbo run build --filter=web
```
Expected: 118 + 16 passing, web build clean 12 routes.

---

### Task 1: Create `<ProjectEditorTabs>` component + add to flowsheet page

**Files:**
- Create: `apps/web/components/layout/project-editor-tabs.tsx`
- Modify: `apps/web/app/project/[id]/flowsheet/[flowsheetId]/page.tsx`

**Context:** Both the existing flowsheet page and the new proposal page (Task 2) need the same tab toggle at the top. Extract it now so Task 2 can just import and use it.

**Step 1: Create the component**

```typescript
// apps/web/components/layout/project-editor-tabs.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutGrid, FileText } from 'lucide-react';

interface Props {
  projectId: string;
  flowsheetId: string;
}

export function ProjectEditorTabs({ projectId, flowsheetId }: Props) {
  const pathname = usePathname();
  const base = `/project/${projectId}`;
  const flowsheetHref = `${base}/flowsheet/${flowsheetId}`;
  const proposalHref = `${base}/proposal/${flowsheetId}`;

  const isFlowsheet = pathname.startsWith(`${base}/flowsheet/`);
  const isProposal = pathname.startsWith(`${base}/proposal/`);

  return (
    <nav className="flex items-center gap-1 print:hidden" aria-label="Project editor tabs">
      <Link
        href={flowsheetHref}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
          isFlowsheet
            ? 'bg-accent text-accent-foreground font-medium'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        )}
      >
        <LayoutGrid className="h-4 w-4" />
        Flowsheet
      </Link>
      <Link
        href={proposalHref}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
          isProposal
            ? 'bg-accent text-accent-foreground font-medium'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        )}
      >
        <FileText className="h-4 w-4" />
        Proposal
      </Link>
    </nav>
  );
}
```

Note the `print:hidden` — the tabs disappear from printed PDFs.

**Step 2: Add the tabs to the existing flowsheet page**

Open `apps/web/app/project/[id]/flowsheet/[flowsheetId]/page.tsx`. Find the top toolbar (it has the project name, save button, run-sim button, share button, etc.). Add `<ProjectEditorTabs projectId={params.id} flowsheetId={params.flowsheetId} />` next to the project name, before the action buttons.

Example placement:
```tsx
<header className="flex items-center justify-between gap-4 border-b border-border px-4 py-2 print:hidden">
  <div className="flex items-center gap-4">
    <h1 className="text-sm font-semibold">{projectName}</h1>
    <ProjectEditorTabs projectId={params.id} flowsheetId={params.flowsheetId} />
  </div>
  <div className="flex items-center gap-2">
    {/* existing save/run/share buttons */}
  </div>
</header>
```

Also add `print:hidden` to the outer toolbar so print output doesn't show any editor chrome. Apply the same to the unit palette and canvas wrappers if they're separate elements.

**Step 3: Web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean.

**Step 4: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/components/layout/project-editor-tabs.tsx \
        apps/web/app/project/\[id\]/flowsheet/\[flowsheetId\]/page.tsx && \
git commit -m "Add ProjectEditorTabs component and wire into flowsheet page"
```

---

### Task 2: Scaffold the proposal route with an empty shell

**Files:**
- Create: `apps/web/app/project/[id]/proposal/[flowsheetId]/page.tsx`

**Step 1: Create the page**

```typescript
// apps/web/app/project/[id]/proposal/[flowsheetId]/page.tsx
'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ProjectEditorTabs } from '@/components/layout/project-editor-tabs';
import { PageShell } from '@/components/layout/page-shell';
import { useProjectStore } from '@/stores/project-store';
import { useSimulationStore } from '@/stores/simulation-store';
import { ErrorBoundary } from '@/components/error-boundary';

export default function ProposalPage() {
  const params = useParams<{ id: string; flowsheetId: string }>();
  const { projectName, loadFlowsheet, setProject } = useProjectStore();

  useEffect(() => {
    setProject(params.id);
    loadFlowsheet(params.flowsheetId);
  }, [params.id, params.flowsheetId, loadFlowsheet, setProject]);

  return (
    <PageShell>
      <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-2 print:hidden">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold">{projectName ?? 'Loading…'}</h1>
          <ProjectEditorTabs projectId={params.id} flowsheetId={params.flowsheetId} />
        </div>
        <div className="flex items-center gap-2">
          {/* Save BoQ + Generate PDF buttons go here in Task 11 */}
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-6 py-8 print:px-0 print:py-0 print:max-w-none">
        <ErrorBoundary>
          <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
            Proposal document — section stubs render in Task 3
          </div>
        </ErrorBoundary>
      </main>
    </PageShell>
  );
}
```

**Step 2: Web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean. Route count should now be **13** (previously 12 + the new proposal route).

**Step 3: Manual smoke test**

Start dev server, navigate to `/project/[id]/flowsheet/[fsid]`, click the Proposal tab, verify it navigates to the new route and shows the placeholder. Click Flowsheet tab, verify it navigates back.

**Step 4: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/app/project/\[id\]/proposal/\[flowsheetId\]/page.tsx && \
git commit -m "Scaffold /project/[id]/proposal/[fsid] route"
```

---

### Task 3: Delete `ResultsPanel` and clean up its references

**Files:**
- Delete: `apps/web/components/results/ResultsPanel.tsx`
- Delete: `apps/web/components/results/` (entire directory if empty)
- Modify: `apps/web/app/project/[id]/flowsheet/[flowsheetId]/page.tsx` (remove import + render)
- Modify: `apps/web/app/shared/[token]/page.tsx` (remove import; replace with minimal block)

**Step 1: Remove imports and usages from flowsheet page**

Open `flowsheet/[flowsheetId]/page.tsx`:
1. Delete the `import ResultsPanel from '@/components/results/ResultsPanel';` line
2. Delete the `<ResultsPanel />` render (usually at the bottom of the layout)
3. The tabbed bottom panel's space disappears; the canvas grows to fill it. This is the intended Phase 7 layout.

**Step 2: Remove import + usage from shared page**

Open `apps/web/app/shared/[token]/page.tsx`:
1. Delete the `ResultsPanel` import
2. Replace the `<ResultsPanel />` render with a comment or a small muted note: `<p className="text-sm text-muted-foreground text-center p-6">Shared flowsheet — run simulation locally to see results</p>`

**Step 3: Delete the component file and (if empty) the directory**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
rm apps/web/components/results/ResultsPanel.tsx && \
(rmdir apps/web/components/results 2>/dev/null || true)
```

**Step 4: Verify nothing else imports it**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
grep -rn ResultsPanel apps/web/app apps/web/components 2>&1 | grep -v .next | grep -v node_modules || echo "CLEAN"
```
Expected: `CLEAN`.

**Step 5: Web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean.

**Step 6: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add -A apps/web/components/results apps/web/app/project/\[id\]/flowsheet/\[flowsheetId\]/page.tsx apps/web/app/shared/\[token\]/page.tsx && \
git commit -m "Delete legacy ResultsPanel and clean up its import sites"
```

---

### Task 4: Create the proposal document skeleton + 11 empty section stubs

**Files:**
- Create: `apps/web/lib/proposal/ProposalDocument.tsx`
- Create: `apps/web/lib/proposal/sections/` (directory)
- Create 11 files under `sections/`: `01-cover.tsx`, `02-executive-summary.tsx`, `03-design-basis.tsx`, `04-process-description.tsx`, `05-sizing-calculations.tsx`, `06-aeration-design.tsx`, `07-energy-analysis.tsx`, `08-consumables.tsx`, `09-bill-of-quantities.tsx`, `10-effluent-compliance.tsx`, `11-disclaimer.tsx`
- Create: `apps/web/lib/proposal/sections/section-shell.tsx` (shared wrapper)
- Modify: `apps/web/app/project/[id]/proposal/[flowsheetId]/page.tsx` (render the orchestrator)

**Step 1: Create the shared section shell**

```typescript
// apps/web/lib/proposal/sections/section-shell.tsx
import { cn } from '@/lib/utils';

interface Props {
  number: number;
  title: string;
  children: React.ReactNode;
  /** Add a page-break-before in print mode. True by default except section 1. */
  pageBreak?: boolean;
  className?: string;
}

export function SectionShell({ number, title, children, pageBreak = true, className }: Props) {
  return (
    <section
      className={cn(
        'mb-10',
        pageBreak && 'print:break-before-page',
        className,
      )}
    >
      <h2 className="mb-4 flex items-baseline gap-3 border-b border-border pb-2 text-xl font-semibold text-foreground">
        <span className="font-mono text-sm text-muted-foreground">{number.toString().padStart(2, '0')}</span>
        <span>{title}</span>
      </h2>
      <div className="space-y-4 text-sm leading-relaxed text-foreground">
        {children}
      </div>
    </section>
  );
}
```

**Step 2: Create each empty section stub**

For each of the 11 sections, write a minimal component that accepts the props it will need in later tasks. Example for section 5:

```typescript
// apps/web/lib/proposal/sections/05-sizing-calculations.tsx
import type { SimulationResults } from '@repo/sim-engine';
import { SectionShell } from './section-shell';

interface Props {
  results: SimulationResults | null;
}

export function SizingCalculationsSection({ results }: Props) {
  return (
    <SectionShell number={5} title="Sizing Calculations">
      <p className="text-muted-foreground italic">Per-unit calculation records — populated in Task 8.</p>
    </SectionShell>
  );
}
```

Create all 11 stubs with appropriate prop signatures. Each exports a named component (`CoverSection`, `ExecutiveSummarySection`, `DesignBasisSection`, `ProcessDescriptionSection`, `SizingCalculationsSection`, `AerationDesignSection`, `EnergyAnalysisSection`, `ConsumablesSection`, `BillOfQuantitiesSection`, `EffluentComplianceSection`, `DisclaimerSection`).

**Step 3: Create the `ProposalDocument` orchestrator**

```typescript
// apps/web/lib/proposal/ProposalDocument.tsx
'use client';

import type { SimulationResults, AggregatedBoQ, WaterQuality } from '@repo/sim-engine';
import type { DwaDischargeStandard } from '@repo/design-library';

import { CoverSection } from './sections/01-cover';
import { ExecutiveSummarySection } from './sections/02-executive-summary';
import { DesignBasisSection } from './sections/03-design-basis';
import { ProcessDescriptionSection } from './sections/04-process-description';
import { SizingCalculationsSection } from './sections/05-sizing-calculations';
import { AerationDesignSection } from './sections/06-aeration-design';
import { EnergyAnalysisSection } from './sections/07-energy-analysis';
import { ConsumablesSection } from './sections/08-consumables';
import { BillOfQuantitiesSection } from './sections/09-bill-of-quantities';
import { EffluentComplianceSection } from './sections/10-effluent-compliance';
import { DisclaimerSection } from './sections/11-disclaimer';

export interface ProposalData {
  client?: { name?: string; project_code?: string; location?: string };
  designer?: { name?: string; title?: string; date?: string };
  executive_summary?: string;
  disclaimer?: string;
}

export interface ProposalProfile {
  full_name: string | null;
  company: string | null;
  company_logo_url: string | null;
  designer_title: string | null;
}

interface Props {
  proposalData: ProposalData;
  onChange: (data: ProposalData) => void;
  profile: ProposalProfile;
  results: SimulationResults | null;
  boq: AggregatedBoQ | null;
  effluentStream: WaterQuality | null;
  dischargeStandard: DwaDischargeStandard;
  flowsheetName: string;
  projectName: string;
}

export function ProposalDocument(props: Props) {
  const { proposalData, onChange, profile, results, boq, effluentStream, dischargeStandard, flowsheetName, projectName } = props;

  return (
    <article className="proposal-document bg-background text-foreground print:text-black print:bg-white">
      <CoverSection
        client={proposalData.client}
        designer={proposalData.designer}
        profile={profile}
        projectName={projectName}
        flowsheetName={flowsheetName}
        onChange={(client) => onChange({ ...proposalData, client })}
        onDesignerChange={(designer) => onChange({ ...proposalData, designer })}
      />
      <ExecutiveSummarySection
        narrative={proposalData.executive_summary ?? ''}
        onChange={(narrative) => onChange({ ...proposalData, executive_summary: narrative })}
        boq={boq}
        results={results}
      />
      <DesignBasisSection results={results} dischargeStandard={dischargeStandard} />
      <ProcessDescriptionSection />
      <SizingCalculationsSection results={results} />
      <AerationDesignSection results={results} />
      <EnergyAnalysisSection results={results} />
      <ConsumablesSection results={results} />
      <BillOfQuantitiesSection boq={boq} />
      <EffluentComplianceSection effluentStream={effluentStream} dischargeStandard={dischargeStandard} />
      <DisclaimerSection
        text={proposalData.disclaimer ?? DEFAULT_DISCLAIMER}
        onChange={(disclaimer) => onChange({ ...proposalData, disclaimer })}
      />
    </article>
  );
}

const DEFAULT_DISCLAIMER = `This design report is a preliminary engineering estimate produced by AquaSim v2. Final sizing, procurement, and construction must be confirmed by a registered professional engineer. Supplier prices are indicative and subject to quotation at the time of procurement.`;
```

**Step 4: Render a placeholder `<ProposalDocument>` in the page**

Replace the "section stubs render in Task 3" placeholder in `page.tsx` with a call to `<ProposalDocument>`. For this task, pass stub data:

```tsx
<ProposalDocument
  proposalData={{}}
  onChange={() => {}}
  profile={{ full_name: null, company: null, company_logo_url: null, designer_title: null }}
  results={null}
  boq={null}
  effluentStream={null}
  dischargeStandard={/* DWA_LIMITS.General */}
  flowsheetName="Untitled"
  projectName="Untitled"
/>
```

Import `DWA_LIMITS` from `@repo/design-library` for the default discharge standard.

**Step 5: Web build + visit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean.

Manual: visit `/project/[id]/proposal/[fsid]`, confirm all 11 section headers appear numbered `01` through `11` with the placeholder text under each.

**Step 6: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/lib/proposal/ apps/web/app/project/\[id\]/proposal/ && \
git commit -m "Add ProposalDocument skeleton with 11 empty section stubs"
```

---

### Task 5: Create the `useProposalData` hook

**Files:**
- Create: `apps/web/lib/proposal/use-proposal-data.ts`

**Context:** One hook that loads + wires together everything the proposal document needs: proposal metadata from `flowsheets.proposal_data`, profile branding from `profiles`, live nodeResults from the simulation store, aggregated BoQ, final effluent stream, and the selected DWA discharge standard. Returns a tuple `[data, setData]` where calling `setData` writes to both local state AND (debounced) Supabase.

**Step 1: Write the hook**

```typescript
// apps/web/lib/proposal/use-proposal-data.ts
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { aggregateBoQ, type AggregatedBoQ, type FlowsheetNodeLite, type WaterQuality } from '@repo/sim-engine';
import { DWA_LIMITS, getDwaLimits, type DwaDischargeStandard } from '@repo/design-library';
import { createClient } from '@/lib/supabase/client';
import { useFlowsheetStore } from '@/stores/flowsheet-store';
import { useSimulationStore } from '@/stores/simulation-store';
import { useProjectStore } from '@/stores/project-store';
import type { ProposalData, ProposalProfile } from './ProposalDocument';

interface UseProposalDataResult {
  proposalData: ProposalData;
  setProposalData: (data: ProposalData) => void;
  profile: ProposalProfile;
  boq: AggregatedBoQ | null;
  effluentStream: WaterQuality | null;
  dischargeStandard: DwaDischargeStandard;
  loading: boolean;
  error: string | null;
}

const DEBOUNCE_MS = 1000;

export function useProposalData(flowsheetId: string): UseProposalDataResult {
  const supabase = useMemo(() => createClient(), []);
  const nodes = useFlowsheetStore((s) => s.nodes);
  const results = useSimulationStore((s) => s.results);

  const [proposalData, setProposalDataLocal] = useState<ProposalData>({});
  const [profile, setProfile] = useState<ProposalProfile>({
    full_name: null,
    company: null,
    company_logo_url: null,
    designer_title: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load proposal_data and profile once on mount / flowsheetId change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [{ data: fs, error: fsErr }, { data: { user } }] = await Promise.all([
          supabase.from('flowsheets').select('proposal_data').eq('id', flowsheetId).single(),
          supabase.auth.getUser(),
        ]);
        if (fsErr) throw fsErr;
        if (cancelled) return;
        if (fs?.proposal_data) setProposalDataLocal(fs.proposal_data as ProposalData);

        if (user) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('full_name, company, company_logo_url, designer_title')
            .eq('id', user.id)
            .single();
          if (!cancelled && prof) setProfile(prof);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load proposal data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [flowsheetId, supabase]);

  // Debounced save back to flowsheets.proposal_data
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setProposalData = useCallback((next: ProposalData) => {
    setProposalDataLocal(next);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const { error: updErr } = await supabase
        .from('flowsheets')
        .update({ proposal_data: next })
        .eq('id', flowsheetId);
      if (updErr) setError(updErr.message);
    }, DEBOUNCE_MS);
  }, [flowsheetId, supabase]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Aggregate BoQ from live nodes + results
  const boq = useMemo<AggregatedBoQ | null>(() => {
    if (!results) return null;
    const nodeList: FlowsheetNodeLite[] = nodes.map((n) => ({
      id: n.id,
      type: n.data.unitType,
      parameters: n.data.parameters ?? {},
    }));
    return aggregateBoQ(nodeList, results.nodeResults);
  }, [nodes, results]);

  // Extract the final effluent stream for the compliance section.
  // Strategy: find the node with type 'effluent' and read its primary output.
  const effluentStream = useMemo<WaterQuality | null>(() => {
    if (!results) return null;
    const effNode = nodes.find((n) => n.data.unitType === 'effluent');
    if (!effNode) return null;
    const nr = results.nodeResults[effNode.id];
    if (!nr) return null;
    const first = Object.values(nr.outputs)[0];
    return (first as WaterQuality) ?? null;
  }, [nodes, results]);

  // Discharge standard: read from the flowsheet's discharge_standards or default to General
  const dischargeStandard = useMemo(() => getDwaLimits('General'), []);

  return {
    proposalData,
    setProposalData,
    profile,
    boq,
    effluentStream,
    dischargeStandard,
    loading,
    error,
  };
}
```

> **Note on `discharge_standards`:** The existing `flowsheets.discharge_standards` column holds a loose `{COD, BOD5, NH3N, ...}` jsonb. Phase 7 doesn't unify it with `DWA_LIMITS` — the proposal view just defaults to `General`. A later phase can add a tier selector. Document this in the completion summary.

**Step 2: Wire the hook into the proposal page**

```typescript
// apps/web/app/project/[id]/proposal/[flowsheetId]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { ProjectEditorTabs } from '@/components/layout/project-editor-tabs';
import { PageShell } from '@/components/layout/page-shell';
import { useProjectStore } from '@/stores/project-store';
import { useSimulationStore } from '@/stores/simulation-store';
import { useFlowsheetStore } from '@/stores/flowsheet-store';
import { ErrorBoundary } from '@/components/error-boundary';
import { ProposalDocument } from '@/lib/proposal/ProposalDocument';
import { useProposalData } from '@/lib/proposal/use-proposal-data';

export default function ProposalPage() {
  const params = useParams<{ id: string; flowsheetId: string }>();
  const { projectName, flowsheetName, setProject, loadFlowsheet } = useProjectStore();
  const results = useSimulationStore((s) => s.results);
  const nodes = useFlowsheetStore((s) => s.nodes);

  useEffect(() => {
    setProject(params.id);
    loadFlowsheet(params.flowsheetId);
  }, [params.id, params.flowsheetId, setProject, loadFlowsheet]);

  const { proposalData, setProposalData, profile, boq, effluentStream, dischargeStandard, loading, error } =
    useProposalData(params.flowsheetId);

  return (
    <PageShell>
      <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-2 print:hidden">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold">{projectName ?? 'Loading…'}</h1>
          <ProjectEditorTabs projectId={params.id} flowsheetId={params.flowsheetId} />
        </div>
        <div className="flex items-center gap-2">
          {/* Save BoQ + Generate PDF buttons — Task 11 */}
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-6 py-8 print:px-0 print:py-0 print:max-w-none">
        <ErrorBoundary>
          {error && (
            <div className="mb-6 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive print:hidden">
              {error}
            </div>
          )}
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading proposal…</div>
          ) : (
            <ProposalDocument
              proposalData={proposalData}
              onChange={setProposalData}
              profile={profile}
              results={results}
              boq={boq}
              effluentStream={effluentStream}
              dischargeStandard={dischargeStandard}
              flowsheetName={flowsheetName ?? 'Untitled flowsheet'}
              projectName={projectName ?? 'Untitled project'}
            />
          )}
        </ErrorBoundary>
      </main>
    </PageShell>
  );
}
```

**Step 3: Web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean.

**Step 4: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/lib/proposal/use-proposal-data.ts \
        apps/web/app/project/\[id\]/proposal/\[flowsheetId\]/page.tsx && \
git commit -m "Add useProposalData hook — loads + debounced-persists proposal metadata"
```

---

### Task 6: Implement sections 1–2 (Cover + Executive Summary)

**Files:**
- Modify: `apps/web/lib/proposal/sections/01-cover.tsx`
- Modify: `apps/web/lib/proposal/sections/02-executive-summary.tsx`

**Context:** Cover page is edit-in-place (client name, project code, location, date, designer name — fields are `<input>`s styled to blend into the document). Executive summary has both an auto-generated bullet list (grand total ZAR, installed kW, unit count) and a free-text `<textarea>` narrative.

**Step 1: Cover section**

```typescript
// apps/web/lib/proposal/sections/01-cover.tsx
import { cn } from '@/lib/utils';
import type { ProposalProfile, ProposalData } from '../ProposalDocument';

interface Props {
  client?: ProposalData['client'];
  designer?: ProposalData['designer'];
  profile: ProposalProfile;
  projectName: string;
  flowsheetName: string;
  onChange: (client: ProposalData['client']) => void;
  onDesignerChange: (designer: ProposalData['designer']) => void;
}

export function CoverSection(props: Props) {
  const { client, designer, profile, projectName, flowsheetName, onChange, onDesignerChange } = props;
  const today = new Date().toISOString().split('T')[0];

  return (
    <section className="mb-10 print:h-[90vh] flex flex-col justify-between">
      <div>
        {profile.company_logo_url && (
          <img src={profile.company_logo_url} alt={profile.company ?? ''} className="h-12 mb-8" />
        )}
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
          Wastewater Treatment Plant Design
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          <EditableSpan
            value={client?.name ?? ''}
            placeholder="[ Client name ]"
            onChange={(v) => onChange({ ...client, name: v })}
          />
        </h1>
        <div className="mt-2 text-lg text-muted-foreground">
          <EditableSpan
            value={client?.project_code ?? ''}
            placeholder="[ Project code ]"
            onChange={(v) => onChange({ ...client, project_code: v })}
          />
          {' — '}
          <EditableSpan
            value={client?.location ?? ''}
            placeholder="[ Location ]"
            onChange={(v) => onChange({ ...client, location: v })}
          />
        </div>
        <div className="mt-1 text-sm text-muted-foreground italic">
          {projectName} / {flowsheetName}
        </div>
      </div>

      <div className="text-sm text-muted-foreground border-t border-border pt-4 mt-8">
        <div>
          Prepared by{' '}
          <EditableSpan
            value={designer?.name ?? profile.full_name ?? ''}
            placeholder="[ Designer name ]"
            onChange={(v) => onDesignerChange({ ...designer, name: v })}
            className="text-foreground"
          />
          {(designer?.title || profile.designer_title) && (
            <>
              {', '}
              <span>{designer?.title ?? profile.designer_title}</span>
            </>
          )}
        </div>
        {profile.company && <div>{profile.company}</div>}
        <div className="mt-1">
          <EditableSpan
            value={designer?.date ?? today}
            placeholder={today}
            onChange={(v) => onDesignerChange({ ...designer, date: v })}
          />
        </div>
      </div>
    </section>
  );
}

function EditableSpan({ value, placeholder, onChange, className }: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => onChange(e.currentTarget.textContent ?? '')}
      className={cn(
        'outline-none focus:bg-accent/40 rounded px-0.5',
        !value && 'text-muted-foreground/60',
        className,
      )}
      data-placeholder={placeholder}
    >
      {value || placeholder}
    </span>
  );
}
```

**Step 2: Executive Summary section**

```typescript
// apps/web/lib/proposal/sections/02-executive-summary.tsx
import type { SimulationResults, AggregatedBoQ } from '@repo/sim-engine';
import { SectionShell } from './section-shell';

interface Props {
  narrative: string;
  onChange: (narrative: string) => void;
  boq: AggregatedBoQ | null;
  results: SimulationResults | null;
}

export function ExecutiveSummarySection({ narrative, onChange, boq, results }: Props) {
  // Auto-derived headline numbers
  const unitCount = results ? Object.keys(results.nodeResults).length : 0;
  const installedKW = results
    ? Object.values(results.nodeResults).reduce(
        (sum, r) => sum + (r.energy?.installedKW ?? 0),
        0,
      )
    : 0;
  const grandTotal = boq?.grandTotal ?? 0;
  const civilSubtotal = boq?.subtotalsByCategory.civil ?? 0;
  const mechSubtotal = boq?.subtotalsByCategory.mechanical ?? 0;

  return (
    <SectionShell number={2} title="Executive Summary">
      {/* Headline stats */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border border-border rounded-md p-4 bg-muted/20 font-mono text-sm">
        <div className="flex justify-between col-span-2 md:col-span-1">
          <dt className="text-muted-foreground">Process units</dt>
          <dd className="text-foreground">{unitCount}</dd>
        </div>
        <div className="flex justify-between col-span-2 md:col-span-1">
          <dt className="text-muted-foreground">Installed power</dt>
          <dd className="text-foreground">{installedKW.toFixed(1)} kW</dd>
        </div>
        <div className="flex justify-between col-span-2 md:col-span-1">
          <dt className="text-muted-foreground">Civil works</dt>
          <dd className="text-foreground">R{civilSubtotal.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</dd>
        </div>
        <div className="flex justify-between col-span-2 md:col-span-1">
          <dt className="text-muted-foreground">Mech & elec</dt>
          <dd className="text-foreground">R{mechSubtotal.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</dd>
        </div>
        <div className="flex justify-between col-span-2 border-t border-border pt-2 mt-1">
          <dt className="text-foreground font-semibold">Total CapEx</dt>
          <dd className="text-foreground font-semibold">R{grandTotal.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</dd>
        </div>
      </dl>

      {/* Editable narrative */}
      <div>
        <label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1 print:hidden">
          Narrative
        </label>
        <textarea
          value={narrative}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Provide a brief project overview, key design drivers, and expected outcomes…"
          className="w-full min-h-[120px] rounded-md border border-border bg-card/50 p-3 text-sm leading-relaxed text-foreground resize-y print:border-0 print:bg-transparent print:p-0 print:resize-none focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    </SectionShell>
  );
}
```

**Step 3: Web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean.

**Step 4: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/lib/proposal/sections/01-cover.tsx apps/web/lib/proposal/sections/02-executive-summary.tsx && \
git commit -m "Proposal sections 1-2: Cover + Executive Summary"
```

---

### Task 7: Implement sections 3–4 (Design Basis + Process Description)

**Files:**
- Modify: `apps/web/lib/proposal/sections/03-design-basis.tsx`
- Modify: `apps/web/lib/proposal/sections/04-process-description.tsx`
- Create: `apps/web/lib/proposal/FlowsheetFigure.tsx` (read-only React Flow render)

**Step 1: Design Basis section**

Pull flows from the Influent unit's parameters, list effluent targets from the DWA standard, show a small table.

```typescript
// apps/web/lib/proposal/sections/03-design-basis.tsx
import type { SimulationResults } from '@repo/sim-engine';
import type { DwaDischargeStandard } from '@repo/design-library';
import { useFlowsheetStore } from '@/stores/flowsheet-store';
import { SectionShell } from './section-shell';

interface Props {
  results: SimulationResults | null;
  dischargeStandard: DwaDischargeStandard;
}

export function DesignBasisSection({ results, dischargeStandard }: Props) {
  const nodes = useFlowsheetStore((s) => s.nodes);
  const influent = nodes.find((n) => n.data.unitType === 'influent');
  const params = influent?.data.parameters ?? {};

  return (
    <SectionShell number={3} title="Design Basis">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Design flows</h3>
          <dl className="space-y-1 text-sm font-mono">
            <Row label="ADWF" value={params.flow ?? '—'} unit="m³/d" />
            <Row label="COD" value={params.COD ?? '—'} unit="mg/L" />
            <Row label="TKN" value={params.TKN ?? '—'} unit="mgN/L" />
            <Row label="TP" value={params.TP ?? '—'} unit="mgP/L" />
            <Row label="TSS" value={params.TSS ?? '—'} unit="mg/L" />
          </dl>
        </div>
        <div>
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Effluent targets (DWA)</h3>
          <dl className="space-y-1 text-sm font-mono">
            {dischargeStandard.COD !== undefined && <Row label="COD" value={dischargeStandard.COD} unit="mg/L" />}
            {dischargeStandard.NH3N !== undefined && <Row label="NH₃-N" value={dischargeStandard.NH3N} unit="mgN/L" />}
            {dischargeStandard.NO3N !== undefined && <Row label="NO₃-N" value={dischargeStandard.NO3N} unit="mgN/L" />}
            {dischargeStandard.TSS !== undefined && <Row label="TSS" value={dischargeStandard.TSS} unit="mg/L" />}
            {dischargeStandard.TP !== undefined && <Row label="TP" value={dischargeStandard.TP} unit="mgP/L" />}
          </dl>
          <p className="mt-2 text-[11px] text-muted-foreground italic">{dischargeStandard.source}</p>
        </div>
      </div>
    </SectionShell>
  );
}

function Row({ label, value, unit }: { label: string; value: number | string; unit: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">
        {typeof value === 'number' ? value.toFixed(value >= 100 ? 0 : 1) : value}
        <span className="ml-1 text-muted-foreground/80">{unit}</span>
      </dd>
    </div>
  );
}
```

**Step 2: `FlowsheetFigure` (read-only React Flow)**

```typescript
// apps/web/lib/proposal/FlowsheetFigure.tsx
'use client';

import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant } from '@xyflow/react';
import { useFlowsheetStore } from '@/stores/flowsheet-store';
import { nodeTypes } from '@/components/canvas/node-types';  // or whatever the flowsheet canvas uses

export function FlowsheetFigure() {
  const nodes = useFlowsheetStore((s) => s.nodes);
  const edges = useFlowsheetStore((s) => s.edges);

  return (
    <ReactFlowProvider>
      <div className="h-80 print:h-[14cm] w-full rounded-md border border-border bg-card/30 print:border-border/60">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            color="hsl(var(--muted-foreground) / 0.15)"
            gap={20}
            size={1}
            variant={BackgroundVariant.Dots}
          />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}
```

> If `@/components/canvas/node-types` doesn't exist as an export — the existing `Canvas.tsx` probably defines `nodeTypes` inline — then export it from there or duplicate the small map here.

**Step 3: Process Description section**

```typescript
// apps/web/lib/proposal/sections/04-process-description.tsx
import { useFlowsheetStore } from '@/stores/flowsheet-store';
import { unitDefinitions } from '@repo/sim-engine';
import { SectionShell } from './section-shell';
import { FlowsheetFigure } from '../FlowsheetFigure';

export function ProcessDescriptionSection() {
  const nodes = useFlowsheetStore((s) => s.nodes);

  // Unique unit types in the flowsheet
  const uniqueTypes = Array.from(new Set(nodes.map((n) => n.data.unitType)));

  return (
    <SectionShell number={4} title="Process Description">
      <FlowsheetFigure />
      <p className="text-sm text-muted-foreground italic">
        Figure 1. Plant process flow diagram. {nodes.length} process units in series.
      </p>

      <h3 className="text-xs uppercase tracking-wide text-muted-foreground mt-6 mb-2">Unit descriptions</h3>
      <dl className="space-y-3">
        {uniqueTypes.map((type) => {
          const def = unitDefinitions[type];
          if (!def) return null;
          return (
            <div key={type} className="text-sm">
              <dt className="font-medium text-foreground">{def.label}</dt>
              <dd className="text-muted-foreground">{def.description}</dd>
            </div>
          );
        })}
      </dl>
    </SectionShell>
  );
}
```

**Step 4: Web build + smoke test**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean.

**Step 5: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/lib/proposal/sections/03-design-basis.tsx \
        apps/web/lib/proposal/sections/04-process-description.tsx \
        apps/web/lib/proposal/FlowsheetFigure.tsx && \
git commit -m "Proposal sections 3-4: Design Basis + Process Description"
```

---

### Task 8: Implement sections 5–6 (Sizing Calculations + Aeration Design)

**Files:**
- Modify: `apps/web/lib/proposal/sections/05-sizing-calculations.tsx`
- Modify: `apps/web/lib/proposal/sections/06-aeration-design.tsx`

**Step 1: Sizing Calculations section**

Groups calculation records by unit. Reuses Phase 6 `CalculationRecordCard`.

```typescript
// apps/web/lib/proposal/sections/05-sizing-calculations.tsx
import type { SimulationResults } from '@repo/sim-engine';
import { unitDefinitions } from '@repo/sim-engine';
import { useFlowsheetStore } from '@/stores/flowsheet-store';
import { CalculationRecordCard } from '@/components/inspector/CalculationRecordCard';
import { SectionShell } from './section-shell';

interface Props { results: SimulationResults | null }

export function SizingCalculationsSection({ results }: Props) {
  const nodes = useFlowsheetStore((s) => s.nodes);

  if (!results) {
    return (
      <SectionShell number={5} title="Sizing Calculations">
        <p className="text-muted-foreground italic">Run the simulation to populate sizing calculations.</p>
      </SectionShell>
    );
  }

  return (
    <SectionShell number={5} title="Sizing Calculations">
      <div className="space-y-6 print:space-y-4">
        {nodes.map((node) => {
          const nr = results.nodeResults[node.id];
          if (!nr || !nr.calculationRecords || nr.calculationRecords.length === 0) return null;
          const def = unitDefinitions[node.data.unitType];
          return (
            <div key={node.id} className="print:break-inside-avoid">
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                {node.data.label}
                {def && <span className="ml-2 font-normal text-muted-foreground">({def.label})</span>}
              </h3>
              <div className="space-y-1.5">
                {nr.calculationRecords.map((r, i) => (
                  <CalculationRecordCard key={i} record={r} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}
```

**Step 2: Aeration Design section**

Pulls together the aerobic bioreactor's O₂ demand records + the standalone AerationBlower's sizing + diffuser count from the aerobic reactor's BoQ.

```typescript
// apps/web/lib/proposal/sections/06-aeration-design.tsx
import type { SimulationResults } from '@repo/sim-engine';
import { useFlowsheetStore } from '@/stores/flowsheet-store';
import { CalculationRecordCard } from '@/components/inspector/CalculationRecordCard';
import { SectionShell } from './section-shell';

interface Props { results: SimulationResults | null }

export function AerationDesignSection({ results }: Props) {
  const nodes = useFlowsheetStore((s) => s.nodes);

  const aerobicNode = nodes.find((n) => n.data.unitType === 'bioreactor_aerobic');
  const blowerNode = nodes.find((n) => n.data.unitType === 'aeration_blower');

  const aerobicResult = aerobicNode && results ? results.nodeResults[aerobicNode.id] : null;
  const blowerResult = blowerNode && results ? results.nodeResults[blowerNode.id] : null;

  if (!aerobicResult && !blowerResult) {
    return (
      <SectionShell number={6} title="Aeration Design">
        <p className="text-muted-foreground italic">No aeration units in this flowsheet.</p>
      </SectionShell>
    );
  }

  return (
    <SectionShell number={6} title="Aeration Design">
      {aerobicResult?.energy?.records && aerobicResult.energy.records.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Oxygen demand</h3>
          {aerobicResult.energy.records.map((r, i) => (
            <CalculationRecordCard key={i} record={r} />
          ))}
        </div>
      )}
      {blowerResult && (
        <div className="space-y-1.5">
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground mt-4 mb-2">
            Blower sizing (installed: {(blowerResult.energy?.installedKW ?? 0).toFixed(1)} kW)
          </h3>
          {(blowerResult.calculationRecords ?? []).map((r, i) => (
            <CalculationRecordCard key={i} record={r} />
          ))}
        </div>
      )}
    </SectionShell>
  );
}
```

**Step 3: Web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean.

**Step 4: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/lib/proposal/sections/05-sizing-calculations.tsx apps/web/lib/proposal/sections/06-aeration-design.tsx && \
git commit -m "Proposal sections 5-6: Sizing Calculations + Aeration Design"
```

---

### Task 9: Implement sections 7–8 (Energy Analysis + Consumables)

**Files:**
- Modify: `apps/web/lib/proposal/sections/07-energy-analysis.tsx`
- Modify: `apps/web/lib/proposal/sections/08-consumables.tsx`

**Step 1: Energy Analysis section**

Total installed kW + total kWh/d + annual cost estimate (use a user-editable cost per kWh, default R2.20).

```typescript
// apps/web/lib/proposal/sections/07-energy-analysis.tsx
import type { SimulationResults } from '@repo/sim-engine';
import { useFlowsheetStore } from '@/stores/flowsheet-store';
import { SectionShell } from './section-shell';

interface Props { results: SimulationResults | null }

// Default SA industrial tariff — rough estimate, engineer should override
const ZAR_PER_KWH = 2.20;

export function EnergyAnalysisSection({ results }: Props) {
  const nodes = useFlowsheetStore((s) => s.nodes);

  if (!results) {
    return (
      <SectionShell number={7} title="Energy Analysis">
        <p className="text-muted-foreground italic">Run the simulation to populate energy summary.</p>
      </SectionShell>
    );
  }

  const rows = nodes
    .map((n) => {
      const nr = results.nodeResults[n.id];
      const kw = nr?.energy?.installedKW ?? 0;
      const kwhd = nr?.energy?.dailyKWh ?? 0;
      return { id: n.id, label: n.data.label, kw, kwhd };
    })
    .filter((r) => r.kw > 0 || r.kwhd > 0);

  const totalKW = rows.reduce((s, r) => s + r.kw, 0);
  const totalKWhD = rows.reduce((s, r) => s + r.kwhd, 0);
  const annualKWh = totalKWhD * 365;
  const annualCost = annualKWh * ZAR_PER_KWH;

  return (
    <SectionShell number={7} title="Energy Analysis">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground text-left">
            <th className="pb-2">Unit</th>
            <th className="pb-2 text-right">Installed kW</th>
            <th className="pb-2 text-right">kWh/day</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/50">
              <td className="py-1.5 font-sans text-foreground">{r.label}</td>
              <td className="py-1.5 text-right text-foreground">{r.kw.toFixed(1)}</td>
              <td className="py-1.5 text-right text-foreground">{r.kwhd.toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-border font-semibold">
          <tr>
            <td className="py-2 text-foreground">Total</td>
            <td className="py-2 text-right font-mono text-foreground">{totalKW.toFixed(1)}</td>
            <td className="py-2 text-right font-mono text-foreground">{totalKWhD.toFixed(0)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-4 rounded-md border border-border bg-muted/20 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Annual energy consumption</span>
          <span className="font-mono text-foreground">{annualKWh.toLocaleString('en-ZA', { maximumFractionDigits: 0 })} kWh/year</span>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-muted-foreground">Annual cost @ R{ZAR_PER_KWH.toFixed(2)}/kWh</span>
          <span className="font-mono text-foreground">R{annualCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</span>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground italic mt-1">
        Tariff is an indicative SA industrial rate; adjust for the specific site.
      </p>
    </SectionShell>
  );
}
```

**Step 2: Consumables section**

Aggregate across all nodes with non-empty `consumables`.

```typescript
// apps/web/lib/proposal/sections/08-consumables.tsx
import type { SimulationResults } from '@repo/sim-engine';
import { useFlowsheetStore } from '@/stores/flowsheet-store';
import { SectionShell } from './section-shell';

interface Props { results: SimulationResults | null }

interface AggregatedConsumable {
  item: string;
  daily: number;
  unit: string;
  citation: string;
  sourceNodeLabels: string[];
}

export function ConsumablesSection({ results }: Props) {
  const nodes = useFlowsheetStore((s) => s.nodes);

  if (!results) {
    return (
      <SectionShell number={8} title="Consumables">
        <p className="text-muted-foreground italic">Run the simulation to populate consumables.</p>
      </SectionShell>
    );
  }

  // Merge consumables by (item, unit) key
  const agg = new Map<string, AggregatedConsumable>();
  for (const n of nodes) {
    const nr = results.nodeResults[n.id];
    for (const c of nr?.consumables ?? []) {
      const key = `${c.item}::${c.unit}`;
      const existing = agg.get(key);
      if (existing) {
        existing.daily += c.daily;
        existing.sourceNodeLabels.push(n.data.label);
      } else {
        agg.set(key, {
          item: c.item,
          daily: c.daily,
          unit: c.unit,
          citation: c.citation,
          sourceNodeLabels: [n.data.label],
        });
      }
    }
  }

  const rows = Array.from(agg.values());

  if (rows.length === 0) {
    return (
      <SectionShell number={8} title="Consumables">
        <p className="text-muted-foreground italic">No consumables in this flowsheet.</p>
      </SectionShell>
    );
  }

  return (
    <SectionShell number={8} title="Consumables">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground text-left">
            <th className="pb-2">Item</th>
            <th className="pb-2 text-right">Daily</th>
            <th className="pb-2 text-right">Annual</th>
            <th className="pb-2">Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/50 align-top">
              <td className="py-1.5 text-foreground">{r.item}</td>
              <td className="py-1.5 text-right font-mono text-foreground">
                {r.daily.toFixed(2)} <span className="text-muted-foreground/80">{r.unit}</span>
              </td>
              <td className="py-1.5 text-right font-mono text-foreground">
                {(r.daily * 365).toFixed(0)} <span className="text-muted-foreground/80">{r.unit.replace('/d', '/yr').replace('day', 'year')}</span>
              </td>
              <td className="py-1.5 text-xs text-muted-foreground italic">{r.citation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionShell>
  );
}
```

**Step 3: Web build + commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean.

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/lib/proposal/sections/07-energy-analysis.tsx apps/web/lib/proposal/sections/08-consumables.tsx && \
git commit -m "Proposal sections 7-8: Energy Analysis + Consumables"
```

---

### Task 10: Implement sections 9–10 (Bill of Quantities + Effluent Compliance)

**Files:**
- Modify: `apps/web/lib/proposal/sections/09-bill-of-quantities.tsx`
- Modify: `apps/web/lib/proposal/sections/10-effluent-compliance.tsx`

**Step 1: Bill of Quantities section**

```typescript
// apps/web/lib/proposal/sections/09-bill-of-quantities.tsx
import type { AggregatedBoQ } from '@repo/sim-engine';
import { BOQ_CATEGORIES } from '@repo/sim-engine';
import { SectionShell } from './section-shell';

interface Props { boq: AggregatedBoQ | null }

const CATEGORY_LABEL: Record<string, string> = {
  civil: 'Civil Works',
  mechanical: 'Mechanical',
  electrical: 'Electrical',
  chemicals: 'Chemicals & Consumables',
  instrumentation: 'Instrumentation',
};

export function BillOfQuantitiesSection({ boq }: Props) {
  if (!boq || boq.grandTotal === 0) {
    return (
      <SectionShell number={9} title="Bill of Quantities">
        <p className="text-muted-foreground italic">Run the simulation to populate the Bill of Quantities.</p>
      </SectionShell>
    );
  }

  return (
    <SectionShell number={9} title="Bill of Quantities">
      {BOQ_CATEGORIES.map((category) => {
        const items = boq.lineItemsByCategory[category];
        if (items.length === 0) return null;
        const subtotal = boq.subtotalsByCategory[category];
        return (
          <div key={category} className="print:break-inside-avoid mb-4">
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              {CATEGORY_LABEL[category] ?? category}
            </h3>
            <table className="w-full text-sm border-collapse">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border text-left">
                  <th className="pb-1.5 w-[45%]">Description</th>
                  <th className="pb-1.5 text-right">Qty</th>
                  <th className="pb-1.5 text-right">Unit price (ZAR)</th>
                  <th className="pb-1.5 text-right">Total (ZAR)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b border-border/40 align-top">
                    <td className="py-1.5">
                      <div className="text-foreground">{item.description}</div>
                      <div className="text-[11px] text-muted-foreground italic">{item.sourceCitation}</div>
                    </td>
                    <td className="py-1.5 text-right font-mono text-foreground whitespace-nowrap">
                      {item.quantity.toFixed(item.quantity >= 10 ? 0 : 1)} {item.unit}
                    </td>
                    <td className="py-1.5 text-right font-mono text-foreground whitespace-nowrap">
                      {item.unitPriceZar.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-1.5 text-right font-mono text-foreground whitespace-nowrap">
                      {(item.quantity * item.unitPriceZar).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-semibold">
                  <td colSpan={3} className="py-2 text-right text-muted-foreground">Subtotal</td>
                  <td className="py-2 text-right font-mono text-foreground">
                    R{subtotal.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })}

      <div className="mt-6 rounded-md border-2 border-border bg-muted/20 px-4 py-3 flex items-baseline justify-between print:break-inside-avoid">
        <span className="text-base font-semibold text-foreground">Grand total CapEx</span>
        <span className="font-mono text-lg font-semibold text-foreground">
          R{boq.grandTotal.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground italic mt-1">
        Prices are indicative. Obtain formal supplier quotes before procurement.
      </p>
    </SectionShell>
  );
}
```

**Step 2: Effluent Compliance section**

```typescript
// apps/web/lib/proposal/sections/10-effluent-compliance.tsx
import type { WaterQuality } from '@repo/sim-engine';
import type { DwaDischargeStandard } from '@repo/design-library';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { SectionShell } from './section-shell';

interface Props {
  effluentStream: WaterQuality | null;
  dischargeStandard: DwaDischargeStandard;
}

interface Row {
  label: string;
  value: number | undefined;
  limit: number | undefined;
  unit: string;
}

export function EffluentComplianceSection({ effluentStream, dischargeStandard }: Props) {
  if (!effluentStream) {
    return (
      <SectionShell number={10} title="Effluent Compliance">
        <p className="text-muted-foreground italic">Add an Effluent unit and run the simulation.</p>
      </SectionShell>
    );
  }

  const rows: Row[] = [
    { label: 'COD', value: effluentStream.COD, limit: dischargeStandard.COD, unit: 'mg/L' },
    { label: 'BOD₅', value: effluentStream.BOD5, limit: dischargeStandard.BOD5, unit: 'mg/L' },
    { label: 'NH₃-N', value: effluentStream.NH3N, limit: dischargeStandard.NH3N, unit: 'mgN/L' },
    { label: 'NO₃-N', value: effluentStream.NO3N, limit: dischargeStandard.NO3N, unit: 'mgN/L' },
    { label: 'TSS', value: effluentStream.TSS, limit: dischargeStandard.TSS, unit: 'mg/L' },
    { label: 'TP', value: effluentStream.TP, limit: dischargeStandard.TP, unit: 'mgP/L' },
  ];

  const evaluated = rows.map((r) => {
    if (r.value === undefined || r.limit === undefined) return { ...r, status: 'na' as const };
    return { ...r, status: r.value <= r.limit ? ('pass' as const) : ('fail' as const) };
  });

  const failCount = evaluated.filter((r) => r.status === 'fail').length;

  return (
    <SectionShell number={10} title="Effluent Compliance">
      <div className={cn(
        'mb-3 rounded-md border p-3 text-sm',
        failCount === 0
          ? 'border-primary/40 bg-primary/10 text-foreground'
          : 'border-destructive/50 bg-destructive/10 text-destructive',
      )}>
        {failCount === 0
          ? 'Effluent meets all applicable DWA limits.'
          : `${failCount} parameter${failCount === 1 ? '' : 's'} exceed the DWA limit.`}
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground text-left">
            <th className="pb-2">Parameter</th>
            <th className="pb-2 text-right">Effluent</th>
            <th className="pb-2 text-right">DWA limit</th>
            <th className="pb-2 text-right">Status</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {evaluated.map((r) => (
            <tr key={r.label} className="border-b border-border/50">
              <td className="py-1.5 font-sans text-foreground">{r.label}</td>
              <td className="py-1.5 text-right text-foreground">
                {r.value !== undefined ? r.value.toFixed(2) : '—'}
                <span className="ml-1 text-muted-foreground/80">{r.unit}</span>
              </td>
              <td className="py-1.5 text-right text-muted-foreground">
                {r.limit !== undefined ? r.limit.toFixed(2) : '—'}
                <span className="ml-1 text-muted-foreground/80">{r.unit}</span>
              </td>
              <td className="py-1.5 text-right">
                {r.status === 'pass' && <CheckCircle2 className="inline h-4 w-4 text-primary" />}
                {r.status === 'fail' && <XCircle className="inline h-4 w-4 text-destructive" />}
                {r.status === 'na' && <MinusCircle className="inline h-4 w-4 text-muted-foreground/60" />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px] text-muted-foreground italic mt-2">{dischargeStandard.source}</p>
    </SectionShell>
  );
}
```

**Step 3: Web build + commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean.

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/lib/proposal/sections/09-bill-of-quantities.tsx apps/web/lib/proposal/sections/10-effluent-compliance.tsx && \
git commit -m "Proposal sections 9-10: Bill of Quantities + Effluent Compliance"
```

---

### Task 11: Implement section 11 (Disclaimer) + persistence + Generate PDF

**Files:**
- Modify: `apps/web/lib/proposal/sections/11-disclaimer.tsx`
- Create: `apps/web/lib/proposal/generate-proposal.ts` (helper for BoQ + proposals persistence)
- Modify: `apps/web/app/project/[id]/proposal/[flowsheetId]/page.tsx` (add buttons)

**Step 1: Disclaimer section**

```typescript
// apps/web/lib/proposal/sections/11-disclaimer.tsx
import { SectionShell } from './section-shell';

interface Props {
  text: string;
  onChange: (text: string) => void;
}

export function DisclaimerSection({ text, onChange }: Props) {
  return (
    <SectionShell number={11} title="Disclaimer">
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-h-[100px] rounded-md border border-border bg-card/50 p-3 text-sm leading-relaxed text-foreground resize-y print:border-0 print:bg-transparent print:p-0 print:resize-none focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </SectionShell>
  );
}
```

**Step 2: Create the persistence helper**

```typescript
// apps/web/lib/proposal/generate-proposal.ts
import type { AggregatedBoQ, SimulationResults, FlowsheetNodeLite } from '@repo/sim-engine';
import { aggregateBoQ } from '@repo/sim-engine';
import { createClient } from '@/lib/supabase/client';
import type { ProposalData } from './ProposalDocument';

interface SaveBoqParams {
  flowsheetId: string;
  boq: AggregatedBoQ;
}

/**
 * Replace all existing BoQ rows for the flowsheet with the current aggregation.
 * Uses delete-then-insert to keep it simple — one flowsheet has O(100) line items,
 * not worth the complexity of diffing.
 */
export async function saveBoqLineItems({ flowsheetId, boq }: SaveBoqParams) {
  const supabase = createClient();

  const { error: delErr } = await supabase
    .from('boq_line_items')
    .delete()
    .eq('flowsheet_id', flowsheetId);
  if (delErr) throw delErr;

  const rows = Object.values(boq.lineItemsByCategory).flat().map((item) => ({
    flowsheet_id: flowsheetId,
    unit_node_id: item.nodeId,
    category: item.category,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unit_price_zar: item.unitPriceZar,
    source_citation: item.sourceCitation,
    override_reason: item.overrideReason ?? null,
  }));

  if (rows.length === 0) return { count: 0 };

  const { error: insErr } = await supabase.from('boq_line_items').insert(rows);
  if (insErr) throw insErr;
  return { count: rows.length };
}

interface CreateProposalSnapshotParams {
  flowsheetId: string;
  proposalData: ProposalData;
  results: SimulationResults;
  boq: AggregatedBoQ;
  nodes: FlowsheetNodeLite[];
}

/**
 * Insert a new row into project_proposals with the next version number.
 * The table has a unique constraint on (flowsheet_id, version) — this function
 * reads the max version and increments.
 */
export async function createProposalSnapshot(params: CreateProposalSnapshotParams) {
  const supabase = createClient();
  const { flowsheetId, proposalData, results, boq, nodes } = params;

  // Find the next version number
  const { data: existing, error: qErr } = await supabase
    .from('project_proposals')
    .select('version')
    .eq('flowsheet_id', flowsheetId)
    .order('version', { ascending: false })
    .limit(1);
  if (qErr) throw qErr;

  const nextVersion = (existing?.[0]?.version ?? 0) + 1;

  const { data: { user } } = await supabase.auth.getUser();

  const snapshot = {
    proposal_data: proposalData,
    nodes,
    node_results: results.nodeResults,
    boq,
  };

  const { error: insErr } = await supabase.from('project_proposals').insert({
    flowsheet_id: flowsheetId,
    generated_by: user?.id ?? null,
    version: nextVersion,
    snapshot,
  });
  if (insErr) throw insErr;

  return { version: nextVersion };
}
```

**Step 3: Wire Save BoQ + Generate PDF buttons into the page header**

Modify `apps/web/app/project/[id]/proposal/[flowsheetId]/page.tsx`:

```tsx
'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Save, FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ProjectEditorTabs } from '@/components/layout/project-editor-tabs';
import { PageShell } from '@/components/layout/page-shell';
import { ErrorBoundary } from '@/components/error-boundary';
import { useProjectStore } from '@/stores/project-store';
import { useSimulationStore } from '@/stores/simulation-store';
import { useFlowsheetStore } from '@/stores/flowsheet-store';
import { useSubscription } from '@/lib/hooks/use-subscription';
import { ProposalDocument } from '@/lib/proposal/ProposalDocument';
import { useProposalData } from '@/lib/proposal/use-proposal-data';
import { saveBoqLineItems, createProposalSnapshot } from '@/lib/proposal/generate-proposal';

export default function ProposalPage() {
  const params = useParams<{ id: string; flowsheetId: string }>();
  const { projectName, flowsheetName, setProject, loadFlowsheet } = useProjectStore();
  const results = useSimulationStore((s) => s.results);
  const nodes = useFlowsheetStore((s) => s.nodes);
  const { limits } = useSubscription();
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setProject(params.id);
    loadFlowsheet(params.flowsheetId);
  }, [params.id, params.flowsheetId, setProject, loadFlowsheet]);

  const { proposalData, setProposalData, profile, boq, effluentStream, dischargeStandard, loading, error } =
    useProposalData(params.flowsheetId);

  const handleSaveBoq = useCallback(async () => {
    if (!boq) { toast.error('No BoQ to save — run the simulation first'); return; }
    setIsSaving(true);
    try {
      const { count } = await saveBoqLineItems({ flowsheetId: params.flowsheetId, boq });
      toast.success(`Saved ${count} BoQ line items`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save BoQ');
    } finally {
      setIsSaving(false);
    }
  }, [boq, params.flowsheetId]);

  const handleGeneratePdf = useCallback(async () => {
    if (!limits.pdfReports) {
      toast.error('PDF generation requires a Pro or Enterprise plan');
      return;
    }
    if (!results) { toast.error('Run the simulation first'); return; }
    if (!boq) { toast.error('No BoQ available — run the simulation first'); return; }

    setIsGenerating(true);
    try {
      // Save BoQ
      await saveBoqLineItems({ flowsheetId: params.flowsheetId, boq });
      // Create immutable snapshot
      const nodeList = nodes.map((n) => ({
        id: n.id,
        type: n.data.unitType,
        parameters: n.data.parameters ?? {},
      }));
      const { version } = await createProposalSnapshot({
        flowsheetId: params.flowsheetId,
        proposalData,
        results,
        boq,
        nodes: nodeList,
      });
      toast.success(`Proposal v${version} saved — opening print dialog`);
      // Small delay so the toast renders before print
      setTimeout(() => window.print(), 250);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate proposal');
    } finally {
      setIsGenerating(false);
    }
  }, [limits.pdfReports, results, boq, proposalData, nodes, params.flowsheetId]);

  return (
    <PageShell>
      <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-2 print:hidden">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold">{projectName ?? 'Loading…'}</h1>
          <ProjectEditorTabs projectId={params.id} flowsheetId={params.flowsheetId} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSaveBoq} disabled={isSaving || !boq}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span className="ml-1.5">Save BoQ</span>
          </Button>
          <Button size="sm" onClick={handleGeneratePdf} disabled={isGenerating || !results || !boq}>
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            <span className="ml-1.5">Generate PDF</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-6 py-8 print:px-0 print:py-0 print:max-w-none">
        <ErrorBoundary>
          {error && (
            <div className="mb-6 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive print:hidden">
              {error}
            </div>
          )}
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading proposal…</div>
          ) : (
            <ProposalDocument
              proposalData={proposalData}
              onChange={setProposalData}
              profile={profile}
              results={results}
              boq={boq}
              effluentStream={effluentStream}
              dischargeStandard={dischargeStandard}
              flowsheetName={flowsheetName ?? 'Untitled flowsheet'}
              projectName={projectName ?? 'Untitled project'}
            />
          )}
        </ErrorBoundary>
      </main>
    </PageShell>
  );
}
```

**Step 4: Web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean.

**Step 5: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/lib/proposal/sections/11-disclaimer.tsx \
        apps/web/lib/proposal/generate-proposal.ts \
        apps/web/app/project/\[id\]/proposal/\[flowsheetId\]/page.tsx && \
git commit -m "Proposal: Disclaimer section + Save BoQ + Generate PDF buttons"
```

---

### Task 12: Print CSS — `@media print` styling

**Files:**
- Modify: `apps/web/app/globals.css`

**Context:** Add a `@media print` block that: hides every element with `print:hidden` (Tailwind already emits this — verify), sets page margins, forces the proposal to render on a white background with dark ink, and adds a consistent header/footer on every printed page.

**Step 1: Append to `globals.css`**

Add at the bottom (after any existing `@layer` blocks):

```css
@media print {
  /* Use A4 with tight margins — engineers will re-print to fit their letterhead */
  @page {
    size: A4;
    margin: 18mm 18mm 22mm 18mm;
  }

  /* Light mode for print even if the user is in dark mode on screen */
  html, body {
    background: white !important;
    color: black !important;
  }

  /* Make sure the proposal container uses the full page width */
  .proposal-document {
    max-width: none !important;
    color: black !important;
  }

  /* Tighten typography for print */
  .proposal-document h1 { font-size: 24pt; line-height: 1.2; }
  .proposal-document h2 { font-size: 14pt; line-height: 1.3; margin-top: 0; }
  .proposal-document h3 { font-size: 11pt; }
  .proposal-document { font-size: 10pt; line-height: 1.4; }
  .proposal-document table { font-size: 9pt; }
  .proposal-document .font-mono { font-family: var(--font-mono, ui-monospace), monospace; }

  /* Avoid awkward breaks inside calculation record cards */
  .proposal-document [class*="rounded-md border"] {
    break-inside: avoid;
  }

  /* Hide anything explicitly marked */
  .print\:hidden,
  .print\\:hidden {
    display: none !important;
  }
}
```

**Step 2: Web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean.

**Step 3: Manual print preview**

Start dev server. On a proposal page:
1. Press Cmd+P (Mac) or Ctrl+P (Win/Linux)
2. Verify print preview shows:
   - White background, black text
   - Tab bar + action buttons hidden
   - Section headers without the extra decorative dashes
   - Page breaks between sections (each section starts on a new page)
   - Cover page fills most of page 1
   - BoQ tables don't break in awkward places
3. Test with different paper sizes (A4, Letter) to confirm it still looks fine

If anything is off, iterate on the `@media print` block. Commit each fix.

**Step 4: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/app/globals.css && \
git commit -m "Add @media print styling for proposal PDF output"
```

---

### Task 13: End-to-end smoke test

**Files:** none (manual)

**Step 1: Start dev server, sign in, create a project**

```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run dev --filter=web &
```

Use a real authenticated session (create a test user via Supabase dashboard if needed — pre-existing users from earlier phases work fine).

**Step 2: Build a realistic plant**

Drag units onto the canvas to form a full train:
- Influent → Screen → PrimaryClarifier → BioreactorAnoxic → BioreactorAerobic → SecondaryClarifier → UvDisinfection → Effluent
- Connect the RAS (SecondaryClarifier.underflow → BioreactorAnoxic)
- Add an orphan AerationBlower, set `o2_demand_kg_per_day: 500`
- Add an orphan ChemicalDosing (alum, 30 mg/L)

**Step 3: Run the simulation**

Click Run Simulation. Verify results populate.

**Step 4: Click the Proposal tab**

Verify:
- All 11 sections render
- Cover page shows editable placeholders
- Executive summary shows non-zero installed kW, non-zero total CapEx
- Design basis shows flows from the Influent unit
- Process description shows a small read-only flowsheet figure
- Sizing calculations shows calculation records per unit
- Aeration design shows O₂ demand records + blower kW
- Energy analysis table has 3+ rows with totals
- Consumables table shows alum + whatever else
- BoQ table has civil + mechanical subtotals + grand total
- Effluent compliance shows pass/fail indicators
- Disclaimer is editable

**Step 5: Edit and persist**

- Type a client name in the cover page → wait 1.5 s → refresh the page → verify the name persists
- Type a narrative in the executive summary → wait → refresh → verify persistence

**Step 6: Save BoQ**

Click "Save BoQ". Verify a toast saying "Saved N BoQ line items". Check Supabase dashboard's `boq_line_items` table — N rows exist for this flowsheet.

**Step 7: Generate PDF**

Click "Generate PDF":
- If free tier: toast says "PDF generation requires Pro or Enterprise" — verify gate works
- If Pro+ tier: browser print dialog opens with the proposal as the preview
- In Supabase dashboard, `project_proposals` has a new row with `version = 1`

**Step 8: Click Generate PDF again**

- Another row inserts with `version = 2`
- Unique constraint prevents duplicates

**Step 9: Toggle dark/light in screen mode**

- Proposal reads well in both modes (screen)
- Print preview is always white background with black text regardless of screen theme

**Step 10: Document any issues**

If anything doesn't work, note it and fix with scoped commits before the final verification task.

---

### Task 14: Final verification

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

**Step 3: Type check monorepo**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run check-types
```
Expected: Clean.

**Step 4: Web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean. Route count: **13** (12 + new proposal route).

**Step 5: Hardcoded color grep on new files**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
grep -rnE "(slate|gray|zinc|neutral)-[0-9]{2,3}" apps/web/lib/proposal/ 2>&1 || echo "ALL SEMANTIC"
```
Expected: `ALL SEMANTIC`.

**Step 6: Confirm `ResultsPanel` is gone**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
grep -rn ResultsPanel apps/web 2>&1 | grep -v .next | grep -v node_modules || echo "GONE"
```
Expected: `GONE`.

**Step 7: Commit review**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git log --oneline main..HEAD | head -30
```

---

### Task 15: Phase 7 completion summary

**Files:**
- Create: `docs/plans/2026-04-15-aquasim-v2-phase-7-COMPLETE.md`

**Step 1: Write the summary**

```markdown
# Phase 7 Complete — Proposal View + PDF Generation

**Completed:** YYYY-MM-DD
**Branch:** v2-proposal-generator
**Commits:** ~12-15

## What shipped
- New route `/project/[id]/proposal/[flowsheetId]` renders a live 11-section design proposal
- `<ProjectEditorTabs>` toggle on both flowsheet + proposal routes (shared via stores, instant switch)
- Legacy `ResultsPanel` deleted; `components/results/` directory removed; shared-page reference cleaned up
- `useProposalData` hook loads `flowsheets.proposal_data` + `profiles` branding, debounced-persists edits to Supabase (1s)
- All 11 sections implemented: Cover, Executive Summary, Design Basis, Process Description (with read-only FlowsheetFigure), Sizing Calculations (reuses Phase 6 CalculationRecordCard), Aeration Design, Energy Analysis (table + annual cost estimate), Consumables (aggregated across units), Bill of Quantities (grouped by category with totals), Effluent Compliance (vs DWA limits), Disclaimer (editable)
- `saveBoqLineItems` helper: delete-then-insert into `boq_line_items` for the flowsheet
- `createProposalSnapshot` helper: inserts a new `project_proposals` row with auto-incremented version
- "Save BoQ" button persists just the BoQ
- "Generate Proposal PDF" button saves BoQ + creates snapshot + triggers `window.print()`
- Subscription tier gate preserved — free tier blocked from PDF generation with toast error
- `@media print` styling: A4 page, white bg/black text, section page breaks, tightened typography, avoid-break-inside on calculation cards

## Verification state
- Sim-engine tests: 118 passing (unchanged)
- Design-library tests: 16 passing (unchanged)
- Combined: **134** (unchanged — Phase 7 is UI + persistence; no new sim-engine logic)
- Type check: clean
- Web build: clean, 13 routes (was 12)
- Hardcoded-color grep: clean
- E2E smoke test: full plant → proposal → Save BoQ → Generate PDF → browser print preview readable

## Deviations from plan
<list any>

## Known limitations
- `flowsheets.discharge_standards` column exists but is not unified with `DWA_LIMITS` — proposal view defaults to General. Later phase adds a tier selector.
- Browser print-to-PDF: `project_proposals.pdf_url` stays NULL because browser print doesn't expose the rendered file to JS. Later phase can add server-rendered Playwright-based PDF and upload to Supabase Storage.
- Share links show flowsheet only — no proposal view for shared tokens. Revisit if users ask for it.
- No version history UI — `project_proposals` rows accumulate but there's no browser for them.
- No `/settings` page — `profile.company_logo_url` and `designer_title` fall back to defaults if empty.
- BoQ overrides: aggregator supports them as params but no UI surface. Later phase adds inline price editing.
- Engineer BoQ override workflow (change a supplier price per-project) — schema ready, UI deferred.

## Next: Phase 8
Landing page rewrite — positioning pivot from "process simulator" to "design & proposal generator". Update hero copy, feature grid, pricing table CTAs. Pure content + minor UI changes. Uses Phase 5 tokens and layout primitives.

Draft plan: `docs/plans/YYYY-MM-DD-aquasim-v2-phase-8-landing-page.md`
```

**Step 2: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add docs/plans/2026-04-15-aquasim-v2-phase-7-COMPLETE.md && \
git commit -m "Phase 7 complete — proposal view + PDF generation"
```

**Step 3: Do NOT merge to main.** Branch stays for Phase 8.

---

## Summary of commits expected for Phase 7

| # | Task | Commit message |
|---|---|---|
| 0 | Baseline | (no commit) |
| 1 | Tabs + flowsheet wire | `Add ProjectEditorTabs component and wire into flowsheet page` |
| 2 | Proposal route scaffold | `Scaffold /project/[id]/proposal/[fsid] route` |
| 3 | Delete ResultsPanel | `Delete legacy ResultsPanel and clean up its import sites` |
| 4 | Skeleton + stubs | `Add ProposalDocument skeleton with 11 empty section stubs` |
| 5 | Hook | `Add useProposalData hook — loads + debounced-persists proposal metadata` |
| 6 | Sections 1-2 | `Proposal sections 1-2: Cover + Executive Summary` |
| 7 | Sections 3-4 | `Proposal sections 3-4: Design Basis + Process Description` |
| 8 | Sections 5-6 | `Proposal sections 5-6: Sizing Calculations + Aeration Design` |
| 9 | Sections 7-8 | `Proposal sections 7-8: Energy Analysis + Consumables` |
| 10 | Sections 9-10 | `Proposal sections 9-10: Bill of Quantities + Effluent Compliance` |
| 11 | Section 11 + persistence + PDF button | `Proposal: Disclaimer section + Save BoQ + Generate PDF buttons` |
| 12 | Print CSS | `Add @media print styling for proposal PDF output` |
| 13 | Smoke test polish | (any scoped fix commits) |
| 15 | Summary | `Phase 7 complete — proposal view + PDF generation` |

Total: ~12-15 commits on top of Phase 6. Test count unchanged (134). Web routes: 12 → 13. Branch ready for Phase 8.

---

## Notes for the executor

1. **The proposal view is a *client* component tree.** The entire document is interactive — editable fields, live updates from the simulation store, debounced persistence. Server-side rendering is out of scope. If SSR attempts fail, just add `'use client'` at the top of the files.

2. **`nodeResults` type from Phase 6**: `SimulationResults.nodeResults` is `Record<string, ProcessResult>`. Phase 7 consumes this directly without casts.

3. **The `FlowsheetFigure` component** needs the same `nodeTypes` the main canvas uses. If `node-types` isn't exported from `components/canvas/`, extract it from `Canvas.tsx` into a shared file — it's a small refactor and keeps the proposal figure in sync with the editor canvas.

4. **`EditableSpan` uses `contentEditable`**. Don't try to replace it with a controlled `<input>` that matches inline text styling — contentEditable is how you get editable headings and inline labels. Just make sure the `onBlur` handler handles the case where `textContent` is null.

5. **Debounced persistence is per-proposal, not per-field.** The hook takes the full `ProposalData` object and writes it wholesale. This is fine for a small jsonb column with at most ~1 KB of data.

6. **`saveBoqLineItems` uses delete-then-insert**. Not the most efficient but simple and safe. A flowsheet has maybe 100 line items max; two round-trips is fine.

7. **Version auto-increment is read-then-write** — not atomic. Two rapid clicks on Generate PDF could race. The unique constraint on `(flowsheet_id, version)` catches this at the DB level. If the insert fails with a unique-violation, the UI surfaces the error via toast; user clicks again. Good enough for v1.

8. **`window.print()` is synchronous-looking but actually async.** The browser opens its print dialog; the user clicks save or cancel. We don't get a callback. That's why Phase 7 saves BoQ + snapshot *before* calling `window.print()` — if the user cancels, the snapshot still reflects the intent.

9. **Light mode for print**: the `@media print` block forces white background and black text regardless of the user's screen theme. This is deliberate — engineers print to share with clients; the paper version should always look the same.

10. **Pro tier gate**: `limits.pdfReports` comes from `useSubscription`. For free-tier smoke-testing, temporarily set the tier to `pro` in the Supabase `profiles` row, test, then revert. Don't ship a dev-mode bypass.

11. **If a section looks broken on a specific plant configuration**, add a guard rendering an "unavailable" message for that section only — don't let one bad unit crash the entire proposal document. The `ErrorBoundary` catches hard crashes.

12. **No new tests.** Phase 7 renders data that earlier phases already produce correctly. The verification is the E2E smoke test (Task 13). Writing Jest/Vitest tests for 11 section components would be low-ROI.

13. **Do NOT merge to main.** Leave the branch for Phase 8 (landing page rewrite). Phase 9 is the eventual cut-over.
