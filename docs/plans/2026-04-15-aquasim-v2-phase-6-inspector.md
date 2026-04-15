# AquaSim v2 — Phase 6: Inspector Redesign with Inline Calculation Records

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Replace the current monolithic `InspectorPanel.tsx` with a modular, token-styled inspector that surfaces the v2 `UnitOutputs` fields (sizing, energy, consumables, capex, calculation records, warnings) inline. The calculation records are the centerpiece — each one renders as an equation with named inputs, result, and citation, so the engineer can audit every number without leaving the canvas. All consumed from the existing `nodeResults` map in `useSimulationStore` — no new data flow, no sim-engine changes.

**Architecture:** Split the current single-file inspector into a thin orchestrator `InspectorPanel.tsx` plus ~10 purpose-built section components under `apps/web/components/inspector/`. Each section is a pure presentational component that accepts a slice of `ProcessResult` as props and short-circuits to `null` when its data slice is empty. The orchestrator composes them in a fixed visual order (Header → Config → Warnings → Sizing → Energy → Consumables → Calculation Records → BoQ → Water Quality Outputs) and reads the rest of its state from Zustand stores unchanged.

**Tech Stack:** React 19, Tailwind v4 (using Phase 5 tokens), shadcn primitives, Zustand stores (`flowsheet-store`, `simulation-store`), sim-engine `UnitOutputs` types. No new deps.

---

## Context & References

- **Design doc:** `docs/plans/2026-04-02-aquasim-v2-proposal-generator-design.md` section 8.3 (Inspector calculation rendering)
- **Phases 1a–5 complete.** Combined test count before Phase 6: **134** (118 sim-engine + 16 design-library)
- **Starting branch:** `v2-proposal-generator`
- **Current inspector:** `apps/web/components/inspector/InspectorPanel.tsx` — single file, ~150 lines, renders header + parameters + metadata + water quality outputs. Does NOT yet render any v2 field (sizing / energy / consumables / capex / calculationRecords / warnings).
- **Phase 5 tokens available:** `--foreground`, `--muted-foreground`, `--card`, `--border`, `--primary`, `--destructive`, `--font-mono` etc. Use these — no hardcoded colors.
- **Phase 5 layout primitives available:** `PageShell`, `PageHeader`, `EmptyState` under `apps/web/components/layout/`. Phase 6 uses `EmptyState` for the "no unit selected" placeholder.
- **Category workaround from Phase 5:** `UnitDefinition` does not carry a `category` field; Phase 5 added a local `UNIT_CATEGORY` map in `UnitPalette.tsx`. Phase 6 does not need categories — ignore this.

### Data flow recap (unchanged by Phase 6)

```
Engineer edits input in Inspector
  → Inspector.onChange() calls flowsheet-store.updateNodeData()
  → Flowsheet store dirties the selected node's parameters
  → Simulation store (separately) re-runs simulate() — debounced — and updates nodeResults
  → Inspector re-renders with the fresh nodeResult for the selected node
```

Phase 6 does NOT touch the debounced re-run logic. If the current simulation store runs on every parameter change, that's already correct. If it runs only on an explicit button press, Phase 6 leaves it alone; the "live update" UX is a Phase 7 concern.

### UnitOutputs shape (from sim-engine, set in Phase 1a, filled in Phases 1b + 2)

Every unit's `process()` returns a `ProcessResult` that now includes (all optional):
- `sizing?: Record<string, Dimension>` — named sizing dimensions
- `energy?: { installedKW, dailyKWh, records }` — energy demand
- `consumables?: ConsumableItem[]` — daily chemicals/disposal
- `capex?: { lineItems, total }` — this unit's contribution to the BoQ
- `calculationRecords?: CalculationRecord[]` — auditable equations, inputs, results, citations
- `warnings?: string[]` — rule-of-thumb violations

`ProcessResult` also keeps its v1 fields: `outputs: Record<string, WaterQuality>` and `metadata: Record<string, number>`.

## Success Criteria

1. `apps/web/components/inspector/` contains a thin orchestrator plus section components (see Architecture)
2. When a unit is selected, the inspector renders **every populated v2 field** in a fixed visual order
3. `CalculationRecordCard` renders each calculation record with: symbol, label, equation (monospace), named inputs (name + value + unit + source), result (value + unit), citation (clickable later, plain text for Phase 6)
4. Warnings render at the top of the inspector in a `destructive` styled block — engineers can't miss them
5. When `calculationRecords` is populated, the section replaces the old raw `metadata` block for that unit (metadata stays as a fallback only when records are empty)
6. Empty-state message when no unit is selected uses `EmptyState` from Phase 5
7. All sections use tokens — `grep -rnE "(slate|gray|zinc|neutral)-[0-9]{2,3}" apps/web/components/inspector/` returns nothing
8. Keyboard and tablet behaviour preserved (Sheet collapse below `lg:` still works from Phase 5)
9. Test count unchanged at **134** combined. No new tests — Phase 6 is UI rendering of data already produced by sim-engine
10. Web build clean, type check clean across the monorepo
11. Manual smoke test: open a flowsheet, select a BioreactorAerobic node, confirm the inspector shows ≥ 3 calculation records with equations and citations visible at default font size (no truncation)

