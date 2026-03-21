import { getDb } from '../db/index.js';
import { logger } from '../lib/logger.js';
import type { DemandVolatility } from '@acars/shared';

const TAG = 'SupplyDemandEngine';

// ── DB row helpers ──────────────────────────────────────────

interface AirportDemandRow {
  demand_score: number;
}

interface CountRow {
  flights: number;
}

interface ConfigRow {
  value: number;
}

interface RouteRow {
  dep_icao: string;
  arr_icao: string;
}

// ── Default constants ───────────────────────────────────────

const DEFAULT_DEMAND_SCORE = 0.3;
const SUPPLY_NORMALIZATION = 10; // 10 flights/month = 1.0
const SUPPLY_CAP = 3.0;
const DEFAULT_BASE_YIELD = 2.50; // $/lb
const DEFAULT_DISTANCE_FACTOR = 1.0;

const VOLATILITY_CAPS: Record<DemandVolatility, [number, number]> = {
  low:    [0.85, 1.20],
  medium: [0.70, 1.50],
  high:   [0.50, 2.00],
};

// Demand volatility stored as REAL in finance_rate_config:
// 1 = low, 2 = medium, 3 = high
const VOLATILITY_MAP: Record<number, DemandVolatility> = {
  1: 'low',
  2: 'medium',
  3: 'high',
};

// ── Engine ──────────────────────────────────────────────────

export class SupplyDemandEngine {
  /**
   * Get the demand score for an airport (0.0–1.0).
   * Returns DEFAULT_DEMAND_SCORE if airport is unknown.
   */
  getDemandScore(icao: string): number {
    const db = getDb();
    const row = db.prepare(
      'SELECT demand_score FROM airports WHERE icao = ?'
    ).get(icao) as AirportDemandRow | undefined;

    if (!row) {
      return DEFAULT_DEMAND_SCORE;
    }
    return row.demand_score;
  }

  /**
   * Get the supply score for a specific route based on recent approved flights.
   * 0 = no service, 1.0 = adequately served (10 flights/30 days), capped at 3.0.
   */
  getSupplyScore(originIcao: string, destIcao: string): number {
    const db = getDb();
    const row = db.prepare(`
      SELECT COUNT(*) as flights FROM logbook
      WHERE dep_icao = ? AND arr_icao = ?
        AND status = 'approved'
        AND actual_arr >= datetime('now', '-30 days')
    `).get(originIcao, destIcao) as CountRow;

    const supplyScore = row.flights / SUPPLY_NORMALIZATION;
    return Math.min(supplyScore, SUPPLY_CAP);
  }

  /**
   * Read the demand volatility setting and return the min/max modifier caps.
   * Defaults to 'medium' if not configured.
   */
  getVolatilityCaps(): [number, number] {
    const db = getDb();
    const row = db.prepare(
      "SELECT value FROM finance_rate_config WHERE key = 'demand_volatility'"
    ).get() as ConfigRow | undefined;

    let volatility: DemandVolatility = 'medium';
    if (row) {
      const mapped = VOLATILITY_MAP[row.value];
      if (mapped) {
        volatility = mapped;
      }
    }

    return VOLATILITY_CAPS[volatility];
  }

  /**
   * Calculate the dynamic lane rate for a route.
   * Combines origin/destination demand, route supply, and volatility caps.
   */
  calculateLaneRate(
    originIcao: string,
    destIcao: string,
    baseYield: number,
    distanceFactor: number,
  ): { rate: number; modifier: number; demandScore: number; supplyScore: number } {
    const originDemand = this.getDemandScore(originIcao);
    const destDemand = this.getDemandScore(destIcao);
    const laneDemand = (originDemand + destDemand) / 2;

    const supplyScore = this.getSupplyScore(originIcao, destIcao);

    const rawModifier = laneDemand / Math.max(supplyScore, 0.1);

    const [minCap, maxCap] = this.getVolatilityCaps();
    const clampedModifier = Math.max(minCap, Math.min(rawModifier, maxCap));

    const rate = baseYield * distanceFactor * clampedModifier;

    return {
      rate,
      modifier: clampedModifier,
      demandScore: laneDemand,
      supplyScore,
    };
  }

  /**
   * Snapshot all active scheduled routes into finance_lane_rates.
   * Returns the number of routes processed.
   */
  snapshotLaneRates(): number {
    const db = getDb();

    const routes = db.prepare(`
      SELECT DISTINCT dep_icao, arr_icao FROM scheduled_flights WHERE is_active = 1
    `).all() as RouteRow[];

    if (routes.length === 0) {
      logger.info(TAG, 'No active routes found for lane rate snapshot');
      return 0;
    }

    const upsert = db.prepare(`
      INSERT INTO finance_lane_rates (origin_icao, dest_icao, rate_per_lb, demand_score, supply_score, last_updated)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(origin_icao, dest_icao) DO UPDATE SET
        rate_per_lb = excluded.rate_per_lb,
        demand_score = excluded.demand_score,
        supply_score = excluded.supply_score,
        last_updated = excluded.last_updated
    `);

    const runAll = db.transaction(() => {
      for (const route of routes) {
        const { rate, demandScore, supplyScore } = this.calculateLaneRate(
          route.dep_icao,
          route.arr_icao,
          DEFAULT_BASE_YIELD,
          DEFAULT_DISTANCE_FACTOR,
        );
        upsert.run(route.dep_icao, route.arr_icao, rate, demandScore, supplyScore);
      }
    });

    runAll();

    logger.info(TAG, `Snapshotted lane rates for ${routes.length} routes`);
    return routes.length;
  }
}
