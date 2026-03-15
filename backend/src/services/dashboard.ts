import type Database from 'better-sqlite3';

// ── Return type ─────────────────────────────────────────────────
export interface FlightsPerDay {
  day: number;
  count: number;
}

export interface PeriodPnlEntry {
  periodKey: string;
  totalRevenue: number;
  totalDoc: number;
  totalFixed: number;
  ebitda: number;
  netIncome: number;
  ratm: number;
  catm: number;
  avgLoadFactor: number;
  avgUtilizationHrs: number;
  totalFlights: number;
}

export interface RouteMarginEntry {
  depIcao: string;
  arrIcao: string;
  avgMarginPct: number;
  flights: number;
}

export interface DashboardData {
  activeFlights: number;
  pendingPireps: number;
  fleetHealthPct: number;
  monthlyRevenue: number;
  flightsPerDay: FlightsPerDay[];
  recentFlights: RecentFlight[];
  maintenanceAlerts: MaintenanceAlert[];
  pilotActivity: PilotActivity[];
  financialSummary: FinancialSummary;
  periodPnl: PeriodPnlEntry[];
  routeMargins: RouteMarginEntry[];
}

interface RecentFlight {
  id: number;
  flightNumber: string;
  depIcao: string;
  arrIcao: string;
  status: string;
  pilotCallsign: string;
  landingRate: number | null;
  createdAt: string;
}

interface MaintenanceAlert {
  type: string;
  aircraftReg: string;
  description: string;
  severity: string;
}

interface PilotActivity {
  callsign: string;
  firstName: string;
  lastName: string;
  hoursThisMonth: number;
}

interface FinancialSummary {
  months: string[];
  income: number[];
  costs: number[];
  profit: number[];
}

