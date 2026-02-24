import { getDb } from '../db/index.js';
import type {
  ReportResponse,
  ReportSummary,
  FinancialSummary,
  AircraftFinancials,
  TopAirportPair,
  PilotBreakdown,
  DailyVolume,
} from '@acars/shared';
import type {
  ReportSummaryQueryRow,
  ReportFinancialFlightRow,
  ReportTopRouteQueryRow,
  ReportByPilotQueryRow,
  ReportVolumeQueryRow,
} from '../types/db-rows.js';

// ── Financial Rate Constants ────────────────────────────────────

const REVENUE_RATES = {
  perPaxMile: 0.12,       // $0.12 per passenger-nautical-mile
  perCargoLbMile: 0.0005, // $0.0005 per lb-nautical-mile
};

interface AircraftRates {
  fuelPerLb: number;
  crewPerHour: number;
  landingFee: number;
  maintPerHour: number;
}

const AIRCRAFT_RATES: Record<string, AircraftRates> = {
  E175: { fuelPerLb: 0.85, crewPerHour: 450,  landingFee: 200, maintPerHour: 750  },
  CRJ9: { fuelPerLb: 0.85, crewPerHour: 450,  landingFee: 200, maintPerHour: 750  },
  A320: { fuelPerLb: 0.85, crewPerHour: 650,  landingFee: 400, maintPerHour: 1100 },
  A321: { fuelPerLb: 0.85, crewPerHour: 700,  landingFee: 450, maintPerHour: 1200 },
  B738: { fuelPerLb: 0.85, crewPerHour: 650,  landingFee: 400, maintPerHour: 1100 },
  B739: { fuelPerLb: 0.85, crewPerHour: 650,  landingFee: 400, maintPerHour: 1100 },
  B772: { fuelPerLb: 0.85, crewPerHour: 1100, landingFee: 700, maintPerHour: 2000 },
  B789: { fuelPerLb: 0.85, crewPerHour: 1200, landingFee: 750, maintPerHour: 2200 },
  A333: { fuelPerLb: 0.85, crewPerHour: 1000, landingFee: 650, maintPerHour: 1800 },
};

const DEFAULT_RATES: AircraftRates = {
  fuelPerLb: 0.85,
  crewPerHour: 650,
  landingFee: 400,
  maintPerHour: 1100,
};

function getRates(aircraftType: string): AircraftRates {
  return AIRCRAFT_RATES[aircraftType] ?? DEFAULT_RATES;
}

// ── Accumulator helpers ─────────────────────────────────────────

interface FinancialAccumulator {
  flights: number;
  hoursMin: number;
  passengerRevenue: number;
  cargoRevenue: number;
  fuelCost: number;
  crewCost: number;
  landingFees: number;
  maintenanceCost: number;
}

function emptyAccumulator(): FinancialAccumulator {
  return { flights: 0, hoursMin: 0, passengerRevenue: 0, cargoRevenue: 0, fuelCost: 0, crewCost: 0, landingFees: 0, maintenanceCost: 0 };
}

function toFinancialSummary(a: FinancialAccumulator): FinancialSummary {
  const totalRevenue = a.passengerRevenue + a.cargoRevenue;
  const totalExpenses = a.fuelCost + a.crewCost + a.landingFees + a.maintenanceCost;
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  return {
    revenue: {
      passengerRevenue: Math.round(a.passengerRevenue),
      cargoRevenue: Math.round(a.cargoRevenue),
      totalRevenue: Math.round(totalRevenue),
    },
    expenses: {
      fuelCost: Math.round(a.fuelCost),
      crewCost: Math.round(a.crewCost),
      landingFees: Math.round(a.landingFees),
      maintenanceCost: Math.round(a.maintenanceCost),
      totalExpenses: Math.round(totalExpenses),
    },
    netProfit: Math.round(netProfit),
    profitMargin: Math.round(profitMargin * 10) / 10,
  };
}

// ── Reports Service ─────────────────────────────────────────────

export class ReportsService {

