import type { SupplierPriceRef } from './types';

/**
 * The canonical AquaSim supplier price registry. Edit this file to update
 * prices — every change is git-reviewable. Phase 3 extracts all inline
 * prices from unit model files into this registry.
 */
export const SUPPLIER_PRICES: Record<string, SupplierPriceRef> = {
  // === Civil works ===
  civil_concrete_reinforced: {
    id: 'civil_concrete_reinforced',
    description: 'Reinforced concrete tank, civil works',
    unitPriceZar: 18000,
    unit: 'm3',
    category: 'civil',
    supplier: 'CH-ISE internal estimate',
    source: 'CH-ISE internal estimate 2026',
    lastUpdated: '2026-01-15',
    notes: 'Typical SA contractor rate for reinforced rectangular/circular tanks',
  },
  civil_headworks_channel: {
    id: 'civil_headworks_channel',
    description: 'Headworks concrete channel',
    unitPriceZar: 15000,
    unit: 'm3',
    category: 'civil',
    supplier: 'CH-ISE internal estimate',
    source: 'CH-ISE internal estimate 2026',
    lastUpdated: '2026-01-15',
  },
  civil_wet_well: {
    id: 'civil_wet_well',
    description: 'Pump wet well civil works',
    unitPriceZar: 22000,
    unit: 'm3',
    category: 'civil',
    supplier: 'CH-ISE internal estimate',
    source: 'CH-ISE internal estimate 2026',
    lastUpdated: '2026-01-15',
  },

  // === Clarifier scrapers & thickener drive ===
  primary_clarifier_scraper_bridge: {
    id: 'primary_clarifier_scraper_bridge',
    description: 'Primary clarifier rotating scraper bridge',
    unitPriceZar: 280000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Andritz / Tsurumi (typical SA supplier)',
    source: 'Typical SA supplier quote 2025 (Andritz/Tsurumi range)',
    lastUpdated: '2025-11-20',
  },
  secondary_clarifier_scraper_bridge: {
    id: 'secondary_clarifier_scraper_bridge',
    description: 'Secondary clarifier scraper / suction bridge',
    unitPriceZar: 320000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Andritz / Westech (typical SA supplier)',
    source: 'Typical SA supplier quote 2025 (Andritz/Westech range)',
    lastUpdated: '2025-11-20',
  },
  picket_fence_thickener_drive: {
    id: 'picket_fence_thickener_drive',
    description: 'Picket fence thickener drive (~3 kW)',
    unitPriceZar: 180000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Westech / Andritz (typical SA supplier)',
    source: 'Typical SA supplier quote 2025 (Westech/Andritz range)',
    lastUpdated: '2025-11-20',
  },

  // === Bioreactor equipment ===
  submersible_mixer_3kw: {
    id: 'submersible_mixer_3kw',
    description: 'Submersible mixer, 3 kW class (IP68)',
    unitPriceZar: 45000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Grundfos / Xylem Flygt (typical SA supplier)',
    source: 'Typical SA supplier quote 2025 (Grundfos SMD / Xylem Flygt range)',
    lastUpdated: '2025-11-20',
    notes: 'Rule of thumb: one 3 kW mixer per 500 m³ of unaerated reactor volume',
  },
  fine_bubble_diffuser_edi_9in: {
    id: 'fine_bubble_diffuser_edi_9in',
    description: 'Fine bubble diffuser, 9" EDI FlexAir tubular',
    unitPriceZar: 850,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'EDI (via SA distributor)',
    source: 'EDI FlexAir catalogue 2024 / typical SA distributor',
    lastUpdated: '2024-09-01',
    notes: 'Diffuser density rule of thumb: ~1 per 3 m³ of aerobic reactor volume',
  },

  // === Preliminary / headworks (Phase 2) ===
  coarse_bar_screen: {
    id: 'coarse_bar_screen',
    description: 'Coarse mechanical bar rack (small plant)',
    unitPriceZar: 85000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Meva / Huber (typical SA supplier)',
    source: 'Typical SA supplier quote 2025 (Meva/Huber range)',
    lastUpdated: '2025-11-20',
  },
  fine_step_screen_huber_rotamat: {
    id: 'fine_step_screen_huber_rotamat',
    description: 'Fine step screen, Huber ROTAMAT Ro5 or equivalent (small plant)',
    unitPriceZar: 450000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Huber (via SA distributor)',
    source: 'Huber catalogue 2024 / typical SA distributor',
    lastUpdated: '2024-09-01',
  },
  grit_removal_package: {
    id: 'grit_removal_package',
    description: 'Aerated grit chamber — grit pump + cyclone + air diffusers',
    unitPriceZar: 180000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Typical SA supplier',
    source: 'Typical SA supplier quote 2025',
    lastUpdated: '2025-11-20',
  },

  // === MBR (Phase 2) ===
  mbr_smu_module: {
    id: 'mbr_smu_module',
    description: 'Megavision SMU membrane module (~64 m²)',
    unitPriceZar: 625000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Megavision',
    source: 'Megavision quote 2025',
    lastUpdated: '2025-10-15',
    notes: 'Hollow fibre MBR module; design flux 18.4 L/m²/h typical',
  },
  mbr_cip_skid: {
    id: 'mbr_cip_skid',
    description: 'MBR CIP + permeate pump skid',
    unitPriceZar: 380000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Megavision / Memstar (typical)',
    source: 'Megavision / Memstar typical 2025',
    lastUpdated: '2025-10-15',
  },

  // === Aeration blower (Phase 2) ===
  pd_blower_small: {
    id: 'pd_blower_small',
    description: 'Positive displacement blower (15-37 kW class)',
    unitPriceZar: 180000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Aerzen / WEG (typical SA distributor)',
    source: 'Aerzen / WEG SA distributor 2025',
    lastUpdated: '2025-11-01',
  },
  hst_turbo_blower: {
    id: 'hst_turbo_blower',
    description: 'HST turbo blower (50+ kW class)',
    unitPriceZar: 1200000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Sulzer HST / APG Neuros',
    source: 'Sulzer HST / APG Neuros catalogue 2025',
    lastUpdated: '2025-10-01',
    notes: 'Phase 2 AerationBlower selects this above ~50 kW installed',
  },

  // === Sludge dewatering (Phase 2) ===
  belt_press_1m: {
    id: 'belt_press_1m',
    description: 'Belt filter press, 1 m belt width (Andritz SMX or equivalent)',
    unitPriceZar: 850000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Andritz',
    source: 'Andritz SMX catalogue 2024',
    lastUpdated: '2024-09-01',
  },
  decanter_centrifuge_5m3h: {
    id: 'decanter_centrifuge_5m3h',
    description: 'Decanter centrifuge, 5 m³/h throughput',
    unitPriceZar: 2200000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Alfa Laval',
    source: 'Alfa Laval catalogue 2024',
    lastUpdated: '2024-09-01',
  },

  // === Chemical dosing (Phase 2) ===
  metering_pump_diaphragm: {
    id: 'metering_pump_diaphragm',
    description: 'Diaphragm metering pump (Grundfos DDA or equivalent)',
    unitPriceZar: 28000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Grundfos',
    source: 'Grundfos SA catalogue 2025',
    lastUpdated: '2025-10-01',
  },
  hdpe_storage_tank: {
    id: 'hdpe_storage_tank',
    description: 'HDPE chemical storage tank',
    unitPriceZar: 17500,
    unit: 'm3',
    category: 'mechanical',
    supplier: 'Typical SA supplier',
    source: 'Typical SA supplier quote 2025',
    lastUpdated: '2025-11-01',
  },

  // === UV disinfection (Phase 2, tiered) ===
  uv_reactor_small: {
    id: 'uv_reactor_small',
    description: 'LP-HO UV reactor, small (< 500 m³/d)',
    unitPriceZar: 285000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Xylem Wedeco',
    source: 'Xylem Wedeco catalogue 2025',
    lastUpdated: '2025-09-15',
  },
  uv_reactor_medium: {
    id: 'uv_reactor_medium',
    description: 'LP-HO UV reactor, medium (500–1500 m³/d)',
    unitPriceZar: 650000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Xylem Wedeco',
    source: 'Xylem Wedeco catalogue 2025',
    lastUpdated: '2025-09-15',
  },
  uv_reactor_large: {
    id: 'uv_reactor_large',
    description: 'LP-HO UV reactor, large (1500–5000 m³/d)',
    unitPriceZar: 1250000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Xylem Wedeco',
    source: 'Xylem Wedeco catalogue 2025',
    lastUpdated: '2025-09-15',
  },

  // === Inlet pumping (Phase 2, tiered) ===
  submersible_pump_small: {
    id: 'submersible_pump_small',
    description: 'Submersible centrifugal pump, 7.5 kW class',
    unitPriceZar: 35000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Grundfos',
    source: 'Grundfos SE range SA catalogue 2025',
    lastUpdated: '2025-10-01',
  },
  submersible_pump_medium: {
    id: 'submersible_pump_medium',
    description: 'Submersible centrifugal pump, 15 kW class',
    unitPriceZar: 65000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Grundfos',
    source: 'Grundfos SE range SA catalogue 2025',
    lastUpdated: '2025-10-01',
  },
  submersible_pump_large: {
    id: 'submersible_pump_large',
    description: 'Submersible centrifugal pump, 22 kW class',
    unitPriceZar: 95000,
    unit: 'ea',
    category: 'mechanical',
    supplier: 'Grundfos',
    source: 'Grundfos SE range SA catalogue 2025',
    lastUpdated: '2025-10-01',
  },

  // === Disposal / consumables (cost references, not capex) ===
  screenings_landfill_disposal: {
    id: 'screenings_landfill_disposal',
    description: 'Screenings disposal to landfill',
    unitPriceZar: 1500,
    unit: 'm3',
    category: 'chemicals',
    supplier: 'Typical SA landfill operator',
    source: 'Typical SA landfill rate 2025',
    lastUpdated: '2025-11-20',
    notes: 'Consumable/disposal cost, not a capex line — rendered under OpEx',
  },
  grit_landfill_disposal: {
    id: 'grit_landfill_disposal',
    description: 'Grit disposal to landfill',
    unitPriceZar: 800,
    unit: 'm3',
    category: 'chemicals',
    supplier: 'Typical SA landfill operator',
    source: 'Typical SA landfill rate 2025',
    lastUpdated: '2025-11-20',
  },
  cake_landfill_disposal: {
    id: 'cake_landfill_disposal',
    description: 'Dewatered sludge cake disposal to landfill',
    unitPriceZar: 350,
    unit: 't',
    category: 'chemicals',
    supplier: 'Typical SA landfill operator',
    source: 'Typical SA landfill tipping fee 2025',
    lastUpdated: '2025-11-20',
  },
  polymer_cationic_dry: {
    id: 'polymer_cationic_dry',
    description: 'Cationic polymer (dry)',
    unitPriceZar: 65,
    unit: 'kg',
    category: 'chemicals',
    supplier: 'Typical SA supplier',
    source: 'Typical SA supplier quote 2025',
    lastUpdated: '2025-11-01',
  },
  alum_sulphate: {
    id: 'alum_sulphate',
    description: 'Alum (aluminium sulphate)',
    unitPriceZar: 8,
    unit: 'kg',
    category: 'chemicals',
    supplier: 'Typical SA supplier',
    source: 'Typical SA supplier quote 2025',
    lastUpdated: '2025-11-01',
  },
  ferric_chloride: {
    id: 'ferric_chloride',
    description: 'Ferric chloride',
    unitPriceZar: 12,
    unit: 'kg',
    category: 'chemicals',
    supplier: 'Typical SA supplier',
    source: 'Typical SA supplier quote 2025',
    lastUpdated: '2025-11-01',
  },
  hydrated_lime: {
    id: 'hydrated_lime',
    description: 'Hydrated lime',
    unitPriceZar: 4,
    unit: 'kg',
    category: 'chemicals',
    supplier: 'Typical SA supplier',
    source: 'Typical SA supplier quote 2025',
    lastUpdated: '2025-11-01',
  },
  caustic_soda_50pct: {
    id: 'caustic_soda_50pct',
    description: 'Caustic soda (50% solution)',
    unitPriceZar: 10,
    unit: 'kg',
    category: 'chemicals',
    supplier: 'Typical SA supplier',
    source: 'Typical SA supplier quote 2025',
    lastUpdated: '2025-11-01',
  },
};

/**
 * Look up a supplier price by ID. Throws if the ID is unknown — this is
 * intentional: an unknown ID almost always means a typo in a unit model,
 * and a runtime exception surfaces the problem in tests immediately.
 */
export function getPrice(id: string): SupplierPriceRef {
  const entry = SUPPLIER_PRICES[id];
  if (!entry) {
    throw new Error(
      `Unknown supplier price ID: "${id}". Check packages/design-library/src/supplier-prices.ts`,
    );
  }
  return entry;
}

/** Return all prices in a given BoQ category — used by the price library UI */
export function getPricesByCategory(category: SupplierPriceRef['category']): SupplierPriceRef[] {
  return Object.values(SUPPLIER_PRICES).filter(p => p.category === category);
}
