/**
 * Finance Engine — Barrel export.
 *
 * Pure calculation modules + persistence store.
 */

export { rateManifest } from './rating.js';
export type { RatingInput } from './rating.js';

export { computeFlightCosts } from './flight-costs.js';
export type { FlightCostInput } from './flight-costs.js';

export { allocateFixedCosts, computeMaintAlerts } from './fixed-costs.js';
export type { FixedCostInput, AircraftHoursInput } from './fixed-costs.js';

export { computeFlightPnL, computePeriodPnL } from './pnl.js';
export type { FlightPnLInput } from './pnl.js';

export { rollOperationalEvent } from './events.js';
export type { EventRollInput } from './events.js';

export { FinanceEngineStore } from './store.js';
