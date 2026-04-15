# Phase 1b Complete — Real Values for the 10 Existing Units

**Completed:** 2026-04-14
**Branch:** v2-proposal-generator
**Commits:** 12 (see `git log main..HEAD` — Phase 1b range begins at `a0a3603`)

## What shipped
- Each of the 10 existing unit models now emits real v2 outputs with citations:
  - **Influent, Effluent, Splitter, Mixer** — calculation records (utility units, no sizing/BoQ)
  - **Primary Clarifier** — SOR-based sizing + civil + scraper BoQ + records
  - **Secondary Clarifier** — SOR + SLR checks + civil + scraper BoQ + records
  - **Thickener** — SLR-based sizing + civil + picket fence drive BoQ + records (added `surface_area`, `depth` params)
  - **Bioreactor Anaerobic** — HRT + volume + civil + submersible mixer BoQ + mixing energy + records
  - **Bioreactor Anoxic** — HRT + denitrification capacity `Dp1` + civil + mixer BoQ + mixing energy + records
  - **Bioreactor Aerobic** — HRT + MLSS check + O₂ demand records + civil + fine-bubble diffuser BoQ (blower sized separately in Phase 2)
- Supplier prices inlined as `const` blocks with citations (3 kinds of source: CH-ISE internal estimate, typical SA supplier quote, specific datasheet)
- 74 passing tests (61 from Phase 1a + 13 new Phase 1b tests)
- Type check clean, web build clean (12 routes)

## Deferred (not this phase)
- Aeration blower as a standalone unit → Phase 2
- Plant-wide Marais-Ekama sizing pre-calculation → later
- Extract inline supplier prices to `packages/design-library` → Phase 3
- Persisting BoQ line items to Supabase → Phase 4
- PlantContext threading through `process()` → later if needed

## Integration test
Full conventional AS train (Influent → Primary → Aerobic → Secondary → Effluent)
produces total CapEx > ZAR 1m, >10 calculation records across nodes, and every
record is structurally valid with a non-empty citation.

## Next: Phase 2
Add the 9 new unit types for a complete biological plant:
screens, grit, equalisation tank, MBR, aeration blower, dewatering,
chemical dosing, UV disinfection, inlet pumping.