  /**
   * Build the full report. When `month` is "YYYY-MM" we filter to that
   * calendar month; when omitted we aggregate all-time.
   */
  getReport(month?: string): ReportResponse {
    const { where, params, period, isAllTime } = this.buildFilter(month);
    const { financials, financialsByAircraft } = this.queryFinancials(where, params);

    return {
      period,
      summary: this.querySummary(where, params),
      financials,
      financialsByAircraft,
      topRoutes: this.queryTopRoutes(where, params),
      byPilot: this.queryByPilot(where, params),
      volume: this.queryVolume(where, params, isAllTime),
    };
  }

  // ── Filter builder ────────────────────────────────────────────

  private buildFilter(month?: string): {
    where: string;
    params: unknown[];
    period: string;
    isAllTime: boolean;
  } {
    if (!month) {
      return { where: '', params: [], period: 'all-time', isAllTime: true };
    }

    // month = "YYYY-MM"  →  start = "YYYY-MM-01", end = first day of next month
    const [y, m] = month.split('-').map(Number);
    const start = `${y}-${String(m).padStart(2, '0')}-01T00:00:00`;
    const nextMonth = m === 12 ? `${y + 1}-01-01T00:00:00` : `${y}-${String(m + 1).padStart(2, '0')}-01T00:00:00`;

    return {
      where: 'WHERE l.actual_dep >= ? AND l.actual_dep < ?',
      params: [start, nextMonth],
      period: month,
      isAllTime: false,
    };
  }

  // ── 1. Summary stats ─────────────────────────────────────────

  private querySummary(where: string, params: unknown[]): ReportSummary {
    const sql = `
      SELECT
        COUNT(*)                    AS total_flights,
        COALESCE(SUM(l.flight_time_min), 0)  AS total_hours_min,
        COALESCE(SUM(l.distance_nm), 0)      AS total_distance_nm,
        COALESCE(SUM(l.fuel_used_lbs), 0)    AS total_fuel_lbs,
        COALESCE(SUM(l.pax_count), 0)        AS total_pax,
        COALESCE(SUM(l.cargo_lbs), 0)        AS total_cargo_lbs,
        AVG(l.score)                         AS avg_score,
        AVG(l.landing_rate_fpm)              AS avg_landing_rate
      FROM logbook l
      ${where}
    `;
    const row = getDb().prepare(sql).get(...params) as ReportSummaryQueryRow;
    return {
      totalFlights: row.total_flights,
      totalHoursMin: row.total_hours_min,
      totalDistanceNm: row.total_distance_nm,
      totalFuelLbs: row.total_fuel_lbs,
      totalPax: row.total_pax,
      totalCargoLbs: row.total_cargo_lbs,
      avgScore: row.avg_score != null ? Math.round(row.avg_score) : null,
      avgLandingRate: row.avg_landing_rate != null ? Math.round(row.avg_landing_rate) : null,
    };
  }

  // ── 2. Financials (computed from completed flights) ──────────

  private queryFinancials(where: string, params: unknown[]): {
    financials: FinancialSummary;
    financialsByAircraft: AircraftFinancials[];
  } {
    const completedWhere = where
      ? `${where} AND l.status = 'approved'`
      : "WHERE l.status = 'approved'";

    const sql = `
      SELECT
        l.aircraft_type,
        l.distance_nm,
        l.fuel_used_lbs,
        l.flight_time_min,
        l.pax_count,
        l.cargo_lbs
      FROM logbook l
      ${completedWhere}
    `;

    const rows = getDb().prepare(sql).all(...params) as ReportFinancialFlightRow[];

    // Accumulate per-aircraft-type and aggregate totals in a single pass
    const totals = emptyAccumulator();
    const byType = new Map<string, FinancialAccumulator>();

    for (const r of rows) {
      const dist = r.distance_nm ?? 0;
      const type = r.aircraft_type ?? 'Unknown';
      const rates = getRates(type);
      const flightMin = r.flight_time_min ?? 0;
      const hours = flightMin / 60;

      const paxRev = (r.pax_count ?? 0) * dist * REVENUE_RATES.perPaxMile;
      const cargoRev = (r.cargo_lbs ?? 0) * dist * REVENUE_RATES.perCargoLbMile;
      const fuel = (r.fuel_used_lbs ?? 0) * rates.fuelPerLb;
      const crew = hours * rates.crewPerHour;
      const landing = rates.landingFee;
      const maint = hours * rates.maintPerHour;

      // Aggregate totals
      totals.flights++;
      totals.hoursMin += flightMin;
      totals.passengerRevenue += paxRev;
      totals.cargoRevenue += cargoRev;
      totals.fuelCost += fuel;
      totals.crewCost += crew;
      totals.landingFees += landing;
      totals.maintenanceCost += maint;

      // Per-aircraft bucket
      let bucket = byType.get(type);
      if (!bucket) {
        bucket = emptyAccumulator();
        byType.set(type, bucket);
      }
      bucket.flights++;
      bucket.hoursMin += flightMin;
      bucket.passengerRevenue += paxRev;
      bucket.cargoRevenue += cargoRev;
      bucket.fuelCost += fuel;
      bucket.crewCost += crew;
      bucket.landingFees += landing;
      bucket.maintenanceCost += maint;
    }

    const financialsByAircraft: AircraftFinancials[] = Array.from(byType.entries())
      .sort((a, b) => b[1].flights - a[1].flights)
      .map(([aircraftType, acc]) => ({
        aircraftType,
        flights: acc.flights,
        hoursMin: Math.round(acc.hoursMin),
        financials: toFinancialSummary(acc),
      }));

    return {
      financials: toFinancialSummary(totals),
      financialsByAircraft,
    };
  }