## Non-Goals (deferred)

- **Calculation-record citations as clickable deep links** (to `/library/units/[unit]#citation-X`) — later polish; Phase 6 renders them as plain text
- **Live BoQ overrides from the inspector** (engineer types a new price) — Phase 7 wires this into the proposal view
- **Debounced / live simulation re-runs** — Phase 6 inherits whatever the current store does; improving the debounce is a separate effort
- **Math rendering via KaTeX / MathJax** — equations are plain strings (`"Va = Vt × (1 − fxt)"`). KaTeX is nice-to-have but adds a dep for limited benefit at this stage
- **Inline editing of calculation records** — records are read-only
- **Showing calculation records for orphan utility nodes** (AerationBlower, ChemicalDosing) — those don't get visited by `simulate()`, so `nodeResults[orphanId]` is `undefined`. Phase 7 (proposal view) handles orphans via `aggregateBoQ()`; Phase 6 inspector shows an "Outputs computed on demand — select this unit in the proposal view" message instead, or renders a one-off `createUnit().process([])` call at render time (pick one; see Task 4 for the decision point)

---

## Tasks

### Task 0: Verify starting state

**Step 1: Branch + clean tree**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && git status && git log --oneline | head -5
```
Expected: `On branch v2-proposal-generator`, working tree clean, recent Phase 5 commit.

**Step 2: Tests green**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/sim-engine && npx vitest run
```
Expected: 118.
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone/packages/design-library && npx vitest run
```
Expected: 16.

**Step 3: Web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean, 12 routes.

---

### Task 1: Extract `WaterQualityTable` and archive current inspector

**Files:**
- Create: `apps/web/components/inspector/WaterQualityTable.tsx`
- Modify: `apps/web/components/inspector/InspectorPanel.tsx` (will be fully rewritten in subsequent tasks — this step just moves the sub-component out)

**Context:** The current `InspectorPanel.tsx` has an inline `WaterQualityTable` sub-component. Extract it first so subsequent tasks can grow the inspector without growing the monolith.

**Step 1: Create `WaterQualityTable.tsx`**

Copy the `WaterQualityTable` function from `InspectorPanel.tsx` verbatim into its own file:

```typescript
'use client';

import type { WaterQuality } from '@repo/sim-engine';

const WQ_PARAMS: { key: keyof WaterQuality; label: string; unit: string }[] = [
  { key: 'flow', label: 'Flow', unit: 'm³/d' },
  { key: 'COD', label: 'COD', unit: 'mg/L' },
  { key: 'sCOD', label: 'sCOD', unit: 'mg/L' },
  { key: 'BOD5', label: 'BOD₅', unit: 'mg/L' },
  { key: 'TKN', label: 'TKN', unit: 'mgN/L' },
  { key: 'NH3N', label: 'NH₃-N', unit: 'mgN/L' },
  { key: 'NO3N', label: 'NO₃-N', unit: 'mgN/L' },
  { key: 'TP', label: 'TP', unit: 'mgP/L' },
  { key: 'TSS', label: 'TSS', unit: 'mg/L' },
  { key: 'VSS', label: 'VSS', unit: 'mg/L' },
  { key: 'pH', label: 'pH', unit: '' },
  { key: 'alkalinity', label: 'Alk', unit: 'mmol/L' },
  { key: 'DO', label: 'DO', unit: 'mg/L' },
];

export function WaterQualityTable({ wq }: { wq: WaterQuality }) {
  return (
    <div className="space-y-0.5 font-mono">
      {WQ_PARAMS.map(({ key, label, unit }) => (
        <div key={key} className="flex justify-between text-xs">
          <span className="text-muted-foreground">
            {label}
            {unit && <span className="text-muted-foreground/60 ml-1">({unit})</span>}
          </span>
          <span className="text-foreground">
            {typeof wq[key] === 'number' ? (wq[key] as number).toFixed(2) : wq[key]}
          </span>
        </div>
      ))}
    </div>
  );
}
```

Note the two token updates from the original: use `text-foreground` for the value column (was implicit inherited) and `font-mono` on the wrapper (uses the Phase 5 mono font var).

**Step 2: Update `InspectorPanel.tsx` to import the extracted component**

Change the import at the top:
```typescript
import { WaterQualityTable } from './WaterQualityTable';
```

And delete the inline `function WaterQualityTable` at the bottom of the file.

**Step 3: Web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean.

**Step 4: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/components/inspector/WaterQualityTable.tsx apps/web/components/inspector/InspectorPanel.tsx && \
git commit -m "Extract WaterQualityTable into its own file"
```

