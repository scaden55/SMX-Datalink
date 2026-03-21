import { getDb } from '../db/index.js';
import { logger } from '../lib/logger.js';
import type {
  FlightCostBreakdown,
  SimSettings,
  AirportFeeTierRates,
  AirportFeeTier,
  DemandVolatility,
  FuelVariability,
} from '@acars/shared';

const TAG = 'FlightCostEngine';

// ── DB row types ────────────────────────────────────────────

interface RateConfigRow {
  key: string;
  value: number;
}

interface AirportFeeRow {
  tier: string;
  landing_rate: number;
  handling_rate: number;
  parking_rate: number;
  nav_rate: number;
  fuel_markup: number;
  fuel_service_pct: number;
  authority_fee: number;
}

interface FleetMtowRow {
  mtow_lbs: number | null;
}

interface FleetIcaoTypeRow {
  icao_type: string;
}

interface ReserveRateRow {
  total_rate: number;
}

interface AirportTierRow {
  fee_tier: string | null;
}

interface AirportHandlerRow {
  handler: string | null;
}

// ── Params ──────────────────────────────────────────────────

export interface CalculateFlightCostParams {
  depIcao: string;
  arrIcao: string;
  distanceNm: number;
  blockHours: number;
  fuelUsedLbs: number;
  aircraftId: number;
  pilotPayRate: number;
}

// ── Default SimSettings (matches finance_rate_config seed) ──

const SIM_SETTINGS_DEFAULTS: SimSettings = {
  costMultiplier: 1.0,
  revenueMultiplier: 1.0,
  demandVolatility: 'medium',
  maintenanceCostFactor: 1.0,
  fuelPriceVariability: 'moderate',
  fuelPriceFactor: 1.0,
};

// Map from DB key names to SimSettings property names
const KEY_MAP: Record<string, keyof SimSettings> = {
  cost_multiplier: 'costMultiplier',
  revenue_multiplier: 'revenueMultiplier',
  demand_volatility: 'demandVolatility',
  maintenance_cost_factor: 'maintenanceCostFactor',
  fuel_price_variability: 'fuelPriceVariability',
  fuel_price_factor: 'fuelPriceFactor',
};

const STRING_KEYS = new Set<keyof SimSettings>([
  'demandVolatility',
  'fuelPriceVariability',
]);

// ── Engine ──────────────────────────────────────────────────

export class FlightCostEngine {
  private settingsCache: SimSettings | null = null;

  /** Invalidate the cached SimSettings so the next call re-reads from DB. */
  invalidateCache(): void {
    this.settingsCache = null;
  }

  /**
   * Read all keys from `finance_rate_config` and return a SimSettings object.
   * Values are cached until `invalidateCache()` is called.
   */
  getSimSettings(): SimSettings {
    if (this.settingsCache) return this.settingsCache;

    const db = getDb();
    const rows = db
      .prepare('SELECT key, value FROM finance_rate_config')
      .all() as RateConfigRow[];

    const settings: SimSettings = { ...SIM_SETTINGS_DEFAULTS };

    for (const row of rows) {
      const prop = KEY_MAP[row.key];
      if (!prop) continue;

      if (STRING_KEYS.has(prop)) {
        // value column is REAL, but for enum-style keys we store a string mapping
        // For now these remain at defaults unless explicitly stored as text keys
        continue;
      }

      (settings as unknown as Record<string, number | string>)[prop] = row.value;
    }

    this.settingsCache = settings;
    return settings;
  }

  /**
   * Look up the fee tier for an airport, then return the tier's rate schedule.
   * Falls back to 'regional' if the airport or tier is not found.
   */
  getAirportTierRates(icao: string): AirportFeeTierRates {
    const db = getDb();

    const airportRow = db
      .prepare('SELECT fee_tier FROM airports WHERE icao = ?')
      .get(icao) as AirportTierRow | undefined;

    const tier: AirportFeeTier = (airportRow?.fee_tier as AirportFeeTier) ?? 'regional';

    const feeRow = db
      .prepare('SELECT * FROM airport_fee_tiers WHERE tier = ?')
      .get(tier) as AirportFeeRow | undefined;

    if (!feeRow) {
      logger.warn(TAG, `No fee tier row for "${tier}", returning zero rates`);
      return {
        tier,
        landingPer1000lbs: 0,
        handlingPer1000lbs: 0,
        parkingPerHour: 0,
        navPerNm: 0,
        fuelPricePerLb: 0,
        fuelServicePct: 0,
        authorityFee: 0,
      };
    }

    return {
      tier,
      landingPer1000lbs: feeRow.landing_rate,
      handlingPer1000lbs: feeRow.handling_rate,
      parkingPerHour: feeRow.parking_rate,
      navPerNm: feeRow.nav_rate,
      fuelPricePerLb: feeRow.fuel_markup,
      fuelServicePct: feeRow.fuel_service_pct,
      authorityFee: feeRow.authority_fee,
    };
  }

