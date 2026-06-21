import type { ProcessUnit, ProcessResult, WaterQuality, UnitDefinition, ParameterField } from '../types';
import { mixStreams, emptyWaterQuality, emptyUnitOutputs } from '../types';
import { getPrice } from '@repo/design-library';
import {
  fractionateCod, kineticsAtT, sludgeMasses, reactorSizing, nitrogenBalance,
  oxygenDemand, aerationTransfer, processAirAm3h, blowerKW as blowerPowerKW,
} from '../kernels';

// Diffuser density rule of thumb: ~1 diffuser per 3 m³ reactor volume (fine bubble grid)
const DIFFUSER_PER_M3 = 1 / 3;

/**
 * Block-level engineering constants (the registry entry's defaults). These are
 * the Marais-Ekama / WRC kinetic & stoichiometric constants the kernels need;
 * they live here with the block, NOT in the graph solver. Each is overridable
 * via a matching parameter key.
 */
const DEFAULTS = {
  srt: 15,                 // SRT, days
  mlss: 4000,              // conventional AS MLSS, mg/L
  doSetpoint: 2.0,
  depth: 4.5,
  elevationM: 1700,        // Highveld default (matches WWTP Design.xlsm basis)
  volumeSafetyFactor: 1.25,
  // kinetics / stoichiometry
  muAm20: 0.45, Kn20: 1, bA20: 0.04, YH: 0.67, fcv: 1.481, bH20: 0.24,
  fH: 0.2, fiOHO: 0.15, fnUPO: 0.072, fSup: 0.15, fSus: 0.06,
  // aeration
  alpha: 0.45, beta: 0.95, foulingFactor: 0.9, minDOmgL: 2, diffuserAirflowNm3h: 6,
} as const;

const parameterSchema: ParameterField[] = [
  { key: 'srt', label: 'SRT', unit: 'days', min: 3, max: 40, step: 1, defaultValue: DEFAULTS.srt, description: 'Solids Retention Time (sludge age)' },
  { key: 'mlss', label: 'MLSS', unit: 'mg/L', min: 1500, max: 15000, step: 250, defaultValue: DEFAULTS.mlss, description: 'Target mixed-liquor suspended solids' },
  { key: 'do_setpoint', label: 'DO Setpoint', unit: 'mg/L', min: 0.5, max: 6, step: 0.1, defaultValue: DEFAULTS.doSetpoint, advanced: true },
  { key: 'depth', label: 'Depth', unit: 'm', min: 3, max: 8, step: 0.5, defaultValue: DEFAULTS.depth, advanced: true },
  { key: 'elevation_m', label: 'Site elevation', unit: 'm', min: 0, max: 3000, step: 50, defaultValue: DEFAULTS.elevationM, advanced: true },
];

export const bioreactorAerobicDefinition: UnitDefinition = {
  type: 'bioreactor_aerobic',
  label: 'Aerobic Bioreactor',
  description: 'Biological COD removal and nitrification (NH₃ → NO₃), Marais-Ekama steady-state',
  icon: 'wind',
  handles: [
    { id: 'in', label: 'Inflow', position: 'left', type: 'input' },
    { id: 'out', label: 'Outflow (mixed liquor)', position: 'right', type: 'output' },
  ],
  defaultParameters: Object.fromEntries(parameterSchema.map(p => [p.key, p.defaultValue])),
  parameterSchema,
};

export class BioreactorAerobic implements ProcessUnit {
  type = 'bioreactor_aerobic' as const;
  constructor(public parameters: Record<string, number>) {}

