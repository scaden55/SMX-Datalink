import { getDb } from '../db/index.js';
import { logger } from '../lib/logger.js';

const TAG = 'RevenueModel';

// --- DB row types ---

interface RevenueModelConfigRow {
  id: number;
  class_i_standard: number;
  class_i_nonstandard: number;
  class_i_hazard: number;
  class_ii_standard: number;
  class_ii_nonstandard: number;
  class_ii_hazard: number;
  class_iii_standard: number;
  class_iii_nonstandard: number;
  class_iii_hazard: number;
  pilot_pay_per_hour: number;
  manifest_std_pct: number;
  manifest_nonstd_pct: number;
  manifest_hazard_pct: number;
  manifest_std_min: number;
  manifest_std_max: number;
  manifest_nonstd_min: number;
  manifest_nonstd_max: number;
  manifest_hazard_min: number;
  manifest_hazard_max: number;
  reference_nm: number;
  updated_at: string;
}

interface FleetClassRow {
  aircraft_class: string;
}

// --- Public types ---

export type AircraftClass = 'I' | 'II' | 'III';

export interface RevenueBreakdown {
  cargoLbs: number;
  distanceNm: number;
  distanceFactor: number;
  aircraftClass: AircraftClass;
  manifest: {
    standardLbs: number;
    nonstandardLbs: number;
    hazardLbs: number;
  };
  revenue: {
    standard: number;
    nonstandard: number;
    hazard: number;
    total: number;
  };
  pilotPay: number;
  blockHours: number;
}

// --- Helpers ---

function distanceFactor(routeNm: number, referenceNm: number): number {
  return Math.log(routeNm / 100 + 1) / Math.log(referenceNm / 100 + 1);
}

/** Random value uniformly distributed between min and max. */
function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// --- Service ---

export class RevenueModelService {
  private configCache: RevenueModelConfigRow | null = null;

  /** Read config from DB (cached after first call). Call invalidateCache() to refresh. */
  private getConfig(): RevenueModelConfigRow {
    if (this.configCache) return this.configCache;

    const row = getDb()
      .prepare('SELECT * FROM revenue_model_config WHERE id = 1')
      .get() as RevenueModelConfigRow | undefined;

    if (!row) {
      throw new Error('revenue_model_config row missing — migration not applied?');
    }

    this.configCache = row;
    logger.info(TAG, 'Loaded revenue model config', {
      referenceNm: row.reference_nm,
      pilotPayPerHour: row.pilot_pay_per_hour,
    });
    return row;
  }

  /** Clear cached config so the next calculation re-reads from DB. */
  invalidateCache(): void {
    this.configCache = null;
  }

  /** Look up aircraft class from fleet table by registration. Defaults to III. */
  private lookupAircraftClass(registration: string | null): AircraftClass {
    if (!registration) return 'III';

    const row = getDb()
      .prepare('SELECT aircraft_class FROM fleet WHERE registration = ?')
      .get(registration) as FleetClassRow | undefined;

    if (!row || !['I', 'II', 'III'].includes(row.aircraft_class)) {
      return 'III';
    }
    return row.aircraft_class as AircraftClass;
  }

  /** Get the yield rate ($/lb) for a given class and tier. */
  private yieldRate(
    config: RevenueModelConfigRow,
    cls: AircraftClass,
    tier: 'standard' | 'nonstandard' | 'hazard',
  ): number {
    const key = `class_${cls.toLowerCase() === 'i' ? 'i' : cls.toLowerCase() === 'ii' ? 'ii' : 'iii'}_${tier}` as keyof RevenueModelConfigRow;
    return config[key] as number;
  }

  /** Generate cargo manifest by picking random percentages within configured min/max ranges. */
  private generateManifest(
    totalLbs: number,
    config: RevenueModelConfigRow,
  ): { standardLbs: number; nonstandardLbs: number; hazardLbs: number } {
    // Pick a random value within each configured range
    let stdPct = randBetween(config.manifest_std_min, config.manifest_std_max);
    let nonstdPct = randBetween(config.manifest_nonstd_min, config.manifest_nonstd_max);
    let hazPct = randBetween(config.manifest_hazard_min, config.manifest_hazard_max);

    // Normalize so they sum to 1.0
    const sum = stdPct + nonstdPct + hazPct;
    if (sum > 0) {
      stdPct /= sum;
      nonstdPct /= sum;
      hazPct /= sum;
    } else {
      stdPct = 1;
      nonstdPct = 0;
      hazPct = 0;
    }

    return {
      standardLbs: Math.round(totalLbs * stdPct * 100) / 100,
      nonstandardLbs: Math.round(totalLbs * nonstdPct * 100) / 100,
      hazardLbs: Math.round(totalLbs * hazPct * 100) / 100,
    };
  }

  /**
   * Calculate revenue breakdown for a completed flight.
   * All weights in pounds (lbs). Yield rates are $/lb.
   */
  calculate(params: {
    cargoLbs: number;
    distanceNm: number;
    aircraftRegistration: string | null;
    aircraftType?: string;
    blockHours: number;
  }): RevenueBreakdown {
    const config = this.getConfig();

    const dFactor = distanceFactor(params.distanceNm, config.reference_nm);
    const aircraftClass = this.lookupAircraftClass(params.aircraftRegistration);
    const manifest = this.generateManifest(params.cargoLbs, config);

    const stdRevenue = manifest.standardLbs * this.yieldRate(config, aircraftClass, 'standard') * dFactor;
    const nonstdRevenue = manifest.nonstandardLbs * this.yieldRate(config, aircraftClass, 'nonstandard') * dFactor;
    const hazRevenue = manifest.hazardLbs * this.yieldRate(config, aircraftClass, 'hazard') * dFactor;
    const totalRevenue = stdRevenue + nonstdRevenue + hazRevenue;

    const pilotPay = params.blockHours * config.pilot_pay_per_hour;

    const breakdown: RevenueBreakdown = {
      cargoLbs: Math.round(params.cargoLbs * 100) / 100,
      distanceNm: params.distanceNm,
      distanceFactor: Math.round(dFactor * 10000) / 10000,
      aircraftClass,
      manifest: {
        standardLbs: manifest.standardLbs,
        nonstandardLbs: manifest.nonstandardLbs,
        hazardLbs: manifest.hazardLbs,
      },
      revenue: {
        standard: Math.round(stdRevenue * 100) / 100,
        nonstandard: Math.round(nonstdRevenue * 100) / 100,
        hazard: Math.round(hazRevenue * 100) / 100,
        total: Math.round(totalRevenue * 100) / 100,
      },
      pilotPay: Math.round(pilotPay * 100) / 100,
      blockHours: params.blockHours,
    };

    logger.info(TAG, `Revenue calculated: $${breakdown.revenue.total} (class ${aircraftClass}, ${params.distanceNm}nm)`, {
      cargoLbs: breakdown.cargoLbs,
      pilotPay: breakdown.pilotPay,
    });

    return breakdown;
  }
}
