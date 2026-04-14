/**
 * Typical raw-sewage water quality for South African municipal WWTPs.
 * These values prefill the Influent unit's parameters when a user creates
 * a new project without sample data.
 *
 * Source: WWTP Design.xlsm (0. Water Samples sheet — example typical SA sewage)
 * cross-referenced with WRC reports and typical SA plant audits.
 */

export interface TypicalInfluent {
  /** Design flow, m³/d — just a placeholder; user always overrides */
  flow: number;
  pH: number;
  /** mgN/L */
  TKN: number;
  /** mgN/L — free and saline ammonia */
  FSA: number;
  /** mgN/L */
  NO3N: number;
  /** mg/L — total COD */
  COD: number;
  /** mg/L — 0.45 μm filtered COD */
  CODfiltered: number;
  /** mg/L — total suspended solids */
  TSS: number;
  /** mg/L — total dissolved solids */
  TDS: number;
  /** mgP/L — total phosphorus */
  TP: number;
  /** mgP/L — orthophosphate */
  OP: number;
  /** mgS/L — sulphate */
  SO4: number;
  /** mg/L as CaCO3 */
  alkalinity: number;
  /** mg/L — fats, oil, grease */
  FOG: number;
  source: string;
}

export const SA_TYPICAL_INFLUENT: TypicalInfluent = {
  flow: 1000,
  pH: 7.5,
  TKN: 65,
  FSA: 49,
  NO3N: 0,
  COD: 800,
  CODfiltered: 240,
  TSS: 350,
  TDS: 800,
  TP: 12,
  OP: 7.2,
  SO4: 100,
  alkalinity: 200,
  FOG: 10,
  source: 'WWTP Design.xlsm example typical SA sewage; WRC Report TT-16/84',
};
