import { Router } from 'express';
import { authMiddleware, dispatcherMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import { logger } from '../lib/logger.js';

export function adminFinancialKpisRouter(): Router {
  const router = Router();

  router.get('/admin/dashboard/financial-kpis', authMiddleware, dispatcherMiddleware, (_req, res) => {
    try {
      const db = getDb();
      const kpis = computeFinancialKpis(db);
      res.json(kpis);
    } catch (err) {
      logger.error('FinancialKPIs', 'Failed to compute KPIs', err);
      res.status(500).json({ error: 'Failed to compute financial KPIs' });
    }
  });

  return router;
}

function computeFinancialKpis(db: import('better-sqlite3').Database) {
  // ── Balance Overview ─────────────────────────────────────────
  const balanceRow = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
      COALESCE(SUM(CASE WHEN type IN ('expense', 'deduction', 'pay') THEN ABS(amount) ELSE 0 END), 0) AS total_expenses
    FROM finances
  `).get() as { total_income: number; total_expenses: number };

  // 6-month trend
  const months: { label: string; income: number; expenses: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const next = new Date(Date.UTC(y, m + 1, 1));
    const end = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`;
    const label = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m];

    const row = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS inc,
        COALESCE(SUM(CASE WHEN type IN ('expense', 'deduction', 'pay') THEN ABS(amount) ELSE 0 END), 0) AS exp
      FROM finances WHERE created_at >= ? AND created_at < ?
    `).get(start, end) as { inc: number; exp: number };

    months.push({ label, income: Math.round(row.inc * 100) / 100, expenses: Math.round(row.exp * 100) / 100 });
  }

  // ── Revenue KPIs ─────────────────────────────────────────────
  // Total RTM flown (Revenue Ton-Miles = cargo_lbs/2000 * distance_nm)
  const rtmRow = db.prepare(`
    SELECT COALESCE(SUM(CAST(cargo_lbs AS REAL) / 2000.0 * distance_nm), 0) AS total_rtm,
           COUNT(*) AS total_flights
    FROM logbook WHERE status IN ('completed', 'approved')
  `).get() as { total_rtm: number; total_flights: number };

  // Yield per RTM by route (top 10)
  const yieldByRoute = db.prepare(`
    SELECT l.dep_icao, l.arr_icao,
           COUNT(*) AS flights,
           COALESCE(SUM(p.cargo_revenue), 0) AS revenue,
           COALESCE(SUM(CAST(l.cargo_lbs AS REAL) / 2000.0 * l.distance_nm), 0) AS rtm
    FROM finance_flight_pnl p
    JOIN logbook l ON l.id = p.logbook_id
    WHERE l.status IN ('completed', 'approved')
    GROUP BY l.dep_icao, l.arr_icao
    HAVING rtm > 0
    ORDER BY revenue DESC
    LIMIT 10
  `).all() as Array<{ dep_icao: string; arr_icao: string; flights: number; revenue: number; rtm: number }>;

  // Fleet average load factor
  const lfRow = db.prepare(`
    SELECT COALESCE(AVG(load_factor), 0) AS avg_lf
    FROM finance_flight_pnl
  `).get() as { avg_lf: number };

  // Load factor by flight (last 20)
  const lfByFlight = db.prepare(`
    SELECT l.flight_number, l.dep_icao, l.arr_icao, p.load_factor
    FROM finance_flight_pnl p
    JOIN logbook l ON l.id = p.logbook_id
    ORDER BY l.created_at DESC
    LIMIT 20
  `).all() as Array<{ flight_number: string; dep_icao: string; arr_icao: string; load_factor: number }>;

  // Charter revenue
  const charterRow = db.prepare(`
    SELECT COALESCE(SUM(p.cargo_revenue), 0) AS charter_revenue,
           COUNT(*) AS charter_flights
    FROM finance_flight_pnl p
    JOIN logbook l ON l.id = p.logbook_id
    JOIN active_bids ab ON ab.user_id = l.user_id
    JOIN scheduled_flights sf ON sf.id = ab.schedule_id
    WHERE sf.flight_type = 'charter'
      AND l.status IN ('completed', 'approved')
  `).get() as { charter_revenue: number; charter_flights: number } | undefined;

  // Fuel surcharge recovery rate (finance_rated_manifests was dropped in migration 049)
  const fuelRecoveryRow = db.prepare(`
    SELECT 0 AS surcharge_collected,
           COALESCE(SUM(p.fuel_cost), 0) AS actual_fuel_cost
    FROM finance_flight_pnl p
  `).get() as { surcharge_collected: number; actual_fuel_cost: number };

  // ── Cost KPIs ────────────────────────────────────────────────
  const costRow = db.prepare(`
    SELECT
      COALESCE(SUM(fuel_cost), 0) AS total_fuel,
      COALESCE(SUM(crew_cost), 0) AS total_crew,
      COALESCE(SUM(maint_reserve), 0) AS total_maint,
      COALESCE(SUM(total_variable_cost + total_fixed_alloc), 0) AS total_cost,
      COALESCE(SUM(block_hours), 0) AS total_bh
    FROM finance_flight_pnl
  `).get() as { total_fuel: number; total_crew: number; total_maint: number; total_cost: number; total_bh: number };

  // Maintenance cost per cycle per tail (top tails)
  const maintByTail = db.prepare(`
    SELECT l.aircraft_registration AS tail,
           COUNT(*) AS cycles,
           COALESCE(SUM(p.maint_reserve), 0) AS maint_cost
    FROM finance_flight_pnl p
    JOIN logbook l ON l.id = p.logbook_id
    WHERE l.aircraft_registration IS NOT NULL
    GROUP BY l.aircraft_registration
    ORDER BY maint_cost DESC
    LIMIT 10
  `).all() as Array<{ tail: string; cycles: number; maint_cost: number }>;

  // ── Profitability ────────────────────────────────────────────
  // Operating margin per route (top 10)
  const marginByRoute = db.prepare(`
    SELECT l.dep_icao, l.arr_icao,
           COUNT(*) AS flights,
           COALESCE(SUM(p.cargo_revenue), 0) AS revenue,
           COALESCE(SUM(p.gross_profit), 0) AS profit,
           CASE WHEN SUM(p.cargo_revenue) > 0
                THEN SUM(p.gross_profit) / SUM(p.cargo_revenue) * 100
                ELSE 0 END AS margin_pct
    FROM finance_flight_pnl p
    JOIN logbook l ON l.id = p.logbook_id
    GROUP BY l.dep_icao, l.arr_icao
    HAVING revenue > 0
    ORDER BY revenue DESC
    LIMIT 10
  `).all() as Array<{ dep_icao: string; arr_icao: string; flights: number; revenue: number; profit: number; margin_pct: number }>;

  // Contribution margin by aircraft type
  const marginByType = db.prepare(`
    SELECT l.aircraft_type,
           COUNT(*) AS flights,
           COALESCE(SUM(p.cargo_revenue), 0) AS revenue,
           COALESCE(SUM(p.total_variable_cost), 0) AS variable_cost,
           COALESCE(SUM(p.cargo_revenue - p.total_variable_cost), 0) AS contribution
    FROM finance_flight_pnl p
    JOIN logbook l ON l.id = p.logbook_id
    GROUP BY l.aircraft_type
    ORDER BY contribution DESC
  `).all() as Array<{ aircraft_type: string; flights: number; revenue: number; variable_cost: number; contribution: number }>;

  // RATM vs CATM
  // RATM = revenue ton-miles (actual cargo carried × distance)
  // CATM = capacity ton-miles (cargo_capacity_lbs × distance)
  const ratmCatmRow = db.prepare(`
    SELECT
      COALESCE(SUM(CAST(l.cargo_lbs AS REAL) / 2000.0 * l.distance_nm), 0) AS ratm,
      COALESCE(SUM(CAST(f.cargo_capacity_lbs AS REAL) / 2000.0 * l.distance_nm), 0) AS catm
    FROM logbook l
    LEFT JOIN fleet f ON f.registration = l.aircraft_registration
    WHERE l.status IN ('completed', 'approved')
  `).get() as { ratm: number; catm: number };

  // Monthly RATM/CATM trend (6 months) — per-ton-mile rates
  const ratmTrend: number[] = [];
  const catmTrend: number[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const next = new Date(Date.UTC(y, m + 1, 1));
    const end = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`;

    const monthRow = db.prepare(`
      SELECT
        COALESCE(SUM(CAST(l.cargo_lbs AS REAL) / 2000.0 * l.distance_nm), 0) AS rtm,
        COALESCE(SUM(CAST(f.cargo_capacity_lbs AS REAL) / 2000.0 * l.distance_nm), 0) AS atm
      FROM logbook l
      LEFT JOIN fleet f ON f.registration = l.aircraft_registration
      WHERE l.status IN ('completed', 'approved')
        AND l.actual_dep >= ? AND l.actual_dep < ?
    `).get(start, end) as { rtm: number; atm: number };

    const monthBalance = months[5 - i];
    ratmTrend.push(monthRow.rtm > 0 ? Math.round((monthBalance.income / monthRow.rtm) * 100) / 100 : 0);
    catmTrend.push(monthRow.atm > 0 ? Math.round((monthBalance.expenses / monthRow.atm) * 100) / 100 : 0);
  }

  // ── Network KPIs ─────────────────────────────────────────────
  // Revenue per departure by station (top 10)
  const revenueByStation = db.prepare(`
    SELECT l.dep_icao AS station,
           COUNT(*) AS departures,
           COALESCE(SUM(p.cargo_revenue), 0) AS revenue
    FROM finance_flight_pnl p
    JOIN logbook l ON l.id = p.logbook_id
    GROUP BY l.dep_icao
    ORDER BY revenue DESC
    LIMIT 10
  `).all() as Array<{ station: string; departures: number; revenue: number }>;

  // Load factor: hub vs outstation (hubs = airports with is_hub = 1, or top 5 by departures)
  let hubIcaos: string[] = [];
  try {
    const hubRows = db.prepare(`SELECT icao FROM airports WHERE is_hub = 1`).all() as Array<{ icao: string }>;
    hubIcaos = hubRows.map(r => r.icao);
  } catch { /* is_hub column may not exist */ }

  if (hubIcaos.length === 0) {
    // Fallback: top 5 departure airports
    const topRows = db.prepare(`
      SELECT dep_icao, COUNT(*) AS cnt FROM logbook GROUP BY dep_icao ORDER BY cnt DESC LIMIT 5
    `).all() as Array<{ dep_icao: string; cnt: number }>;
    hubIcaos = topRows.map(r => r.dep_icao);
  }

  let hubLf = 0, outstationLf = 0;
  if (hubIcaos.length > 0) {
    const placeholders = hubIcaos.map(() => '?').join(',');
    const hubLfRow = db.prepare(`
      SELECT COALESCE(AVG(p.load_factor), 0) AS avg_lf
      FROM finance_flight_pnl p
      JOIN logbook l ON l.id = p.logbook_id
      WHERE l.dep_icao IN (${placeholders})
    `).get(...hubIcaos) as { avg_lf: number };
    hubLf = hubLfRow.avg_lf;

    const outLfRow = db.prepare(`
      SELECT COALESCE(AVG(p.load_factor), 0) AS avg_lf
      FROM finance_flight_pnl p
      JOIN logbook l ON l.id = p.logbook_id
      WHERE l.dep_icao NOT IN (${placeholders})
    `).get(...hubIcaos) as { avg_lf: number };
    outstationLf = outLfRow.avg_lf;
  }

  // Yield trend over time (monthly, last 6 months)
  const yieldTrend: { label: string; yield: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const next = new Date(Date.UTC(y, m + 1, 1));
    const end = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`;
    const label = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m];

    const row = db.prepare(`
      SELECT COALESCE(SUM(p.cargo_revenue), 0) AS rev,
             COALESCE(SUM(CAST(l.cargo_lbs AS REAL) / 2000.0 * l.distance_nm), 0) AS rtm
      FROM finance_flight_pnl p
      JOIN logbook l ON l.id = p.logbook_id
      WHERE l.created_at >= ? AND l.created_at < ?
    `).get(start, end) as { rev: number; rtm: number };

    yieldTrend.push({ label, yield: row.rtm > 0 ? Math.round((row.rev / row.rtm) * 100) / 100 : 0 });
  }

  return {
    balance: {
      totalIncome: Math.round(balanceRow.total_income * 100) / 100,
      totalExpenses: Math.round(balanceRow.total_expenses * 100) / 100,
      netBalance: Math.round((balanceRow.total_income - balanceRow.total_expenses) * 100) / 100,
      months,
    },
    revenue: {
      totalRtm: Math.round(rtmRow.total_rtm),
      totalFlights: rtmRow.total_flights,
      yieldByRoute: yieldByRoute.map(r => ({
        route: `${r.dep_icao}-${r.arr_icao}`,
        flights: r.flights,
        revenue: Math.round(r.revenue * 100) / 100,
        rtm: Math.round(r.rtm),
        yieldPerRtm: r.rtm > 0 ? Math.round((r.revenue / r.rtm) * 100) / 100 : 0,
      })),
      fleetAvgLoadFactor: Math.round(lfRow.avg_lf * 10) / 10,
      loadFactorByFlight: lfByFlight.map(r => ({
        flight: r.flight_number,
        route: `${r.dep_icao}-${r.arr_icao}`,
        loadFactor: Math.round(r.load_factor * 10) / 10,
      })),
      charterRevenue: Math.round((charterRow?.charter_revenue ?? 0) * 100) / 100,
      charterFlights: charterRow?.charter_flights ?? 0,
      fuelSurchargeRecovery: fuelRecoveryRow.actual_fuel_cost > 0
        ? Math.round((fuelRecoveryRow.surcharge_collected / fuelRecoveryRow.actual_fuel_cost) * 1000) / 10
        : 0,
    },
    costs: {
      fuelPerBlockHour: costRow.total_bh > 0 ? Math.round((costRow.total_fuel / costRow.total_bh) * 100) / 100 : 0,
      costPerRtm: rtmRow.total_rtm > 0 ? Math.round((costRow.total_cost / rtmRow.total_rtm) * 100) / 100 : 0,
      crewPerBlockHour: costRow.total_bh > 0 ? Math.round((costRow.total_crew / costRow.total_bh) * 100) / 100 : 0,
      maintByTail: maintByTail.map(r => ({
        tail: r.tail,
        cycles: r.cycles,
        costPerCycle: r.cycles > 0 ? Math.round((r.maint_cost / r.cycles) * 100) / 100 : 0,
      })),
    },
    profitability: {
      ratm: Math.round(ratmCatmRow.ratm),
      catm: Math.round(ratmCatmRow.catm),
      ratmCatmSpread: ratmCatmRow.catm > 0
        ? Math.round((ratmCatmRow.ratm / ratmCatmRow.catm) * 1000) / 10
        : 0,
      ratmTrend,
      catmTrend,
      marginByRoute: marginByRoute.map(r => ({
        route: `${r.dep_icao}-${r.arr_icao}`,
        flights: r.flights,
        revenue: Math.round(r.revenue * 100) / 100,
        profit: Math.round(r.profit * 100) / 100,
        marginPct: Math.round(r.margin_pct * 10) / 10,
      })),
      marginByType: marginByType.map(r => ({
        type: r.aircraft_type,
        flights: r.flights,
        revenue: Math.round(r.revenue * 100) / 100,
        contribution: Math.round(r.contribution * 100) / 100,
        marginPct: r.revenue > 0 ? Math.round(((r.contribution / r.revenue) * 100) * 10) / 10 : 0,
      })),
    },
    network: {
      revenueByStation: revenueByStation.map(r => ({
        station: r.station,
        departures: r.departures,
        revenuePerDeparture: r.departures > 0 ? Math.round((r.revenue / r.departures) * 100) / 100 : 0,
      })),
      hubLoadFactor: Math.round(hubLf * 10) / 10,
      outstationLoadFactor: Math.round(outstationLf * 10) / 10,
      hubs: hubIcaos,
      yieldTrend,
    },
  };
}