  /**
   * Sum all maintenance check reserve rates for the aircraft's ICAO type.
   * Returns total $/FH reserve accrual rate.
   */
  getMaintenanceReserveRate(aircraftId: number): number {
    const db = getDb();

    const fleetRow = db
      .prepare('SELECT icao_type FROM fleet WHERE id = ?')
      .get(aircraftId) as FleetIcaoTypeRow | undefined;

    if (!fleetRow) {
      logger.warn(TAG, `Aircraft ${aircraftId} not found in fleet, reserve rate = 0`);
      return 0;
    }

    const result = db
      .prepare(
        'SELECT COALESCE(SUM(reserve_rate_per_hour), 0) AS total_rate FROM maintenance_checks WHERE icao_type = ?',
      )
      .get(fleetRow.icao_type) as ReserveRateRow;

    return result.total_rate;
  }

  /**
   * Add to the aircraft's maintenance reserve balance.
   */
  accrueMaintenanceReserve(aircraftId: number, amount: number): void {
    const db = getDb();
    db.prepare(
      'UPDATE aircraft_hours SET maintenance_reserve_balance = maintenance_reserve_balance + ? WHERE aircraft_id = ?',
    ).run(amount, aircraftId);
  }

  /**
   * Calculate all variable operating costs for a single flight.
   * Accrues the maintenance reserve as a side-effect.
   */
  calculateFlightCosts(params: CalculateFlightCostParams): FlightCostBreakdown {
    const {
      depIcao,
      arrIcao,
      distanceNm,
      blockHours,
      fuelUsedLbs,
      aircraftId,
      pilotPayRate,
    } = params;

    const settings = this.getSimSettings();
    const depRates = this.getAirportTierRates(depIcao);
    const arrRates = this.getAirportTierRates(arrIcao);

    // Look up aircraft MTOW
    const db = getDb();
    const fleetRow = db
      .prepare('SELECT mtow_lbs FROM fleet WHERE id = ?')
      .get(aircraftId) as FleetMtowRow | undefined;

    const mtow = fleetRow?.mtow_lbs || 150_000; // default mid-range cargo

    // Cost calculations
    const fuelCost = fuelUsedLbs * depRates.fuelPricePerLb * settings.fuelPriceFactor;
    const fuelServiceFee = fuelCost * depRates.fuelServicePct;
    const crewCost = blockHours * pilotPayRate;
    const landingFees =
      (mtow / 1000) * (depRates.landingPer1000lbs + arrRates.landingPer1000lbs);
    // Handling rates are flat fees per movement, not per-1000lbs
    const handlingDepFees = depRates.handlingPer1000lbs;
    const handlingArrFees = arrRates.handlingPer1000lbs;
    const navFees = distanceNm * depRates.navPerNm;
    const authorityFees = depRates.authorityFee + arrRates.authorityFee;

    const reserveRate = this.getMaintenanceReserveRate(aircraftId);
    const maintenanceReserve =
      blockHours * reserveRate * settings.maintenanceCostFactor;

    const totalDoc =
      (fuelCost + fuelServiceFee + crewCost + landingFees + handlingDepFees + handlingArrFees + navFees + authorityFees + maintenanceReserve) *
      settings.costMultiplier;

    // Accrue maintenance reserve
    this.accrueMaintenanceReserve(aircraftId, maintenanceReserve);

    // Look up handler names (schedule-level override falls back to airport default)
    const depHandlerRow = db
      .prepare('SELECT handler FROM airports WHERE icao = ?')
      .get(depIcao) as AirportHandlerRow | undefined;
    const arrHandlerRow = db
      .prepare('SELECT handler FROM airports WHERE icao = ?')
      .get(arrIcao) as AirportHandlerRow | undefined;
    const depHandler = depHandlerRow?.handler ?? null;
    const arrHandler = arrHandlerRow?.handler ?? null;

    logger.info(TAG, `Flight ${depIcao}-${arrIcao}: DOC $${totalDoc.toFixed(2)}`, {
      fuelCost,
      fuelServiceFee,
      crewCost,
      landingFees,
      handlingDepFees,
      handlingArrFees,
      navFees,
      authorityFees,
      maintenanceReserve,
    });

    return {
      fuelCost,
      fuelServiceFee,
      crewCost,
      landingFees,
      handlingDepFees,
      handlingArrFees,
      navFees,
      authorityFees,
      maintenanceReserve,
      totalDoc,
      depHandler,
      arrHandler,
    };
  }
}