  // ── 3. Top routes (top 10) ────────────────────────────────────

  private queryTopRoutes(where: string, params: unknown[]): TopAirportPair[] {
    const sql = `
      SELECT
        l.dep_icao,
        l.arr_icao,
        COALESCE(d.name, oa_d.name) AS dep_name,
        COALESCE(a.name, oa_a.name) AS arr_name,
        COUNT(*) AS flights
      FROM logbook l
      LEFT JOIN airports d ON d.icao = l.dep_icao
      LEFT JOIN airports a ON a.icao = l.arr_icao
      LEFT JOIN oa_airports oa_d ON oa_d.ident = l.dep_icao
      LEFT JOIN oa_airports oa_a ON oa_a.ident = l.arr_icao
      ${where}
      GROUP BY l.dep_icao, l.arr_icao
      ORDER BY flights DESC
      LIMIT 10
    `;
    return (getDb().prepare(sql).all(...params) as ReportTopRouteQueryRow[]).map(r => ({
      depIcao: r.dep_icao,
      arrIcao: r.arr_icao,
      depName: r.dep_name,
      arrName: r.arr_name,
      flights: r.flights,
    }));
  }

  // ── 4. By pilot ───────────────────────────────────────────────

  private queryByPilot(where: string, params: unknown[]): PilotBreakdown[] {
    const sql = `
      SELECT
        u.callsign,
        u.first_name || ' ' || u.last_name AS pilot_name,
        COUNT(*)           AS flights,
        SUM(l.flight_time_min) AS hours_min,
        AVG(l.score)       AS avg_score
      FROM logbook l
      LEFT JOIN users u ON u.id = l.user_id
      ${where}
      GROUP BY l.user_id
      ORDER BY flights DESC
    `;
    return (getDb().prepare(sql).all(...params) as ReportByPilotQueryRow[]).map(r => ({
      callsign: r.callsign ?? 'Unknown',
      pilotName: r.pilot_name ?? 'Unknown',
      flights: r.flights,
      hoursMin: r.hours_min ?? 0,
      avgScore: r.avg_score != null ? Math.round(r.avg_score) : null,
    }));
  }

  // ── 5. Volume (daily or monthly) ──────────────────────────────

  private queryVolume(where: string, params: unknown[], isAllTime: boolean): DailyVolume[] {
    const dateExpr = isAllTime
      ? "STRFTIME('%Y-%m', l.actual_dep)"
      : "DATE(l.actual_dep)";

    const sql = `
      SELECT
        ${dateExpr} AS date,
        COUNT(*)    AS flights
      FROM logbook l
      ${where}
      GROUP BY date
      ORDER BY date ASC
    `;
    return (getDb().prepare(sql).all(...params) as ReportVolumeQueryRow[]).map(r => ({
      date: r.date,
      flights: r.flights,
    }));
  }
}
