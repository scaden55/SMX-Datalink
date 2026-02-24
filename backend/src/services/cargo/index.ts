// ─── Cargo Module Barrel Export ──────────────────────────────
export { generateCargoLoad } from './cargo-generator.js';
export type { GenerateParams } from './cargo-generator.js';
export { validateCargoLoad } from './validation-engine.js';
export type { ValidationResult } from './validation-engine.js';
export { AIRCRAFT_CONFIGS, ULD_TYPES, AIRCRAFT_MAP, getAircraftConfig, convertWeight } from './aircraft-configs.js';
export type { AircraftConfig, AircraftSection, ULDTypeConfig } from './aircraft-configs.js';
export { CARGO_CATEGORIES, getRandomDescription, getRandomWeight } from './cargo-categories.js';
export type { CargoCategory } from './cargo-categories.js';
