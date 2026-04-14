/**
 * Marais-Ekama kinetic and stoichiometric constants for activated sludge
 * design, reference temperature 20°C. Temperature corrections follow the
 * Arrhenius-style form: k(T) = k(20) × θ^(T-20).
 *
 * Source: Ekama & Marais (1976); WRC TT-16/84 (Ekama et al., 1984);
 * Henze et al. (2008) Biological Wastewater Treatment, IWA.
 */

export interface KineticConstants {
  // Nitrifier kinetics (autotrophic organisms, ANOs)
  muAm20: number;
  theta_muAm: number;
  Kn20: number;
  theta_Kn: number;
  bA20: number;
  theta_bA: number;
  YA: number;

  // Heterotroph kinetics (OHOs)
  YH: number;
  bH20: number;
  theta_bH: number;
  fH: number;
  fiOHO: number;

  // Stoichiometric ratios (VSS basis)
  fcv: number;
  fc: number;
  fnUPO: number;
  fnBio: number;
  fp: number;

  // Denitrification rates (mgN / mgVSS·d @ 20°C)
  K1_20: number;
  theta_K1: number;
  K2_20: number;
  theta_K2: number;

  // O2 demands
  oxygenPerNitrifiedN: number;
  oxygenRecoveredPerDenitN: number;

  // Alkalinity
  alkalinityConsumedByNitrification: number;
  alkalinityRecoveredByDenitrification: number;

  source: string;
}

export const KINETIC_CONSTANTS: KineticConstants = {
  muAm20: 0.45,
  theta_muAm: 1.123,
  Kn20: 1.0,
  theta_Kn: 1.123,
  bA20: 0.04,
  theta_bA: 1.029,
  YA: 0.1,

  YH: 0.67,
  bH20: 0.24,
  theta_bH: 1.029,
  fH: 0.2,
  fiOHO: 0.15,

  fcv: 1.481,
  fc: 0.518,
  fnUPO: 0.072,
  fnBio: 0.1,
  fp: 0.025,

  K1_20: 0.72,
  theta_K1: 1.2,
  K2_20: 0.101,
  theta_K2: 1.08,

  oxygenPerNitrifiedN: 4.57,
  oxygenRecoveredPerDenitN: 2.86,

  alkalinityConsumedByNitrification: 7.14,
  alkalinityRecoveredByDenitrification: 3.57,

  source: 'Marais & Ekama (1976); WRC TT-16/84 (1984); Henze et al. (2008)',
};

/** Arrhenius-style temperature correction: k(T) = k(20) × θ^(T-20) */
export function adjustForTemperature(k20: number, theta: number, T: number): number {
  return k20 * Math.pow(theta, T - 20);
}
