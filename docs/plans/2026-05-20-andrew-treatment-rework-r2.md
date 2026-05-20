# Treatment Rework Round 2 — Implementation Plan

> **For Claude:** Executed subagent-driven in the same session. Engine/simulator tasks get full spec + code review; pure-UI tasks get a single verification pass.

**Goal:** Second iteration on AquaSim treatment design based on Dean's hands-on feedback:
1. Recycle becomes a **line the user draws** with the ratio living **on the edge** (4, 6, etc.), replacing the baked-in IMLR handle on the aerobic.
2. The standalone Aeration Blower box is removed; **process-air blower sizing folds into the aerobic reactor** (computed from its O₂ demand). The MBR keeps its own air-scour blower.
3. Inlet Pumping is removed from the palette.
4. Chemical Dosing + UV can be **dropped onto a stream** (inline edge splice) instead of placed as loose boxes.
5. A visible **Delete** affordance (button + node hover trash); keyboard Delete/Backspace already works.

**Branch:** continue on `andrew-treatment-rework` (PR #1 open). These commits reflect the design evolving from Dean's testing. Baseline at start: 130 sim-engine tests green, `tsc --noEmit` clean on apps/web.

**Conventions:** same as round 1 — `feat:`/`fix:`/`refactor:` prefixes, no Co-Authored-By trailers, run sim-engine tests via `cd packages/sim-engine && npx vitest run`, type-gate apps/web via `npx tsc --noEmit` (note: `next build` is environmentally broken at SWC fetch, not our concern).

---

## Recycle semantics (the load-bearing design decision)

A **recycle edge** = any edge the topological sort already flags as a back-edge (creates a loop). The user makes one simply by drawing a connection that loops upstream (e.g. `aerobic.out → anoxic.in`, or `mbr.reject → anoxic.in`).

Each recycle edge carries `data.recycleRatio` (number, default **4**, user-editable, typical 4–6 for IMLR, 0.5–1 for RAS).

**Flow rule:**
- `Q_basis` = total plant raw influent = sum of all `influent` node output flows (fixed per run).
- `Q_recycle (on the edge) = recycleRatio × Q_basis`.
- Recycle edge **water quality = the source handle's output concentrations** (same concentrations, scaled flow).
- **Mass-balance tap:** for the source handle feeding a recycle edge, the forward (non-recycle) edges from that same handle receive `flow = sourceOutput.flow − Σ(recycle flows from that handle)`, concentrations unchanged. If the remainder would go negative, clamp to 0 and push a warning ("recycle ratio exceeds available flow").

**Why this converges fast:** `Q_basis` is constant, so the recycle flow is pinned across iterations. Only concentrations iterate. Worked example (a=4, Q_in=1000): anoxic sees 1000+4000=5000; aerobic out total=5000; recycle taps 4000; forward to MBR = 5000−4000 = 1000 = Q_in. ✓ Mass balance closes, no geometric blow-up (the bug that bit round 1's baked formula).

This generalises: IMLR (from aerobic, ratio 4–6) and RAS (from a clarifier underflow, ratio ~0.5–1) both use the same mechanism. More flexible than the baked aerobic handle, which is why we're replacing it.

---

## Task R1: Replace baked-in IMLR with edge-based recycle (ENGINE — full review)

**Files:**
- Modify: `packages/sim-engine/src/units/bioreactor-aerobic.ts` — remove the `imlr` handle, `imlr_ratio` param, the `imlr` output, the `IMLR_ratio`/`IMLR_flow` metadata, and the IMLR_flow CalculationRecord. Aerobic returns to `in`/`out` only. (Keep `flow_for_O2` in metadata for now; R2 decides its fate.)
- Modify: `packages/sim-engine/src/graph/topological-sort.ts` — extend `GraphEdge` with optional `recycleRatio?: number`.
- Modify: `packages/sim-engine/src/graph/simulator.ts` — implement the recycle flow rule + mass-balance tap (see semantics above). Compute `Q_basis` from influent nodes. In the output-distribution loop, group a node's outgoing edges by `sourceHandle`; for each handle, split into recycle vs forward; recycle edges get `recycleRatio × Q_basis` with source concentrations; forward edges get the tapped remainder.
- Modify: `apps/web/stores/simulation-store.ts:45-51` — carry the ratio through: `recycleRatio: (e.data as { recycleRatio?: number } | undefined)?.recycleRatio`.
- Modify: `packages/sim-engine/src/units/index.ts` if needed; export a `detectRecycleEdges(nodes, edges)` helper from the package public surface (`packages/sim-engine/src/index.ts`) so the UI can flag recycle edges identically to the engine. Implement it as a thin wrapper over `topologicalSort(...).recycleEdges`.
- Tests:
  - `packages/sim-engine/tests/units.test.ts` — remove the now-invalid `'emits an imlr output stream...'` test and the essential-set assertion that listed `imlr_ratio` among aerobic advanced params (update the aerobic essential test if it referenced imlr_ratio — it asserted `['volume','srt']` essential, which still holds; just make sure no test references the removed param).
  - `packages/sim-engine/tests/simulator.test.ts` — rewrite the BNR-MBR integration test to use a **recycle edge** instead of the imlr handle: `aerobic.out → anoxic.in` with `recycleRatio: 4`. Assert `converged === true`, `iterations < 50`, forward flow into MBR ≈ raw influent, and the recycle edge state flow ≈ 4 × influent. Add a second assertion that mass balance error is small.

**TDD order:** write the rewritten integration test first (it will fail since the simulator doesn't yet tap), implement the simulator rule, get it green, then strip the aerobic IMLR code and fix up unit tests.

**Commit:** `feat(recycle): edge-based recycle with ratio, replacing baked aerobic IMLR`

---

## Task R2: Fold process-air blower into the aerobic reactor (ENGINE — full review)

**Files:**
- Modify: `packages/sim-engine/src/units/bioreactor-aerobic.ts` — using the O₂ demand it already computes (`o2TotalKgPerD`), compute process-air blower sizing with the SAME formula currently in `aeration-blower.ts:35-42`:
  - `q_air = (o2_kg × 1000) / (0.21 × 1.421 × ote × 24 × 1000)` (Am³/hr)
  - `deltaP_kPa = diffuser_depth × 9.81 + 15`
  - `installedKW = (q_air × deltaP_Pa) / (3600 × 1000 × 0.72)`
  - Use the aerobic's existing `depth` param for submergence and a fixed `ote = 0.08` (or add an advanced `ote` param defaulting 0.08). Keep it simple: reuse `depth`, hard-code OTE 0.08 with an advanced override param `ote`.
  - Populate `base.energy.installedKW` + `dailyKWh` (currently 0 on the aerobic), add `airFlow` + `blowerKW` to `base.sizing`, add a blower capex line item (PD blower if ≤50 kW else HST turbo — reuse the `getPrice('pd_blower_small')` / `getPrice('hst_turbo_blower')` selection from `aeration-blower.ts:44-48`), and add a "Process air blower" CalculationRecord citing "WWTP Design.xlsm sheet 6 / ASCE 2-06".
- The standalone `AerationBlower` unit stays in the engine (backward compat for old flowsheets) but is removed from the palette in R3. The `aerobic_link` / `UpstreamContext` plumbing from round-1 Task 2 is now redundant for the folded path; **leave it in place** (harmless, still works for any legacy blower node) to minimise churn and risk.
- Tests: `packages/sim-engine/tests/units.test.ts` BioreactorAerobic block — assert that with a normal influent the aerobic now returns `energy.installedKW > 0`, `sizing.airFlow.value > 0`, and a capex line item whose description contains "blower". Confirm the aerobic essential-param test still passes (`['volume','srt']`).

**Commit:** `feat(aerobic): fold process-air blower sizing into the reactor (from O2 demand)`

---

## Task R3: Remove Aeration Blower + Inlet Pumping from the palette (UI — single-pass verify)

**Files:**
- Modify: `apps/web/components/canvas/UnitPalette.tsx` — add a `const PALETTE_HIDDEN: Set<UnitType> = new Set(['aeration_blower', 'inlet_pumping']);` and filter them out inside `groupUnits()` (skip any type in the set). The units remain in `unitDefinitions` so saved flowsheets still load and simulate.

**Verify:** `npx tsc --noEmit` clean; visually the palette no longer lists those two.

**Commit:** `refactor(palette): hide aeration blower and inlet pumping units`

---

## Task R4: Recycle edge UI — visual marker + ratio editor (UI — full review, pairs with R1)

**Files:**
- Modify: `apps/web/stores/flowsheet-store.ts` — add `updateEdgeData(id: string, data: Record<string, unknown>)` that merges into `edge.data` and marks dirty. On `onConnect`, default new edges to `data: { recycleRatio: 4 }` is NOT right (most edges aren't recycles); instead leave data empty and let the inspector default to 4 when the edge is a detected recycle.
- Modify: `apps/web/components/canvas/Canvas.tsx` — wire `onEdgeClick` → `selectEdge(edge.id)`. Compute the set of recycle edge ids via the exported `detectRecycleEdges` helper and pass a derived styling: recycle edges render dashed, distinct stroke (e.g. amber), with a label `↻ {ratio}×`. Use React Flow's per-edge `style` / `label` by mapping over `edges` before passing to `<ReactFlow>` (do not mutate store edges; derive a display array).
- Modify: `apps/web/components/inspector/InspectorPanel.tsx` — when `selectedEdgeId` is set: if the edge is a detected recycle, show a small "Recycle line" section with a `Recycle ratio (× influent)` number input (min 0, max 10, step 0.5, default 4) bound to `updateEdgeData(edgeId, { recycleRatio: val })`. If the selected edge is NOT a recycle, show a short hint that only looping edges carry a ratio. The existing no-node EmptyState path needs to coexist with edge-selection — render edge config when `selectedEdgeId && !selectedNodeId`.

**Verify + review:** `npx tsc --noEmit` clean. Manually: draw `aerobic.out → anoxic.in`, confirm it renders dashed with `↻ 4×`, click it, change to 6, confirm the label updates and a re-run uses 6× (recycle edge flow = 6 × influent).

**Commit:** `feat(recycle): edge ratio editor and dashed recycle styling`

---

## Task R5: Delete affordance (UI — single-pass verify)

**Files:**
- Modify: `apps/web/stores/flowsheet-store.ts` — add `deleteNode(id)` (removes the node and any edges touching it; clears selection if it was selected; marks dirty) and `deleteEdge(id)`.
- Modify: `apps/web/components/inspector/InspectorPanel.tsx` — when a node is selected, render a small destructive "Delete unit" button in the header that calls `deleteNode(selectedNodeId)`. When a recycle edge is selected, a "Delete line" button calling `deleteEdge`.
- Modify: `apps/web/components/canvas/custom-nodes/ProcessUnitNode.tsx` — add a small trash icon button visible on hover (top-right of the node) that calls `deleteNode(id)`. Use `lucide-react` `Trash2`. Stop propagation so it doesn't also select.

**Verify:** keyboard Delete/Backspace still removes selected nodes/edges (already works via `applyNodeChanges`/`applyEdgeChanges`); the new button + hover trash also work; deleting a node removes its edges.

**Commit:** `feat(canvas): visible delete affordances for units and lines`

---

## Task R6: Inline insertion — drop Chemical Dosing / UV onto a stream (UI — full review)

**Files:**
- Modify: `apps/web/stores/flowsheet-store.ts` — add `spliceNodeOntoEdge(unitType, position, edgeId)`: creates the new node at `position`, removes `edgeId`, and adds two edges `source→newNode(in)` and `newNode(out)→target` preserving the original source/target handles. Mark dirty. Return the new node id.
- Modify: `apps/web/components/canvas/Canvas.tsx` — in `onDrop`, after computing the flow `position`: if `unitType` is `chemical_dosing` or `uv_disinfection`, find the nearest edge whose geometric segment (between source node and target node centers, via `reactFlowInstance.getNode`) is within ~40px of `position`; if found, call `spliceNodeOntoEdge(unitType, position, nearestEdgeId)` instead of `addNode`. Otherwise fall back to `addNode`. Implement a small `distanceToSegment(p, a, b)` helper.
- Optional polish (only if cheap): when dragging a splice-able unit, highlight the nearest edge. HTML5 drag doesn't fire edge mouse events, so skip unless trivial.

**Verify + review:** `npx tsc --noEmit` clean. Manually: with an `aerobic → mbr` edge present, drag Chemical Dosing onto that line; confirm it splices to `aerobic → chemical_dosing → mbr`. Dropping on empty canvas still just places the box.

**Commit:** `feat(canvas): splice chemical dosing / UV onto a stream by drop`

---

## Task R7: Final pass

- `cd packages/sim-engine && npx vitest run` — all green (expect ≥130, minus the removed imlr test, plus the rewritten recycle integration test).
- `cd apps/web && npx tsc --noEmit` — clean.
- Final whole-diff code review (focus: recycle mass-balance correctness across a multi-recycle flowsheet, e.g. IMLR + RAS together; splice edge-case when dropping on a node vs an edge; delete removing dangling edges).
- Manual E2E checklist (if SWC permits a dev server; otherwise note for Dean):
  - Draw a BNR-MBR plant, add a recycle line aerobic→anoxic at 6×, run, confirm convergence + Design Summary shows aerobic blower kW + MBR scour kW + reactor sizes + effluent quality.
  - Splice UV onto the MBR→effluent line.
  - Delete a unit via button + via Backspace.
- **Stop before pushing.** Ask Dean whether to update PR #1 or open a new PR.

---

## Open questions / deferred

- **Multi-forward-edge tap:** if a source handle feeds two forward edges AND a recycle, each forward edge currently gets the full tapped remainder (matches the existing simulator's per-handle duplication behaviour). True flow-splitting across multiple forward edges is deferred.
- **Recycle ratio basis:** ratio is × raw plant influent (textbook IMLR/RAS convention). If Andrew's sheet defines it relative to forward flow into the target unit instead, it's a one-line change in the simulator's `Q_basis`.
- **`flow_for_O2` / `aerobic_link` / `UpstreamContext`:** left in place after R2 folds the blower in. If a later cleanup pass confirms no legacy flowsheet relies on a standalone blower node, these can be removed.