  process(inputs: WaterQuality[]): ProcessResult {
    const inf = mixStreams(inputs);
    const p = this.parameters;

    if (inf.flow <= 0) {
      return { outputs: { out: emptyWaterQuality() }, metadata: {}, ...emptyUnitOutputs() };
    }

    const srt = p.srt ?? DEFAULTS.srt;
    const mlss = p.mlss ?? DEFAULTS.mlss;
    const depth = p.depth ?? DEFAULTS.depth;
    const elevationM = p.elevation_m ?? DEFAULTS.elevationM;
    const doSetpoint = p.do_setpoint ?? DEFAULTS.doSetpoint;
    const T = inf.temperature;

    // ── COD fractionation from the ACTUAL inlet (use measured soluble COD) ──
    const codFilteredFraction = inf.COD > 0 ? Math.min(1, inf.sCOD / inf.COD) : 0.29;
    const frac = fractionateCod(inf.COD, { fSup: DEFAULTS.fSup, fSus: DEFAULTS.fSus, codFilteredFraction });

    // ── Kinetics @ stream temperature, sludge inventory, self-sizing ──
    const kin = kineticsAtT(
      { muAm20: DEFAULTS.muAm20, Kn20: DEFAULTS.Kn20, bA20: DEFAULTS.bA20, YH: DEFAULTS.YH, fcv: DEFAULTS.fcv, bH20: DEFAULTS.bH20 },
      T, srt,
    );
    const masses = sludgeMasses(
      { fSup: DEFAULTS.fSup, fcv: DEFAULTS.fcv, fH: DEFAULTS.fH, fiOHO: DEFAULTS.fiOHO },
      { COD: inf.COD, totalBiodegradable: frac.totalBiodegradable, ISS: Math.max(0, inf.TSS - inf.VSS), flow: inf.flow },
      srt, kin,
    );
    const sizing = reactorSizing(
      { mlssMgL: mlss, volumeSafetyFactor: DEFAULTS.volumeSafetyFactor, anoxicMassFraction: 0 },
      masses, inf.flow, srt, 'aerobic',
    );
    // Volume is always DERIVED from the sludge inventory / MLSS (never a stored input),
    // so the block reflects the calculated design. For a recognised MLE/MBR train the
    // simulation store further overrides this with the coupled whole-reactor design.
    const requiredVolume = sizing.volumeSelectedM3;
    const volume = requiredVolume;
    const hrt = volume / inf.flow; // days
    const mlvss = mlss * (masses.MXt > 0 ? masses.MXv / masses.MXt : 0.8);

    // ── Nitrification (total N conserved; no removal until the clarifier wastes) ──
    // Nitrifier growth margin — below this, nitrifiers wash out and nitrification fails.
    const nitrifierMargin = kin.muAmT - (kin.bAT + 1 / srt);
    const nbal = nitrogenBalance(
      { fnUPO: DEFAULTS.fnUPO, alkalinityMgL: inf.alkalinity * 50, aRecycle: 0, sRecycle: 0 },
      { TKN: inf.TKN, MXv: masses.MXv, flow: inf.flow, srtDays: srt, config: 'aerobic', nitrogenRemoval: true },
      kin, 0,
    );
    const canNitrify = nitrifierMargin > 0 && doSetpoint >= 1.0
      && nbal.ammoniaMgL >= 0 && nbal.ammoniaMgL < inf.NH3N;
    // Nitrate produced = nitrification capacity (N after sludge assimilation); total N closes.
    const nitrified = canNitrify ? Math.min(nbal.nitrificationCapacity, Math.max(0, inf.TKN)) : 0;
    const nh3Out = canNitrify ? nbal.ammoniaMgL : inf.NH3N;
    const no3Out = inf.NO3N + nitrified;
    const tknOut = Math.max(nh3Out, inf.TKN - nitrified); // residual soluble + biomass organic N
    const o2Nitrification = 4.57 * nitrified;

    // ── Alkalinity (consumed by nitrification), pH ──
    const alkOutMgL = Math.max(0, inf.alkalinity * 50 - 7.14 * nitrified);
    const alkOut = alkOutMgL / 50; // back to mmol/L
    const pHOut = alkOut < 1 ? Math.max(6.0, inf.pH - 0.5) : inf.pH;

    // ── COD / solids of the mixed-liquor effluent ──
    const sCODOut = frac.USO; // unbiodegradable soluble survives
    const particulateCOD = mlvss * DEFAULTS.fcv; // biomass COD carried as MLSS
    const codOut = sCODOut + particulateCOD;
    const bod5Out = Math.max(0, sCODOut * 0.4); // soluble residual BOD (solids stripped at clarifier)
    const tpOut = inf.TP; // P conserved in mixed liquor (biomass-bound); removed at WAS

    // ── Oxygen demand + blower (folded-in process-air blower) ──
    const odem = oxygenDemand(
      { fcv: DEFAULTS.fcv, fH: DEFAULTS.fH },
      { FSbi: masses.FSbi, flow: inf.flow, nitrificationCapacity: nitrified, nitrateMgL: nitrified, srtDays: srt },
      kin,
    );
    const o2TotalKgPerD = odem.totalKgD;
    const transfer = aerationTransfer(
      { alpha: DEFAULTS.alpha, beta: DEFAULTS.beta, foulingFactor: DEFAULTS.foulingFactor, diffuserDepthM: depth, minDOmgL: DEFAULTS.minDOmgL },
      T, elevationM,
    );
    const q_air = processAirAm3h(o2TotalKgPerD, transfer.oteFraction, transfer.am3hFactor); // Am³/hr
    const blowerKWval = blowerPowerKW(q_air, depth);
    const blowerDailyKWh = blowerKWval * 24;
    const isHst = blowerKWval > 50;
    const diffuserCount = Math.ceil(volume * DIFFUSER_PER_M3);

    const output: WaterQuality = {
      flow: inf.flow,
      COD: Math.max(0, codOut),
      sCOD: Math.max(0, sCODOut),
      BOD5: Math.max(0, bod5Out),
      TKN: Math.max(0, tknOut),
      NH3N: Math.max(0, nh3Out),
      NO3N: Math.max(0, no3Out),
      TP: Math.max(0, tpOut),
      TSS: mlss,       // reactor effluent carries MLSS to the clarifier
      VSS: mlvss,
      pH: pHOut,
      alkalinity: alkOut,
      DO: doSetpoint,
      temperature: T,
    };

    const base = emptyUnitOutputs();
    base.sizing = {
      volume: { value: volume, unit: 'm3' },
      requiredVolume: { value: requiredVolume, unit: 'm3' },
      depth: { value: depth, unit: 'm' },
      HRT: { value: hrt * 24, unit: 'h' },
      MLSS: { value: mlss, unit: 'mg/L' },
      sludgeMassMXt: { value: masses.MXt, unit: 'kgTSS' },
      airFlow: { value: q_air, unit: 'Am³/hr' },
      blowerKW: { value: blowerKWval, unit: 'kW' },
    };
    base.energy = {
      installedKW: blowerKWval,
      dailyKWh: blowerDailyKWh,
      records: [
        {
          label: 'Total O2 demand',
          symbol: 'FOt',
          equation: 'FOt = FOc + FOn − FOdn',
          inputs: {
            FOc: { value: odem.carbonaceousKgD, unit: 'kgO/d', source: 'carbonaceous' },
            FOn: { value: odem.nitrificationKgD, unit: 'kgO/d', source: 'nitrification' },
            FOdn: { value: odem.denitrificationCreditKgD, unit: 'kgO/d', source: 'denitrification credit' },
          },
          result: { value: o2TotalKgPerD, unit: 'kgO2/d' },
          citation: 'WWTP Design.xlsm sheet 6 (Ekama 1984, WRC TT-16/84)',
        },
        {
          label: 'Process air blower power',
          symbol: 'P_blower',
          equation: 'P = Q_air × ΔP / (η × 3600 × 1000)',
          inputs: {
            Q_air: { value: q_air, unit: 'Am³/hr', source: 'FOt / (0.21 × 1.421 × OTE × 24)' },
            OTE: { value: transfer.oteFraction, unit: '', source: 'site air-transfer kernel' },
          },
          result: { value: blowerKWval, unit: 'kW' },
          citation: 'WWTP Design.xlsm sheet 6 / ASCE 2-06',
        },
      ],
    };
    const civilPrice = getPrice('civil_concrete_reinforced');
    const diffuserPrice = getPrice('fine_bubble_diffuser_edi_9in');
    const blowerPrice = isHst ? getPrice('hst_turbo_blower') : getPrice('pd_blower_small');
    base.capex = {
      lineItems: [
        {
          category: 'civil',
          description: `Aerobic reactor reinforced concrete tank (${volume.toFixed(0)} m³)`,
          quantity: volume,
          unit: 'm3',
          unitPriceZar: civilPrice.unitPriceZar,
          sourceCitation: civilPrice.source,
        },
        {
          category: 'mechanical',
          description: `9" fine bubble diffusers (EDI FlexAir) × ${diffuserCount}`,
          quantity: diffuserCount,
          unit: 'ea',
          unitPriceZar: diffuserPrice.unitPriceZar,
          sourceCitation: diffuserPrice.source,
        },
        {
          category: 'mechanical',
          description: isHst ? 'HST turbo blower (process air, Sulzer/APG class)' : 'PD blower (process air, Aerzen/WEG class)',
          quantity: 1,
          unit: 'ea',
          unitPriceZar: blowerPrice.unitPriceZar,
          sourceCitation: blowerPrice.source,
        },
      ],
      total: volume * civilPrice.unitPriceZar + diffuserCount * diffuserPrice.unitPriceZar + blowerPrice.unitPriceZar,
    };
    base.calculationRecords = [
      {
        label: 'Reactor sludge mass (TSS)',
        symbol: 'MXt',
        equation: 'MXt = MXIO + MXv  (Marais-Ekama inventory at SRT)',
        inputs: {
          FSbi: { value: masses.FSbi, unit: 'kgCOD/d', source: 'biodegradable COD load' },
          SRT: { value: srt, unit: 'd', source: 'parameter' },
        },
        result: { value: masses.MXt, unit: 'kgTSS' },
        citation: 'WWTP Design.xlsm sheet 4',
      },
      {
        label: 'Required reactor volume',
        symbol: 'V',
        equation: 'V = (MXt / MLSS × 1000) × safety',
        inputs: {
          MXt: { value: masses.MXt, unit: 'kgTSS', source: 'sludge inventory' },
          MLSS: { value: mlss, unit: 'mg/L', source: 'parameter' },
        },
        result: { value: requiredVolume, unit: 'm3' },
        citation: 'WWTP Design.xlsm sheets 4–5',
      },
      {
        label: 'Mixed liquor suspended solids',
        symbol: 'MLSS',
        equation: 'MLSS target → reactor volume self-sized to hold MXt',
        inputs: { MXt: { value: masses.MXt, unit: 'kgTSS', source: 'inventory' } },
        result: { value: mlss, unit: 'mg/L' },
        citation: 'WWTP Design.xlsm sheet 5',
      },
      {
        label: 'Effluent ammonia (kinetic residual)',
        symbol: 'Nae',
        equation: 'Nae = KnT(bAT+1/Rs) / (µAmT(1−fxt) − (bAT+1/Rs))',
        inputs: {
          muAmT: { value: kin.muAmT, unit: '1/d', source: 'kinetics @T' },
          KnT: { value: kin.KnT, unit: 'mgN/L', source: 'kinetics @T' },
        },
        result: { value: nh3Out, unit: 'mgN/L' },
        citation: 'WWTP Design.xlsm sheet 4',
      },
      {
        label: 'Nitrification O2 demand',
        symbol: 'FOn',
        equation: 'FOn = 4.57 × N_nitrified × Q / 1000',
        inputs: { N_nitrified: { value: nitrified, unit: 'mgN/L', source: 'nitrification balance' } },
        result: { value: odem.nitrificationKgD, unit: 'kgO/d' },
        citation: 'WWTP Design.xlsm sheet 6',
      },
    ];
    if (!canNitrify && nitrifierMargin <= 0) {
      base.warnings.push(`SRT ${srt} d too low to nitrify at ${T.toFixed(0)}°C (nitrifiers wash out) — increase SRT.`);
    }
    // Recycle-coupling guard: the steady-state sludge-mass sizing assumes the inlet
    // is the FRESH feed (FSi = COD_raw x Q_raw). When this block is fed recycled
    // mixed liquor / RAS (high inlet TSS), that load is double-counted and the volume
    // over-estimates. The recognised whole-reactor (MLE) design must size it instead.
    if (inf.TSS > 1000) {
      base.warnings.push(
        `Inlet TSS ${inf.TSS.toFixed(0)} mg/L indicates a recycle-coupled reactor (RAS/mixed liquor). Standalone sludge-mass sizing over-estimates volume here. Use the recognised MLE whole-reactor design for sizing; effluent quality remains valid.`
      );
    }
    if (mlss > 5000) base.warnings.push(`MLSS = ${mlss.toFixed(0)} mg/L > 5000 — conventional clarification may struggle; consider an MBR.`);
    if (nbal.effluentAlkalinityMgL < 40) {
      base.warnings.push(`Effluent alkalinity ${nbal.effluentAlkalinityMgL.toFixed(0)} mg/L < 40 — lime dosing may be needed.`);
    }

    return {
      outputs: { out: output },
      metadata: {
        HRT_hours: hrt * 24,
        SRT_days: srt,
        MLSS: mlss,
        MLVSS: mlvss,
        sludgeMass_MXt: masses.MXt,
        sludgeMass_MXv: masses.MXv,
        requiredVolume,
        nitrificationCapacity: nbal.nitrificationCapacity,
        O2_demand_total: o2TotalKgPerD === 0 ? 0 : (o2TotalKgPerD * 1000) / inf.flow, // mgO/L for downstream blower link
        O2_demand_carbonaceous: odem.carbonaceousKgD,
        O2_demand_nitrification: odem.nitrificationKgD,
        NH3_oxidized: nitrified,
        flow_for_O2: inf.flow,
      },
      ...base,
    };
  }
}