---

### Task 2: Create `CalculationRecordCard` — the centerpiece component

**Files:**
- Create: `apps/web/components/inspector/CalculationRecordCard.tsx`

**Context:** Every calculation record in a unit's output is rendered via this component. Its job is to compactly show the engineer: what equation was used, what inputs fed into it, what the result is, and the citation. The design doc's spec (section 8.3) is:

```
Aerobic volume (Va)
  Va = Vt × (1 − fxt)
    Vt  = 250 m³     (total reactor volume, from sizing)
    fxt = 0.25       (selected anoxic fraction)
  = 187.5 m³
  📖 Ekama (1984) WRC TT-16/84, eq 4.12
```

**Step 1: Create the component**

```typescript
'use client';

import type { CalculationRecord } from '@repo/sim-engine';
import { BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  record: CalculationRecord;
  className?: string;
}

export function CalculationRecordCard({ record, className }: Props) {
  return (
    <div
      className={cn(
        'rounded-md border border-border bg-card/50 p-3 text-xs',
        className,
      )}
    >
      {/* Header: symbol + label + result */}
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <div className="min-w-0 flex-1">
          <span className="font-mono text-foreground">{record.symbol}</span>
          <span className="ml-1.5 text-muted-foreground">{record.label}</span>
        </div>
        <div className="font-mono text-foreground whitespace-nowrap">
          {formatResult(record.result.value)}
          <span className="ml-1 text-muted-foreground/80">{record.result.unit}</span>
        </div>
      </div>

      {/* Equation */}
      <div className="font-mono text-foreground/90 bg-muted/40 rounded px-2 py-1 my-1.5">
        {record.equation}
      </div>

      {/* Named inputs */}
      {Object.entries(record.inputs).length > 0 && (
        <dl className="mt-2 space-y-0.5">
          {Object.entries(record.inputs).map(([name, inp]) => (
            <div key={name} className="flex items-baseline gap-2 text-[11px]">
              <dt className="font-mono text-muted-foreground shrink-0 w-10 text-right">{name}</dt>
              <dd className="font-mono text-foreground">
                = {formatResult(inp.value)}
                {inp.unit && <span className="text-muted-foreground/80 ml-0.5">{inp.unit}</span>}
                {inp.source && (
                  <span className="text-muted-foreground/60 ml-1.5 italic">({inp.source})</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {/* Citation */}
      <div className="mt-2 pt-2 border-t border-border/50 flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <BookOpen className="h-3 w-3 shrink-0 mt-0.5" />
        <span className="italic">{record.citation}</span>
      </div>
    </div>
  );
}

/** Format a numeric result — show sensible precision based on magnitude */
function formatResult(v: number): string {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  const abs = Math.abs(v);
  if (abs >= 1000) return v.toFixed(0);
  if (abs >= 10) return v.toFixed(1);
  if (abs >= 1) return v.toFixed(2);
  if (abs >= 0.01) return v.toFixed(3);
  return v.toExponential(2);
}
```

**Step 2: Web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean. The component is unused at this point — Tasks 3 and 4 wire it up.

**Step 3: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/components/inspector/CalculationRecordCard.tsx && \
git commit -m "Add CalculationRecordCard — equation + inputs + result + citation renderer"
```

---

### Task 3: Create section components for the 6 v2 fields

**Files:**
- Create: `apps/web/components/inspector/WarningsSection.tsx`
- Create: `apps/web/components/inspector/SizingSection.tsx`
- Create: `apps/web/components/inspector/EnergySection.tsx`
- Create: `apps/web/components/inspector/ConsumablesSection.tsx`
- Create: `apps/web/components/inspector/CalculationRecordsSection.tsx`
- Create: `apps/web/components/inspector/BoqSection.tsx`
- Create: `apps/web/components/inspector/InspectorSection.tsx` (shared wrapper)

**Context:** Each section is a pure function of its input slice. They all short-circuit to `null` when the slice is empty so the orchestrator doesn't need conditional wrappers.

**Step 1: Create the shared `InspectorSection` wrapper**

```typescript
// apps/web/components/inspector/InspectorSection.tsx
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  description?: string;
  children: React.ReactNode;
  variant?: 'default' | 'destructive';
  className?: string;
}

