# AquaSim v3 — MVP Implementation Plan

> **For Claude:** Execute task-by-task. Architecture decision + full design live in the Obsidian vault:
> `CH-ISE/BioWin Clone/AquaSim v3 — MVP Architecture.md`. Read that first (use the `obsidian` CLI).
> Engineering-object schema detail: `CH-ISE/BioWin Clone/AquaSim v3 — Engineering Object Schema.md`.

**Strategy:** Extend `biowin-clone` in place. Four new headless, LLM-free, vitest-tested packages
(`@repo/object-model`, `@repo/layout-engine`, `@repo/auto-design`, `@repo/export-kit`) + one route, one tab,
one toggle, one Supabase `design_packages` table. The wizard emits an ordinary `{nodes,edges}` flowsheet so it
reuses the entire tested sim → BoQ → compliance chain; the v2 manual canvas keeps working untouched.

# AquaSim v3 — Phased Implementation Plan
# Input-Form → Automated Preliminary WWTP Design Package (MVP)

Repo: /Users/deanjeggels/Documents/CH-ISE/Test/biowin-clone
Strategy: EXTEND biowin-clone in place. Four new headless, LLM-free packages
(@repo/object-model, @repo/layout-engine, @repo/auto-design, @repo/export-kit)
+ one route, one tab, one toggle, one Supabase table.

## HARD CONSTRAINTS (apply throughout)
- DETERMINISTIC, RULE-BASED CALCULATIONS ONLY. No LLM/AI in any calc, sizing,
  geometry derivation, tagging, layout, or export path.
- @repo/sim-engine + @repo/design-library are FROZEN MATH. Reuse verbatim;
  never re-derive an engineering number outside them.
