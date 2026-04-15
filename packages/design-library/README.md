# @repo/design-library

Single source of truth for AquaSim's WWTP design reference data.

## What lives here
- **Supplier prices** (`supplier-prices.ts`) — ZAR prices for civil, mechanical, electrical, chemicals, and instrumentation BoQ line items. Each entry carries a supplier name, source citation, and last-updated date.
- **DWA limits** (`dwa-limits.ts`) — South African Department of Water Affairs discharge standards (General & Special limits) from the National Water Act.
- **Kinetic constants** (`kinetic-constants.ts`) — Marais-Ekama stoichiometric and kinetic constants with Arrhenius temperature corrections.
- **SA influent defaults** (`defaults.ts`) — Typical raw-sewage water quality for South African municipal plants.

## Update process
Prices and references change over time. To update:
1. Edit the relevant file in `src/`
2. Bump the `lastUpdated` field
3. Add a PR with the source (supplier quote PDF, datasheet, or official document)
4. Merging the PR is the audit trail — every price change is git-reviewable

## Consumed by
- `@repo/sim-engine` — imports prices in each unit model's `calculate()` output
- `apps/web` — imports for the price library browser page (Phase 5) and proposal rendering