export function InspectorSection({ title, description, children, variant = 'default', className }: Props) {
  return (
    <section
      className={cn(
        'space-y-2',
        variant === 'destructive' && 'rounded-md border border-destructive/50 bg-destructive/5 p-3',
        className,
      )}
    >
      <div>
        <h4 className={cn(
          'text-xs font-medium uppercase tracking-wide',
          variant === 'destructive' ? 'text-destructive' : 'text-muted-foreground',
        )}>
          {title}
        </h4>
        {description && (
          <p className="mt-0.5 text-[11px] text-muted-foreground/80">{description}</p>
        )}
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}
```

**Step 2: Create `WarningsSection`**

```typescript
// apps/web/components/inspector/WarningsSection.tsx
import { AlertTriangle } from 'lucide-react';
import { InspectorSection } from './InspectorSection';

interface Props { warnings?: string[] }

export function WarningsSection({ warnings }: Props) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <InspectorSection title={`Warnings (${warnings.length})`} variant="destructive">
      <ul className="space-y-1.5">
        {warnings.map((w, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-foreground">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-destructive" />
            <span>{w}</span>
          </li>
        ))}
      </ul>
    </InspectorSection>
  );
}
```

**Step 3: Create `SizingSection`**

```typescript
// apps/web/components/inspector/SizingSection.tsx
import type { Dimension } from '@repo/sim-engine';
import { InspectorSection } from './InspectorSection';

interface Props {
  sizing?: Record<string, Dimension>;
}

export function SizingSection({ sizing }: Props) {
  if (!sizing || Object.keys(sizing).length === 0) return null;
  return (
    <InspectorSection title="Sizing">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs">
        {Object.entries(sizing).map(([key, dim]) => (
          <div key={key} className="flex items-baseline justify-between gap-2 col-span-2">
            <dt className="text-muted-foreground">{humanize(key)}</dt>
            <dd className="text-foreground">
              {formatNumber(dim.value)}
              <span className="ml-1 text-muted-foreground/80">{dim.unit}</span>
            </dd>
          </div>
        ))}
      </dl>
    </InspectorSection>
  );
}

function humanize(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .replace(/^\w/, c => c.toUpperCase());
}

function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1000) return v.toFixed(0);
  if (abs >= 10) return v.toFixed(1);
  return v.toFixed(2);
}
```

**Step 4: Create `EnergySection`**

```typescript
// apps/web/components/inspector/EnergySection.tsx
import type { ProcessResult } from '@repo/sim-engine';
import { InspectorSection } from './InspectorSection';
import { CalculationRecordCard } from './CalculationRecordCard';
import { Zap } from 'lucide-react';

interface Props { energy?: ProcessResult['energy'] }

export function EnergySection({ energy }: Props) {
  if (!energy) return null;
  if (energy.installedKW === 0 && energy.dailyKWh === 0 && energy.records.length === 0) return null;

  return (
    <InspectorSection title="Energy">
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono text-foreground">{energy.installedKW.toFixed(1)}</span>
          <span className="text-muted-foreground">kW installed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-foreground">{energy.dailyKWh.toFixed(0)}</span>
          <span className="text-muted-foreground">kWh/d</span>
        </div>
      </div>
      {energy.records.length > 0 && (
        <div className="space-y-1.5 mt-2">
          {energy.records.map((r, i) => <CalculationRecordCard key={i} record={r} />)}
        </div>
      )}
    </InspectorSection>
  );
}
```

**Step 5: Create `ConsumablesSection`**

```typescript
// apps/web/components/inspector/ConsumablesSection.tsx
import type { ConsumableItem } from '@repo/sim-engine';
import { InspectorSection } from './InspectorSection';

interface Props { consumables?: ConsumableItem[] }

export function ConsumablesSection({ consumables }: Props) {
  if (!consumables || consumables.length === 0) return null;
  return (
    <InspectorSection title="Consumables" description="Daily operating inputs">
      <ul className="space-y-1.5 text-xs">
        {consumables.map((c, i) => (
          <li key={i} className="flex items-baseline justify-between gap-2">
            <span className="text-foreground flex-1 min-w-0 truncate">{c.item}</span>
            <span className="font-mono text-foreground whitespace-nowrap">
              {formatDaily(c.daily)}
              <span className="ml-1 text-muted-foreground/80">{c.unit}</span>
            </span>
          </li>
        ))}
      </ul>
    </InspectorSection>
  );
}

function formatDaily(v: number): string {
  if (v >= 1000) return v.toFixed(0);
  if (v >= 1) return v.toFixed(1);
  return v.toFixed(3);
}
```

**Step 6: Create `CalculationRecordsSection`**

```typescript
// apps/web/components/inspector/CalculationRecordsSection.tsx
import type { CalculationRecord } from '@repo/sim-engine';
import { InspectorSection } from './InspectorSection';
import { CalculationRecordCard } from './CalculationRecordCard';

interface Props { records?: CalculationRecord[] }

