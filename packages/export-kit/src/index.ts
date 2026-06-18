// @repo/export-kit — serialise a DesignPackage three ways. JSON is canonical;
// Excel is a lossy projection of the SAME package. Headless, deterministic,
// LLM-free.

export { toJSON } from './to-json';
export { toExcel, EXCEL_SHEET_NAMES } from './to-excel';
