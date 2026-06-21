/**
 * Shared engineering kernels — pure, deterministic functions extracted from the
 * WWTP Design.xlsm (Marais-Ekama / WRC) workbook. ONE source of truth consumed
 * by BOTH the MLE-MBR design generator and the flowsheet block models, so the
 * flowsheet and the design tab can never drift. No clocks, no randomness, no
 * hardcoded process constants (every constant is passed in).
 */
export * from './wastewater';
export * from './activated-sludge';
export * from './aeration';
export * from './membrane';
export * from './clarifier';
export * from './denitrification';
