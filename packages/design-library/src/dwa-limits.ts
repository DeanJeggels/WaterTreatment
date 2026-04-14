/**
 * South African discharge standards under the National Water Act, 1998.
 * Two tiers: General Limits (less strict) and Special Limits (sensitive waters).
 * Source: National Water Act (Act 36 of 1998), General Authorisations, DWA
 */

export interface DwaDischargeStandard {
  /** mg/L */
  COD?: number;
  /** mg/L */
  BOD5?: number;
  /** mgN/L — ammonia as N */
  NH3N?: number;
  /** mgN/L — nitrate+nitrite as N */
  NO3N?: number;
  /** mg/L */
  TSS?: number;
  /** mgP/L — orthophosphate as P */
  TP?: number;
  /** pH minimum */
  pH_min?: number;
  /** pH maximum */
  pH_max?: number;
  /** Electrical conductivity, mS/m — above background */
  EC?: number;
  /** Faecal coliforms per 100 mL */
  faecalColiforms?: number;
  /** Free chlorine, mg/L */
  freeChlorine?: number;
  /** Fluoride, mg/L */
  fluoride?: number;
  /** Oil & grease, mg/L */
  oilAndGrease?: number;
  /** Bibliographic citation for this tier */
  source: string;
}

export const DWA_LIMITS: Record<'General' | 'Special', DwaDischargeStandard> = {
  General: {
    COD: 75,
    NH3N: 6,
    NO3N: 15,
    TSS: 25,
    TP: 10,
    pH_min: 5.5,
    pH_max: 9.5,
    EC: 70,
    faecalColiforms: 1000,
    freeChlorine: 0.25,
    fluoride: 1,
    oilAndGrease: 2.5,
    source:
      'DWA General Limit, National Water Act (Act 36 of 1998), General Authorisation Notice 665 of 2013',
  },
  Special: {
    COD: 30,
    NH3N: 2,
    NO3N: 1.5,
    TSS: 10,
    TP: 1,
    pH_min: 5.5,
    pH_max: 7.5,
    EC: 50,
    faecalColiforms: 0,
    freeChlorine: 0,
    fluoride: 1,
    oilAndGrease: 0,
    source:
      'DWA Special Limit, National Water Act (Act 36 of 1998), General Authorisation Notice 665 of 2013',
  },
};

export function getDwaLimits(tier: 'General' | 'Special'): DwaDischargeStandard {
  return { ...DWA_LIMITS[tier] };
}