export function CalculationRecordsSection({ records }: Props) {
  if (!records || records.length === 0) return null;
  return (
    <InspectorSection
      title={`Calculations (${records.length})`}
      description="Every derived number, with equation, inputs, and citation"
    >
      <div className="space-y-1.5">
        {records.map((r, i) => <CalculationRecordCard key={i} record={r} />)}
      </div>
    </InspectorSection>
  );
}
```

**Step 7: Create `BoqSection`**

```typescript
// apps/web/components/inspector/BoqSection.tsx
import type { BoQLineItem } from '@repo/sim-engine';
import { InspectorSection } from './InspectorSection';
import { Badge } from '@/components/ui/badge';

interface Props {
  capex?: { lineItems: BoQLineItem[]; total: number };
}

const CATEGORY_LABEL: Record<string, string> = {
  civil: 'Civil',
  mechanical: 'Mech',
  electrical: 'Elec',
  chemicals: 'Chem',
  instrumentation: 'Instr',
};

export function BoqSection({ capex }: Props) {
  if (!capex || capex.lineItems.length === 0) return null;
  return (
    <InspectorSection title="Bill of Quantities" description="This unit's contribution to the plant BoQ">
      <ul className="space-y-1.5 text-xs">
        {capex.lineItems.map((item, i) => (
          <li key={i} className="space-y-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0">
                  {CATEGORY_LABEL[item.category] ?? item.category}
                </Badge>
                <span className="text-foreground truncate">{item.description}</span>
              </div>
              <span className="font-mono text-foreground whitespace-nowrap">
                R{formatCurrency(item.quantity * item.unitPriceZar)}
              </span>
            </div>
            <div className="pl-[3.25rem] text-[10px] text-muted-foreground/80 italic">
              {item.sourceCitation}
            </div>
          </li>
        ))}
      </ul>
      <div className="pt-2 mt-2 border-t border-border flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground font-medium">Unit subtotal</span>
        <span className="font-mono text-foreground font-semibold">
          R{formatCurrency(capex.total)}
        </span>
      </div>
    </InspectorSection>
  );
}

function formatCurrency(v: number): string {
  return v.toLocaleString('en-ZA', { maximumFractionDigits: 0 });
}
```

**Step 8: Web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean.

**Step 9: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/components/inspector/InspectorSection.tsx \
        apps/web/components/inspector/WarningsSection.tsx \
        apps/web/components/inspector/SizingSection.tsx \
        apps/web/components/inspector/EnergySection.tsx \
        apps/web/components/inspector/ConsumablesSection.tsx \
        apps/web/components/inspector/CalculationRecordsSection.tsx \
        apps/web/components/inspector/BoqSection.tsx && \
git commit -m "Add inspector section components for v2 output fields"
```

---

### Task 4: Rewrite `InspectorPanel.tsx` as a thin orchestrator

**Files:**
- Modify: `apps/web/components/inspector/InspectorPanel.tsx`

**Step 1: Replace the file contents**