- The four new packages MUST NOT import @supabase/* or any LLM SDK. Enforce via
  lint rule (Phase 0, T0.4). Only apps/web touches Supabase.
- object-model-first: EngineeringObject / DesignPackage JSON is the versioned
  spine; layout, all exports, and every future module are CONSUMERS of it.
- JSON export is the 3D/BIM SOURCE OF TRUTH; PDF/Excel are lossy projections of
  the same persisted package.
- MVP EXCLUDES: structural/civil detailing, electrical detail design, P&ID,
  construction drawings, server-rendered PDF. MLE train only in Phase 1.
- TDD for anything calc-adjacent (marked [TDD]). Tests mirror
  packages/sim-engine/tests/ (vitest). Keep commits SMALL — one task = one commit.

Conventions used below:
- "verify" = the exact command/observation proving the task is done.
- Each task lists FILES (create/modify), WHAT, VERIFY.
- camelCase sizing keys are authoritative: surfaceArea, volume, depth, MLSS,
  airFlow, blowerKW, deltaP, tankVolume, dailyConsumption.

────────────────────────────────────────────────────────────────────────────
## PHASE 0 — Scaffold + EngineeringObject types (ship nothing, lock boundaries)
Goal: four empty-but-wired packages, the schema, the route/tab/toggle stubs,
and the lint guard. No behavior change to v2.

### T0.1 — Scaffold four workspace packages
FILES (create):
  packages/object-model/{package.json,tsconfig.json,vitest.config.ts,src/index.ts}
  packages/layout-engine/{package.json,tsconfig.json,vitest.config.ts,src/index.ts}
  packages/auto-design/{package.json,tsconfig.json,vitest.config.ts,src/index.ts}
  packages/export-kit/{package.json,tsconfig.json,vitest.config.ts,src/index.ts}
WHAT: Copy package.json/tsconfig shape from packages/sim-engine. Names:
  @repo/object-model, @repo/layout-engine, @repo/auto-design, @repo/export-kit.
  Deps: object-model→@repo/sim-engine; layout-engine→@repo/object-model + @repo/design-library;
  auto-design→all three + @repo/sim-engine; export-kit→@repo/auto-design + @repo/sim-engine.
  Each src/index.ts exports a `const ok = true` placeholder.
VERIFY: `pnpm install` resolves; `pnpm -r typecheck` passes; `pnpm -r test`
  runs (0 tests OK).

### T0.2 — Coordinate system + base EngineeringObject types  [TDD]
FILES (create):
  packages/object-model/src/types.ts
  packages/object-model/src/coordinate-system.ts
  packages/object-model/tests/types.test.ts
WHAT: Author CoordinateSystem, ObjectClass, Discipline, Geometry, Placement,
  Port, SourceCalc, EngineeringObject base + ObjectParams discriminated union
  (TankParams|PumpParams|BlowerParams|ScreenParams|DosingSkidParams|
  GenericEquipmentParams for MVP; defer valve/instrument/pipe to Phase 2).
  Import Dimension, CalculationRecord, UnitType from @repo/sim-engine. Export
  SCHEMA_VERSION = '1.0.0'.
VERIFY (test first): a fixture EngineeringObject literal typechecks; a zod parse
  of a valid object passes and an invalid one (class/params mismatch) fails.

### T0.3 — zod validator + published JSON contract  [TDD]
FILES (create):
  packages/object-model/src/schema.ts        (zod schemas mirroring types.ts)
  packages/object-model/src/index.ts          (re-export types + validators)
  packages/object-model/tests/schema.test.ts
WHAT: `engineeringObjectSchema`, `designPackageSchema`, `parseDesignPackage()`.
  This is the contract every downstream tool pins to.
VERIFY: `pnpm --filter @repo/object-model test` green; round-trip
  parse(stringify(pkg)) deep-equals pkg for a fixture.

### T0.4 — Lint guard: no Supabase/LLM imports in the four packages
FILES (modify): packages/eslint-config/* (add no-restricted-imports rule)
  or add a root vitest "boundary" test scanning package src for forbidden imports.
WHAT: Forbid `@supabase/*`, `openai`, `@anthropic-ai/*`, `ai` inside the four
  new packages. Encodes the deterministic-no-AI-in-calcs constraint mechanically.
VERIFY: add a temp `import '@supabase/supabase-js'` to object-model → lint fails;
  remove → lint passes. Commit only the passing state.

### T0.5 — Route/tab/toggle stubs (additive, no logic)
FILES:
  create app/project/[id]/design/[flowsheetId]/page.tsx (renders "Design — coming soon")
  modify components/layout/project-editor-tabs.tsx (add 3rd "Design" tab, Wand2 icon)
  modify app/project/new/page.tsx (add "Guided / Blank" toggle; Blank = current behavior)
WHAT: Wire the surface so it coexists with Flowsheet|Proposal tabs. Guided toggle
  currently routes to the stub.
VERIFY: `pnpm --filter web dev`; open a project → Design tab visible, loads stub;
  Flowsheet + Proposal tabs unchanged; New Project toggle renders.

### T0.6 — design_packages migration (additive)
FILES (create): supabase/migrations/2026xxxx_aquasim_v3_design_packages.sql
WHAT: Table per design doc §7 (project_id, flowsheet_id, version, schema_version,
  inputs jsonb, package jsonb, plant_type, compliance_pass, generated_by,
  pdf_url, export_url, unique(flowsheet_id,version)) + RLS keyed on
  projects.owner_id / is_org_member(org_id) + indexes on (project_id),(flowsheet_id).
VERIFY: apply to a Supabase branch; `list_tables` shows design_packages with RLS
  enabled; insert as owner succeeds, insert as non-owner is denied.

COMMIT POINTS: one commit per task T0.1…T0.6.

────────────────────────────────────────────────────────────────────────────
## PHASE 1 — Project-input form + validation
Goal: the form entered ONCE, fully validated, producing a clean DesignInputs.

### T1.1 — DesignInputs type + presets from design-library
FILES (create): packages/auto-design/src/inputs.ts
WHAT: DesignInputs type (project meta, designFlowM3d, peakFactor, influent quality,
  dischargeStandard tier, siteArea, siteBoundary?, plantType, preferences).
  `defaultInputs(tier)` seeds from SA_TYPICAL_INFLUENT + getDwaLimits(tier) (REUSE).
VERIFY: typecheck; `defaultInputs('General')` returns influent + effluent targets
  matching getDwaLimits('General').

### T1.2 — validateInputs (range + cross-field)  [TDD]
FILES (create):
  packages/auto-design/src/validate.ts
  packages/auto-design/tests/validate.test.ts
WHAT: ValidationResult. Range floor/ceiling REUSE sim-engine parameterSchema
  min/max. NEW cross-field rules: peakFactor≥1; designFlow>0; effluentTarget≤influent;
  sCOD≤COD; NH3N≤TKN; siteArea>Σ(unit footprint sanity). Deterministic, pure.
VERIFY (tests first): table of valid/invalid input cases → expected errors[];
  green. No network, no AI.

### T1.3 — Wizard form UI (client)
FILES:
  create app/project/[id]/design/[flowsheetId]/_components/design-wizard.tsx
  modify app/project/[id]/design/[flowsheetId]/page.tsx (render wizard)
WHAT: Multi-step form bound to DesignInputs; inline validation surfaces
  validateInputs() errors; presets prefill from T1.1. Submit is disabled until valid.
  No calc here — UI only.
VERIFY: dev server; entering NH3N>TKN shows the cross-field error; valid form
  enables Submit; values round-trip into a DesignInputs object logged to console.

### T1.4 — Persist inputs draft (apps/web only)
FILES: modify the design page to save DesignInputs to design_packages.inputs (draft row).
WHAT: Supabase write lives ONLY in apps/web (constraint). Package stays headless.
VERIFY: submit → row appears in design_packages with inputs populated, package null.

COMMIT POINTS: T1.1, T1.2 (test+impl together), T1.3, T1.4.

────────────────────────────────────────────────────────────────────────────
## PHASE 2 — Auto-design orchestration reusing sim-engine (THE MATH, reused)
Goal: DesignInputs → sized standard train, deterministically, zero new math.

### T2.1 — selectTrain (declarative plantType → UnitType[])  [TDD]
FILES (create):
  packages/auto-design/src/select-train.ts
  packages/auto-design/tests/select-train.test.ts
WHAT: ProcessTopology table. MLE: influent→inlet_pumping→screen→grit_removal→
  equalisation_tank→bioreactor_anoxic→bioreactor_aerobic→secondary_clarifier→
  uv_disinfection→effluent (+ thickener/dewatering sludge line; +chemical_dosing
  if P-removal). Config, NOT math. All UnitTypes already exist in sim-engine.
VERIFY (tests first): selectTrain({plantType:'MLE',pRemoval:true}) === expected
  ordered UnitType[]; snapshot-stable.

### T2.2 — buildGraph (topology → {nodes,edges})  [TDD]
FILES (create):
  packages/auto-design/src/build-graph.ts
  packages/auto-design/tests/build-graph.test.ts
WHAT: Map topology → FlowsheetNodeData {unitType,label,parameters} nodes + edges,
  the SAME shape flowsheet-store addNode builds. Seed influent params from flow +
  influent quality; unit params from defaultParameters. Pure.
VERIFY (tests first): nodes/edges count matches train; influent node carries the
  input flow; graph is a valid DAG (every non-influent node has an inbound edge).

### T2.3 — runAutoDesign stages 1–5 (validate→select→build→simulate→boq)  [TDD]
FILES (create):
  packages/auto-design/src/run.ts
  packages/auto-design/tests/run.test.ts
WHAT: Orchestrate validateInputs → selectTrain → buildGraph → simulate(nodes,edges)
  [REUSE sim-engine] → aggregateBoQ + checkCompliance [REUSE]. Return
  {graph, results, boq, compliance}. NO LLM. Determinism is the contract.
VERIFY (tests first): same DesignInputs → byte-identical results JSON across two
  runs (snapshot test, like packages/sim-engine/tests/simulator.test.ts).
  Compliance verdict present; BoQ grandTotal > 0.

COMMIT POINTS: T2.1, T2.2, T2.3.

────────────────────────────────────────────────────────────────────────────
## PHASE 3 — EngineeringObject instantiation (sized unit → physical, tagged object)
Goal: turn each sized node into a spatial EngineeringObject WITHOUT re-deriving math.

### T3.1 — dimension-deriver (geometry only)  [TDD]
FILES (create):
  packages/object-model/src/dimension-deriver.ts
  packages/object-model/tests/dimension-deriver.test.ts
WHAT: Geometric ONLY. circle: diameterM = √(4·surfaceArea/π);
  rectangle: footprint = volume/depth then 2:1 L:W split; pumps/blowers/dosing →
  standard skid footprints from a lookup table. Reads camelCase sizing keys
  (surfaceArea, volume, depth). Tags outputs "layout geometry assumption" in notes.
  NEVER re-derives a process number.
VERIFY (tests first): surfaceArea=1000 → diameterM≈35.68; volume=5000,depth=4.5
  → footprint area≈1111, L:W≈2:1. Deterministic.

### T3.2 — Tag allocator + material defaults  [TDD]
FILES (create):
  packages/object-model/src/tags.ts
  packages/object-model/src/materials.ts
  packages/object-model/tests/tags.test.ts
WHAT: allocateTag(area,class,seq) → ISA-style AAA-NNNN-SS deterministically
  (same flowsheet → same tags). unitType→material default table. No AI.
VERIFY (tests first): blower area2 unit1 → "BLW-2101-A"; same inputs twice →
  identical tag; aerobic reactor → "BIO-2101-TK".

### T3.3 — instantiateObjects (materialiser)  [TDD]
FILES (create):
  packages/object-model/src/materialise.ts
  packages/object-model/tests/materialise.test.ts
WHAT: Per node: pick class/discipline from unitType; dimension-deriver(sizing)→Geometry;
  allocateTag; material from table; COPY sizing→capacity VERBATIM; COPY
  calculationRecords (+ energy.records)→sourceCalc.records BY VALUE; map sim-engine
  HandleDefs→ports, edges→connections; warnings→designNotes. placement=(0,0,0)/0°.
  This is the linchpin. Rule-based, deterministic, NO AI.
VERIFY (tests first): aerobic node → object with class:'reactor', capacity deep-equals
  nodeResults.sizing, sourceCalc.records deep-equals the node's calculationRecords,
  ports derived from handles. Snapshot-stable.

### T3.4 — Wire stage 6 into runAutoDesign
FILES (modify): packages/auto-design/src/run.ts + tests/run.test.ts
WHAT: Add instantiateObjects after BoQ. Return objects[] in the result.
VERIFY: run.test snapshot shows objects[] length === sized non-stream nodes;
  every object.sourceCalc.nodeId resolves into results.nodeResults.

COMMIT POINTS: T3.1, T3.2, T3.3, T3.4.

────────────────────────────────────────────────────────────────────────────
## PHASE 4 — Rule-based 2D layout engine (centrepiece IP)
Goal: assign placement to every object via reviewable rules; emit violations.

### T4.1 — LAYOUT_RULES data table (versioned in design-library)
FILES (create): packages/design-library/src/layout-rules.ts (+ export it)
WHAT: spacing/access/bunding/separation/safety/bands/flowAxis per design doc §5,
  with `source` provenance string. DATA not code — reviewable in git like
  supplier-prices.ts.
VERIFY: typecheck; imported by layout-engine; values match design doc.

### T4.2 — Spine ordering + banding  [TDD]
FILES (create):
  packages/layout-engine/src/order-and-band.ts
  packages/layout-engine/tests/order-and-band.test.ts
WHAT: REUSE sim-engine topologicalSort for the main line (recycle/back-edges
  excluded → linear spine). Band A sludge(top)/B water(mid)/C chem+elec(bottom).
VERIFY (tests first): MLE objects → water units in band B in topo order; thickener
  in band A; dosing/MCC in band C.

### T4.3 — Greedy pack + relax + fit  [TDD]
FILES (create):
  packages/layout-engine/src/pack.ts
  packages/layout-engine/tests/pack.test.ts
WHAT: place spine L→R at lane centreline (x_next = x_prev+halfW(prev)+clearance+
  halfW(cur)); branch off-spine to nearest served unit; RELAX footprints by access
  clearance to a no-overlap fixpoint; FIT check vs siteBoundary → emit violation
  'site_area_exceeded' (NEVER silently overlap) + recommend MBR. Deterministic greedy.
VERIFY (tests first): no two footprints overlap after relax; ordered x increasing
  along spine; oversize site → violation present; identical inputs → identical
  placements (determinism).

### T4.4 — Bunding, separation, corridors, pipe routes  [TDD]
FILES (create):
  packages/layout-engine/src/zones.ts
  packages/layout-engine/tests/zones.test.ts
WHAT: requiresBunding → bund polygon ≥110% largest vessel; electrical→wet/chemical
  keep-out shifts offenders; insert maintenance corridors (≥3m, ≥4.5m on access
  road edge), every object touches ≥1 corridor; Manhattan pipe polylines between
  matched ports, medium colour-coded. Each placement traces to a named rule.
VERIFY (tests first): dosing skid gets a bund ≥1.1×tank; electrical room ≥ separation
  distance from wet units; rulesApplied[] non-empty and references LAYOUT_RULES.

### T4.5 — layout() entrypoint + writeback + wire stage 7  [TDD]
FILES (create): packages/layout-engine/src/index.ts (layout(objects,edges,site)→PlantLayout)
FILES (modify): packages/auto-design/src/run.ts + tests
WHAT: compose T4.2–T4.4; write placement back onto objects; return
  {corridors,bunds,pipeRoutes,violations,rulesApplied}. Add as stage 7 of run.
VERIFY (tests first): every object.placement is non-default after layout; run.test
  snapshot includes layout block; violations[] is an array (possibly empty).

COMMIT POINTS: T4.1…T4.5.

────────────────────────────────────────────────────────────────────────────
## PHASE 5 — 2D SVG layout renderer (apps/web, presentation only)
Goal: draw the placed layout. NO calc — reads placement/geometry verbatim.

### T5.1 — assembleDesignPackage (stage 8)  [TDD]
FILES (create):
  packages/auto-design/src/assemble.ts
  packages/auto-design/tests/assemble.test.ts
WHAT: Build canonical DesignPackage (meta, coordinateSystem, inputs echo, basis,
  graph, objects, layout, boq, compliance, totals, provenance) per design doc §6.
  Validate with object-model designPackageSchema before returning.
VERIFY (tests first): assemble(runResult) passes parseDesignPackage; totals.footprintM2
  = Σ footprints; provenance.calculations non-empty.

### T5.2 — LayoutSvg component
FILES (create): app/project/[id]/design/[flowsheetId]/_components/layout-svg.tsx
WHAT: Pure render of DesignPackage.layout + objects: rectangles/circles at
  placement scaled to viewBox, tags as labels, corridors/bunds/pipe routes,
  site boundary, violation markers. Reads geometry verbatim; computes nothing.
VERIFY: dev server with a fixture package → recognizable plan; tags legible;
  oversize-site fixture shows the violation marker.

### T5.3 — Wire run-auto-design client adapter
FILES (create): app/project/[id]/design/[flowsheetId]/../../../lib/design/run-auto-design.ts
FILES (modify): the design page
WHAT: Client adapter: call @repo/auto-design runAutoDesign → assembleDesignPackage,
  persist DesignPackage to design_packages.package, hydrate flowsheet-store
  (setNodes/setEdges) as the canvas escape hatch. Supabase ONLY here.
VERIFY: submit valid form → row.package populated; Flowsheet tab opens the same
  graph; LayoutSvg renders the placed plant.

COMMIT POINTS: T5.1, T5.2, T5.3.

────────────────────────────────────────────────────────────────────────────
## PHASE 6 — Design summary + report + exports (JSON canonical; PDF + Excel)
Goal: the deliverables. JSON is source of truth; PDF/Excel are projections of the
SAME persisted package (they can never disagree).

### T6.1 — JSON exporter  [TDD]
FILES (create):
  packages/export-kit/src/to-json.ts
  packages/export-kit/tests/to-json.test.ts
WHAT: to-json = validate + JSON.stringify(pkg). 3D/BIM-ready (geometry+placement+
  ports+material+tag+sourceCalc per object). Pure.
VERIFY (tests first): output re-parses via parseDesignPackage; schemaVersion present.

### T6.2 — JSON download button (apps/web)
FILES (modify): the design page / viewer
WHAT: Download persisted package as Blob. Reads the PERSISTED package, not live store.
VERIFY: click → valid .json downloads; contents === design_packages.package row.

### T6.3 — Viewer: sized-unit table + compliance verdict + totals
FILES (create): app/project/[id]/design/[flowsheetId]/_components/design-summary.tsx
WHAT: Table of objects (tag,type,dims,capacity), compliance pass/fail per parameter,
  totals (capex, installedKW, footprint). Reads package verbatim.
VERIFY: dev server → table matches objects[]; compliance matches package.compliance.

### T6.4 — PDF via print: re-point report sections + 2 new sections
FILES (modify): lib/proposal/sections/01..11 (re-point data source to persisted
  DesignPackage); create sections for "Plant Layout" (inline LayoutSvg) + "Equipment
  Schedule" (table from objects). REUSE window.print() + @media print (globals.css).
WHAT: No new PDF dependency. Render from persisted package, not live store.
VERIFY: print to PDF → 13 sections incl. layout SVG + equipment schedule; numbers
  match the JSON; trace any number to a sourceCalc.records citation.

### T6.5 — Excel exporter (first heavy dep: SheetJS)  [TDD]
FILES (create):
  packages/export-kit/src/to-excel.ts
  packages/export-kit/tests/to-excel.test.ts
WHAT: Sheets: Design Summary · Sizing (row/object) · Equipment Schedule · BoQ
  (iterate boq.lineItemsByCategory verbatim) · Energy · Calculation Trail
  (flatten sourceCalc.records). Pure (returns a workbook buffer).
VERIFY (tests first): workbook has the named sheets; BoQ sheet row count ===
  Σ line items; deterministic for fixed input.

### T6.6 — Excel download button (apps/web)
FILES (modify): the design page / viewer
VERIFY: click → .xlsx opens in Excel with all sheets populated from persisted package.

COMMIT POINTS: T6.1…T6.6 (Excel dep added only at T6.5).

────────────────────────────────────────────────────────────────────────────
## PHASE 7 — Expansion hooks (seams, not full modules)
Goal: prove the JSON spine feeds future modules WITHOUT re-running math.

### T7.1 — Publish JSON Schema artifact
FILES (create): packages/object-model/schema/design-package.schema.json (generated from zod)
WHAT: The integration contract downstream tools (3D, BIM/CAD) pin to. schemaVersion stamped.
VERIFY: schema validates a fixture package; CI fails if types drift from schema.

### T7.2 — Electrical load-list projection (read-only example)
FILES (create): packages/export-kit/src/projections/load-list.ts + test
WHAT: sum params.installedKW per object; connections.medium='power' → MCC mapping.
  Pure read of objects[]; recomputes nothing. Demonstrates the consumer pattern.
VERIFY (test): load-list rows === objects with installedKW; total === Σ.

### T7.3 — 3D-readiness assertion test
FILES (create): packages/object-model/tests/three-d-readiness.test.ts
WHAT: assert every object has geometry+heightM(or diameter)+placement+ports →
  extrudable. Locks the "JSON = 3D/BIM source of truth" guarantee.
VERIFY (test): fixture package passes; removing heightM fails the assertion.

### T7.4 — Document seams in Obsidian
FILES (create/update): vault note linking each future module (civil/mech/elec/
  instrumentation/control/tender/3D/BIM) to the MVP seam that enables it (design doc §8).
VERIFY: note exists; cross-links to the design doc + plan doc.

COMMIT POINTS: T7.1…T7.4.

────────────────────────────────────────────────────────────────────────────
## CROSS-CUTTING NOTES
- Determinism is the headline test everywhere calc-adjacent: same DesignInputs →
  byte-identical objects/layout/JSON. Snapshot-test it (vitest), mirroring
  packages/sim-engine/tests/.
- The constraint "AI never performs/guesses engineering math" is enforced by:
  (a) lint guard T0.4 (no LLM/Supabase imports in the 4 packages),
  (b) sourceCalc copies sim-engine CalculationRecords by value (auditable),
  (c) dimension-deriver is geometry-only and labels its outputs as assumptions.
- First shippable = end of Phase 6 with MLE only. Phase 2 (post-MVP) adds
  MBR/UCT trains, full layout ruleset, richer report.