// ── Month helpers ───────────────────────────────────────────────
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthStart(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

/** Returns the ISO date string for the 1st of each of the last `n` months (including current). */
function lastNMonthStarts(n: number): { label: string; start: string; end: string }[] {
  const result: { label: string; start: string; end: string }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    // end = 1st of next month
    const next = new Date(Date.UTC(y, m + 1, 1));
    const end = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`;
    result.push({ label: MONTH_NAMES[m], start, end });
  }
  return result;
}

// ── Main aggregation ────────────────────────────────────────────
export function getDashboardData(db: Database.Database): DashboardData {
  // 1. Active flights — bids in 'active' or 'airborne' phase
  const activeRow = db.prepare(`
    SELECT COUNT(*) AS cnt FROM active_bids
    WHERE flight_plan_phase IN ('active', 'airborne')
  `).get() as { cnt: number } | undefined;
  const activeFlights = activeRow?.cnt ?? 0;

  // 2. Pending PIREPs
  const pendingRow = db.prepare(`
    SELECT COUNT(*) AS cnt FROM logbook WHERE status = 'pending'
  `).get() as { cnt: number } | undefined;
  const pendingPireps = pendingRow?.cnt ?? 0;

  // 3. Fleet health % — aircraft with no overdue scheduled/in-progress maintenance
  let fleetHealthPct = 100;
  try {
    const totalRow = db.prepare(`SELECT COUNT(*) AS cnt FROM fleet WHERE status = 'active'`).get() as { cnt: number } | undefined;
    const total = totalRow?.cnt ?? 0;
    if (total > 0) {
      const unhealthyRow = db.prepare(`
        SELECT COUNT(DISTINCT ml.aircraft_id) AS cnt
        FROM maintenance_log ml
        JOIN fleet f ON f.id = ml.aircraft_id
        WHERE f.status = 'active'
          AND ml.status IN ('scheduled', 'in_progress')
      `).get() as { cnt: number } | undefined;
      const unhealthy = unhealthyRow?.cnt ?? 0;
      fleetHealthPct = Math.round(((total - unhealthy) / total) * 100);
    }
  } catch {
    // maintenance tables may not exist — default to 100
    fleetHealthPct = 100;
  }

  // 4. Monthly revenue — income this calendar month
  const mStart = monthStart();
  const revenueRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM finances
    WHERE type = 'income' AND created_at >= ?
  `).get(mStart) as { total: number } | undefined;
  const monthlyRevenue = revenueRow?.total ?? 0;

  // 5. Recent flights (last 10)
  const recentRows = db.prepare(`
    SELECT l.id, l.flight_number, l.dep_icao, l.arr_icao, l.status,
           u.callsign AS pilot_callsign, l.landing_rate_fpm, l.created_at
    FROM logbook l
    JOIN users u ON u.id = l.user_id
    ORDER BY l.created_at DESC
    LIMIT 10
  `).all() as Array<{
    id: number;
    flight_number: string;
    dep_icao: string;
    arr_icao: string;
    status: string;
    pilot_callsign: string;
    landing_rate_fpm: number | null;
    created_at: string;
  }>;
  const recentFlights: RecentFlight[] = recentRows.map(r => ({
    id: r.id,
    flightNumber: r.flight_number,
    depIcao: r.dep_icao,
    arrIcao: r.arr_icao,
    status: r.status,
    pilotCallsign: r.pilot_callsign,
    landingRate: r.landing_rate_fpm,
    createdAt: r.created_at,
  }));

  // 6. Flights per day — current month, zero-filled
  const now = new Date();
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const flightDayRows = db.prepare(`
    SELECT CAST(strftime('%d', created_at) AS INTEGER) AS day, COUNT(*) AS cnt
    FROM logbook
    WHERE created_at >= ?
    GROUP BY day
  `).all(mStart) as Array<{ day: number; cnt: number }>;
  const dayMap = new Map(flightDayRows.map(r => [r.day, r.cnt]));
  const flightsPerDay: FlightsPerDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    flightsPerDay.push({ day: d, count: dayMap.get(d) ?? 0 });
  }

  // 7. Maintenance alerts — open MEL deferrals + scheduled/in-progress maintenance
  const maintenanceAlerts: MaintenanceAlert[] = [];
  try {
    const melRows = db.prepare(`
      SELECT md.title, md.category, f.registration
      FROM mel_deferrals md
      JOIN fleet f ON f.id = md.aircraft_id
      WHERE md.status = 'open'
      ORDER BY md.created_at DESC
      LIMIT 10
    `).all() as Array<{ title: string; category: string; registration: string }>;
    for (const r of melRows) {
      maintenanceAlerts.push({
        type: 'MEL',
        aircraftReg: r.registration,
        description: r.title,
        severity: r.category === 'A' ? 'critical' : r.category === 'B' ? 'high' : 'medium',
      });
    }

    const logRows = db.prepare(`
      SELECT ml.check_type, ml.title, ml.status AS mstatus, f.registration
      FROM maintenance_log ml
      JOIN fleet f ON f.id = ml.aircraft_id
      WHERE ml.status IN ('scheduled', 'in_progress')
      ORDER BY ml.created_at DESC
      LIMIT 10
    `).all() as Array<{ check_type: string; title: string; mstatus: string; registration: string }>;
    for (const r of logRows) {
      maintenanceAlerts.push({
        type: r.check_type,
        aircraftReg: r.registration,
        description: r.title,
        severity: r.mstatus === 'in_progress' ? 'high' : 'medium',
      });
    }
  } catch {
    // maintenance tables may not exist — leave empty
  }

  // 7. Pilot activity — top 10 pilots by hours this month
  const pilotRows = db.prepare(`
    SELECT u.callsign, u.first_name, u.last_name,
           COALESCE(SUM(l.flight_time_min), 0) / 60.0 AS hours_this_month
    FROM logbook l
    JOIN users u ON u.id = l.user_id
    WHERE l.created_at >= ?
    GROUP BY l.user_id
    ORDER BY hours_this_month DESC
    LIMIT 10
  `).all(mStart) as Array<{
    callsign: string;
    first_name: string;
    last_name: string;
    hours_this_month: number;
  }>;
  const pilotActivity: PilotActivity[] = pilotRows.map(r => ({
    callsign: r.callsign,
    firstName: r.first_name,
    lastName: r.last_name,
    hoursThisMonth: Math.round(r.hours_this_month * 10) / 10,
  }));

  // 8. Financial summary — last 6 months
  const periods = lastNMonthStarts(6);
  const months: string[] = [];
  const income: number[] = [];
  const costs: number[] = [];
  const profit: number[] = [];

  for (const p of periods) {
    months.push(p.label);

    const incRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total FROM finances
      WHERE type = 'income' AND created_at >= ? AND created_at < ?
    `).get(p.start, p.end) as { total: number };
    const inc = incRow.total;

    const costRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total FROM finances
      WHERE type IN ('expense', 'deduction') AND created_at >= ? AND created_at < ?
    `).get(p.start, p.end) as { total: number };
    const cost = costRow.total;

    income.push(Math.round(inc * 100) / 100);
    costs.push(Math.round(Math.abs(cost) * 100) / 100);
    profit.push(Math.round((inc - Math.abs(cost)) * 100) / 100);
  }

  const financialSummary: FinancialSummary = { months, income, costs, profit };

  // 9. Period P&L from finance_period_pnl (last 6 monthly periods)
  let periodPnl: PeriodPnlEntry[] = [];
  try {
    const pnlRows = db.prepare(`
      SELECT period_key, total_revenue, total_variable_cost, total_fixed_cost,
             ebitda, net_income, ratm, catm, avg_load_factor, avg_utilization_hrs, total_flights
      FROM finance_period_pnl
      WHERE period_type = 'monthly'
      ORDER BY period_key DESC
      LIMIT 6
    `).all() as Array<{
      period_key: string;
      total_revenue: number;
      total_variable_cost: number;
      total_fixed_cost: number;
      ebitda: number;
      net_income: number;
      ratm: number;
      catm: number;
      avg_load_factor: number;
      avg_utilization_hrs: number;
      total_flights: number;
    }>;
    periodPnl = pnlRows.map(r => ({
      periodKey: r.period_key,
      totalRevenue: Math.round(r.total_revenue * 100) / 100,
      totalDoc: Math.round(r.total_variable_cost * 100) / 100,
      totalFixed: Math.round(r.total_fixed_cost * 100) / 100,
      ebitda: Math.round(r.ebitda * 100) / 100,
      netIncome: Math.round(r.net_income * 100) / 100,
      ratm: Math.round(r.ratm * 100) / 100,
      catm: Math.round(r.catm * 100) / 100,
      avgLoadFactor: Math.round(r.avg_load_factor * 10) / 10,
      avgUtilizationHrs: Math.round(r.avg_utilization_hrs * 10) / 10,
      totalFlights: r.total_flights,
    }));
  } catch {
    // finance_period_pnl table may not exist yet
  }

  // 10. Route margins from finance_flight_pnl (top 10 by margin)
  let routeMargins: RouteMarginEntry[] = [];
  try {
    const routeRows = db.prepare(`
      SELECT l.dep_icao, l.arr_icao, AVG(p.margin_pct) AS avg_margin_pct, COUNT(*) AS flights
      FROM finance_flight_pnl p
      JOIN logbook l ON l.id = p.logbook_id
      GROUP BY l.dep_icao, l.arr_icao
      ORDER BY avg_margin_pct DESC
      LIMIT 10
    `).all() as Array<{
      dep_icao: string;
      arr_icao: string;
      avg_margin_pct: number;
      flights: number;
    }>;
    routeMargins = routeRows.map(r => ({
      depIcao: r.dep_icao,
      arrIcao: r.arr_icao,
      avgMarginPct: Math.round(r.avg_margin_pct * 10) / 10,
      flights: r.flights,
    }));
  } catch {
    // finance_flight_pnl table may not exist yet
  }

  return {
    activeFlights,
    pendingPireps,
    fleetHealthPct,
    monthlyRevenue,
    flightsPerDay,
    recentFlights,
    maintenanceAlerts,
    pilotActivity,
    financialSummary,
    periodPnl,
    routeMargins,
  };
}