```typescript
'use client';

import { useFlowsheetStore } from '@/stores/flowsheet-store';
import { useSimulationStore } from '@/stores/simulation-store';
import { unitDefinitions } from '@repo/sim-engine';
import type { WaterQuality } from '@repo/sim-engine';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/layout/empty-state';
import { HelpTooltip } from '@/components/help-tooltip';
import { MousePointer2 } from 'lucide-react';

import { WaterQualityTable } from './WaterQualityTable';
import { InspectorSection } from './InspectorSection';
import { WarningsSection } from './WarningsSection';
import { SizingSection } from './SizingSection';
import { EnergySection } from './EnergySection';
import { ConsumablesSection } from './ConsumablesSection';
import { CalculationRecordsSection } from './CalculationRecordsSection';
import { BoqSection } from './BoqSection';

export default function InspectorPanel() {
  const { nodes, selectedNodeId, updateNodeData } = useFlowsheetStore();
  const { results } = useSimulationStore();

  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId)
    : null;

  if (!selectedNode) {
    return (
      <div className="w-80 border-l border-border bg-card/30 p-4">
        <EmptyState
          icon={MousePointer2}
          title="No unit selected"
          description="Click a process unit on the canvas to configure its parameters and view its calculation trail."
        />
      </div>
    );
  }

  const def = unitDefinitions[selectedNode.data.unitType];
  const nodeResult = results?.nodeResults[selectedNode.id];

  // When calculation records are present, they are the canonical display.
  // Otherwise fall back to raw metadata for units that haven't adopted v2 records yet.
  const hasRecords = (nodeResult?.calculationRecords?.length ?? 0) > 0;
  const hasMetadata = nodeResult && Object.keys(nodeResult.metadata ?? {}).length > 0;

  return (
    <div className="w-80 border-l border-border bg-card/30 overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div>
          <h3 className="text-base font-semibold text-foreground">{selectedNode.data.label}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{def.description}</p>
        </div>

        <Separator />

        {/* Warnings — always first so they're impossible to miss */}
        <WarningsSection warnings={nodeResult?.warnings} />

        {/* Config / parameters */}
        {def.parameterSchema.length > 0 && (
          <InspectorSection title="Configuration">
            <div className="space-y-3">
              {def.parameterSchema.map((param) => (
                <div key={param.key} className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Label htmlFor={param.key} className="text-xs">
                      {param.label}
                      {param.unit ? (
                        <span className="text-muted-foreground ml-1">({param.unit})</span>
                      ) : null}
                    </Label>
                    {param.description && <HelpTooltip text={param.description} />}
                  </div>
                  <Input
                    id={param.key}
                    type="number"
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    value={selectedNode.data.parameters[param.key] ?? param.defaultValue}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        updateNodeData(selectedNode.id, {
                          parameters: {
                            ...selectedNode.data.parameters,
                            [param.key]: val,
                          },
                        });
                      }
                    }}
                    className="h-8 text-sm font-mono"
                  />
                </div>
              ))}
            </div>
          </InspectorSection>
        )}

        {nodeResult && (
          <>
            <Separator />

            <SizingSection sizing={nodeResult.sizing} />
            <EnergySection energy={nodeResult.energy} />
            <ConsumablesSection consumables={nodeResult.consumables} />
            <CalculationRecordsSection records={nodeResult.calculationRecords} />
            <BoqSection capex={nodeResult.capex} />

            {/* Legacy metadata fallback — shown only if there are no calc records */}
            {!hasRecords && hasMetadata && (
              <InspectorSection title="Metadata">
                <dl className="space-y-0.5 font-mono text-xs">
                  {Object.entries(nodeResult.metadata).map(([key, value]) => (
                    <div key={key} className="flex items-baseline justify-between gap-2">
                      <dt className="text-muted-foreground">{key.replace(/_/g, ' ')}</dt>
                      <dd className="text-foreground">
                        {typeof value === 'number' ? value.toFixed(2) : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </InspectorSection>
            )}

            {/* Output water quality streams — always shown when available */}
            {Object.entries(nodeResult.outputs).length > 0 && (
              <InspectorSection title="Output Streams">
                <div className="space-y-3">
                  {Object.entries(nodeResult.outputs).map(([handleId, wq]) => (
                    <div key={handleId} className="space-y-1">
                      <Badge variant="outline" className="text-[10px]">{handleId}</Badge>
                      <WaterQualityTable wq={wq as WaterQuality} />
                    </div>
                  ))}
                </div>
              </InspectorSection>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean.

**Step 3: Type check**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run check-types --filter=web
```
Expected: Clean.

**Step 4: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/components/inspector/InspectorPanel.tsx && \
git commit -m "Rewrite InspectorPanel as a thin orchestrator over v2 section components"
```

---

### Task 5: Verify Sheet collapse (tablet) still works

**Files:** none (verification only)

**Context:** Phase 5 Task 10 added a `<Sheet>`-based collapse of the inspector on `<lg:` breakpoints. Phase 6 changed the inspector's internal composition but the Sheet wrapper lives in the project editor page (not in the inspector itself). Confirm nothing broke.

**Step 1: Start dev server**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run dev --filter=web &
```

**Step 2: Open DevTools → Device toolbar → iPad Pro portrait (1024w)**

Navigate to the project editor `/project/[id]/flowsheet/[fsid]` (use any existing test flowsheet).

**Step 3: Verify**
- Inspector is hidden by default on narrow widths
- Floating "wrench" button (bottom-right) opens a sheet containing the inspector
- Selecting a unit, then opening the sheet, shows all the new v2 sections correctly
- Closing the sheet and clicking another unit re-opens it with the new selection

If anything is broken, note the issue. Fixes are usually tiny width adjustments on the Sheet content. Commit any fixes separately.

**Step 4: Switch to desktop width (>= 1280)**
- Inspector rail is visible by default on the right
- Floating button is hidden
- New v2 sections render inline without crowding

**Step 5: Kill dev server**

---

### Task 6: Smoke test a realistic flowsheet

**Files:** none (manual verification)

**Step 1: Open a full flowsheet**

Using the dev server, create a new project from a template (`Conventional AS` or `A2O BNR` — one of the 3 seeded templates). If templates don't exist or are broken, drag a minimal train onto the canvas: Influent → BioreactorAnoxic → BioreactorAerobic → SecondaryClarifier → Effluent.

**Step 2: Click each unit in turn and verify the inspector content**

For each node, the inspector should show:

| Node | Expected sections visible |
|---|---|
| Influent | Configuration (flow, WQ inputs), Calculation Records (design-basis records from Phase 1b), Output Streams |
| BioreactorAnoxic | Configuration, Sizing (volume, depth, HRT), Energy (mixer kW), CalculationRecords (HRT + denit capacity), BoQ (civil + mixer), Output Streams |
| BioreactorAerobic | Configuration, Sizing (volume, depth, HRT, MLSS), Energy (installedKW=0 per Phase 1b), CalculationRecords (HRT + MLSS + O2 demand carbonaceous + O2 demand nitrification), BoQ (civil + diffusers), Output Streams |
| SecondaryClarifier | Configuration, Sizing (surfaceArea, depth, volume), Warnings (if SOR/SLR exceeded), CalculationRecords (SOR + SLR), BoQ (civil + scraper), Output Streams |
| Effluent | Calculation Records (effluent-summary records from Phase 1b), Output Streams |

**Step 3: Check calculation records render correctly**

Click BioreactorAerobic. Expand the Calculations section. Verify:
- Each record shows the symbol + label at the top
- The result is right-aligned
- The equation is in a monospace block
- Named inputs list with name, value, unit, source
- Citation at the bottom preceded by the book icon
- Text is readable at the default zoom level — no truncation of equation strings

**Step 4: Trigger a warning**

Set the SecondaryClarifier's `surface_area` parameter to `50` (tiny) on a flowsheet with reasonable flow. The Warnings section should appear at the top of the inspector in destructive styling. Reset the parameter.

**Step 5: Toggle between dark and light mode**

Use the Phase 5 ThemeToggle. Confirm:
- Calculation record cards are readable in both modes
- Warnings look correctly destructive-styled in both modes
- Monospace columns (numbers, equations) still align

**Step 6: If anything visually wrong**

Commit tiny polish fixes per issue. Keep commits scoped.

---

### Task 7: Hardcoded-color audit for inspector files

**Files:** potentially modify any of the files under `apps/web/components/inspector/`

**Step 1: Grep**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
grep -rnE "(slate|gray|zinc|neutral)-[0-9]{2,3}" apps/web/components/inspector/ 2>&1 || echo "ALL SEMANTIC"
```
Expected: `ALL SEMANTIC`. If any hits, replace with the appropriate token.

**Step 2: Also grep for hex leaks**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
grep -rn "#[0-9a-fA-F]\{3,\}" apps/web/components/inspector/ 2>&1 || echo "NO HEX"
```
Expected: `NO HEX`. Anything present is either a legitimate SVG fill (rare in inspector files) or a leak — replace with `hsl(var(--token))`.

**Step 3: If fixes made, commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add apps/web/components/inspector/ && \
git commit -m "Inspector: final token audit pass"
```

---

### Task 8: Final verification

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

**Step 3: Type check full monorepo**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run check-types
```
Expected: Clean.

**Step 4: Web build**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && npx turbo run build --filter=web
```
Expected: Clean, 12 routes.

**Step 5: Commit review**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git log --oneline main..HEAD | head -20
```
Expected: Phases 1-5 + ~5-8 new Phase 6 commits.

---

### Task 9: Capture "after" inspector screenshots

**Files:**
- Create: `docs/design-system/after/inspector-*.png`

**Context:** Phase 5 captured landing + login pages. Phase 6's visible change is the inspector, so capture it specifically.

**Step 1: Start dev server, open project editor with a realistic flowsheet**

**Step 2: Capture three shots in dark mode:**
- `inspector-bioreactor-aerobic.png` — shows all sections populated
- `inspector-empty.png` — shows the EmptyState when no unit is selected
- `inspector-warning.png` — shows the destructive-styled Warnings section when a rule-of-thumb is violated

**Step 3: Capture the same three in light mode**

Toggle via the ThemeToggle. Save as `inspector-*-light.png`.

**Step 4: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add docs/design-system/after/inspector-*.png && \
git commit -m "Capture Phase 6 inspector screenshots"
```

---

### Task 10: Phase 6 completion summary

**Files:**
- Create: `docs/plans/2026-04-15-aquasim-v2-phase-6-COMPLETE.md`

**Step 1: Write the summary**

```markdown
# Phase 6 Complete — Inspector Redesign with Inline Calculation Records

**Completed:** YYYY-MM-DD
**Branch:** v2-proposal-generator
**Commits:** ~6-10

## What shipped
- `apps/web/components/inspector/` restructured from a single file into:
  - `InspectorPanel.tsx` — thin orchestrator, ~150 lines
  - `InspectorSection.tsx` — shared section wrapper
  - `WarningsSection.tsx`, `SizingSection.tsx`, `EnergySection.tsx`, `ConsumablesSection.tsx`, `CalculationRecordsSection.tsx`, `BoqSection.tsx` — one component per v2 field
  - `CalculationRecordCard.tsx` — renders one calc record (equation + inputs + result + citation)
  - `WaterQualityTable.tsx` — extracted from the old monolith
- Inspector now surfaces all v2 outputs: warnings, sizing, energy, consumables, calculation records, BoQ, water quality
- Every calculation record displays its equation, named inputs with values and sources, result, and citation
- Empty state uses Phase 5 `EmptyState` primitive
- All files use Phase 5 design tokens — zero hardcoded colors
- Tablet Sheet collapse from Phase 5 still works

## Verification state
- Sim-engine tests: 118 passing (unchanged)
- Design-library tests: 16 passing (unchanged)
- Combined: **134 passing** (unchanged — Phase 6 is UI rendering of data sim-engine already produces)
- Type check: clean
- Web build: clean, 12 routes
- Hardcoded-color grep: clean
- Manual smoke test: BioreactorAerobic shows sizing, energy, 4+ calculation records, civil + diffuser BoQ lines
- Dark + light mode both readable
- Before/after screenshots committed

## Deviations from plan
<list any>

## Next: Phase 7
Proposal view + PDF generation. New `/project/[id]/proposal/[fsid]` route that
renders a live design document with all 11 proposal sections. Uses the
inspector components as read-only embeds for the Sizing Calculations section.
Browser print-to-PDF for v1. Deletes the old ResultsPanel.

Draft plan: `docs/plans/YYYY-MM-DD-aquasim-v2-phase-7-proposal-view.md`
```

**Step 2: Commit**
```bash
cd /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone && \
git add docs/plans/2026-04-15-aquasim-v2-phase-6-COMPLETE.md && \
git commit -m "Phase 6 complete — inspector redesign with calculation records"
```

**Step 3: Do NOT merge to main.** Branch stays for Phase 7.

---

## Summary of commits expected for Phase 6

| # | Task | Commit message |
|---|---|---|
| 0 | Baseline | (no commit) |
| 1 | Extract WaterQualityTable | `Extract WaterQualityTable into its own file` |
| 2 | CalculationRecordCard | `Add CalculationRecordCard — equation + inputs + result + citation renderer` |
| 3 | Section components | `Add inspector section components for v2 output fields` |
| 4 | Orchestrator rewrite | `Rewrite InspectorPanel as a thin orchestrator over v2 section components` |
| 5 | Sheet verification | (no commit unless fixes needed) |
| 6 | Smoke test polish | (any scoped fix commits) |
| 7 | Token audit | `Inspector: final token audit pass` (if any fixes) |
| 9 | Screenshots | `Capture Phase 6 inspector screenshots` |
| 10 | Summary | `Phase 6 complete — inspector redesign with calculation records` |

Total: ~6-10 commits on top of Phase 5. Test count unchanged (134). Branch ready for Phase 7.

---

## Notes for the executor

1. **Phase 6 is pure frontend.** No sim-engine changes. No schema changes. No new tests (the data already flows from Phases 1a-3).

2. **The orchestrator-plus-sections pattern is deliberate.** Each section component takes ONE slice of `ProcessResult` as props and short-circuits to `null` when that slice is empty. The orchestrator doesn't conditionally wrap — it just renders every section and lets them decide.

3. **The `EnergySection` has a special case**: BioreactorAerobic intentionally emits `installedKW = 0` per Phase 1b (the blower is a separate unit). The section hides itself in that case. If all three conditions (`installedKW === 0 && dailyKWh === 0 && records.length === 0`) are true, render nothing.

4. **Metadata fallback**: The old `metadata` field still exists on some units. Show it in a collapsible "Metadata" section ONLY when `calculationRecords` is empty — it's a soft migration path, not a permanent feature. When a unit adopts real records (Phase 1b did most of this), metadata disappears automatically.

5. **Calculation record result formatting**: Use the provided `formatResult()` helper — it picks precision based on magnitude, so `187.5 m³` shows as `187.50` but `0.0145` shows as `1.45e-2`. Don't override this per-unit; consistent formatting across the app matters.

6. **Currency formatting**: Use `toLocaleString('en-ZA', { maximumFractionDigits: 0 })` for ZAR amounts. A R1,000,000 BoQ line reads as `R1,000,000` — no decimals because nobody cares about cents at capex scale.

7. **If a test user is not available** for smoke testing, drag units onto a blank canvas manually. The flowsheet-store should let you create a node without persistence for a visual check.

8. **Handle MBR's two output streams**: MBR emits `outputs: { permeate, reject }`. The Output Streams section handles this already via `Object.entries(nodeResult.outputs)` — verify it renders both handles with their Badge labels during the smoke test.

9. **No KaTeX for now.** Equations are plain strings. If the engineer's eyes need them pretty, that's a later polish with KaTeX or MathJax — but it adds a dep and Phase 6 prefers simplicity.

10. **If a section looks too dense on small screens**, don't redesign it in Phase 6. Note the issue and let Phase 7 / 8 tidy up. Phase 6's goal is completeness of content, not pixel perfection.
