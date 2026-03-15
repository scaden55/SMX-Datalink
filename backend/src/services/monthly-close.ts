import { getDb } from '../db/index.js';
import { logger } from '../lib/logger.js';
import { FinanceService } from './finance.js';

const TAG = 'MonthlyClose';

interface FlightAggregateRow {
  flights_count: number;
  total_block_hours: number;
  total_revenue: number;
  cargo_revenue: number;
  fuel_surcharge_rev: number;
  total_doc: number;
  fuel_cost: number;
  crew_cost: number;
  landing_fees: number;
  handling_fees: number;
  nav_fees: number;
  maintenance_reserve: number;
}

interface FleetFinancingRow {
  id: number;
  registration: string;
  acquisition_type: string;
  lease_monthly: number;
  insurance_monthly: number;
  depreciation_monthly: number;
  loan_balance: number;
  interest_rate: number;
  loan_term_months: number;
  book_value: number;
  base_icao: string | null;
  acquisition_cost: number;
  useful_life_years: number;
}

interface ParkingRateRow {
  parking_rate: number;
}

interface MaintenanceShortfallRow {
  total: number;
}

interface PeriodKeyRow {
  period_key: string;
}

export class MonthlyCloseService {
  private financeService: FinanceService;

  constructor() {
    this.financeService = new FinanceService();
  }

  /** Returns current month as 'YYYY-MM' format */
  getCurrentPeriodKey(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /** Query finance_period_pnl for the most recent period_key */
  getLastClosedPeriod(): string | null {
    const row = getDb().prepare(`
      SELECT period_key FROM finance_period_pnl
      WHERE period_type = 'monthly'
      ORDER BY period_key DESC LIMIT 1
    `).get() as PeriodKeyRow | undefined;
    return row?.period_key ?? null;
  }

  /** Idempotent — UPSERTs the period P&L for the given month */
  closeMonth(periodKey: string): void {
    const db = getDb();
    const periodStart = `${periodKey}-01`;
    const periodEnd = this.getNextMonthStart(periodKey);

    logger.info(TAG, `Closing month ${periodKey}`, { periodStart, periodEnd });

    // ── 1. Aggregate flight P&L ──────────────────────────────────
    const flightAgg = db.prepare(`
      SELECT
        COUNT(*) as flights_count,
        COALESCE(SUM(block_hours), 0) as total_block_hours,
        COALESCE(SUM(total_revenue), 0) as total_revenue,
        COALESCE(SUM(cargo_revenue), 0) as cargo_revenue,
        COALESCE(SUM(fuel_surcharge), 0) as fuel_surcharge_rev,
        COALESCE(SUM(total_variable_cost), 0) as total_doc,
        COALESCE(SUM(fuel_cost), 0) as fuel_cost,
        COALESCE(SUM(crew_cost), 0) as crew_cost,
        COALESCE(SUM(landing_fee), 0) as landing_fees,
        COALESCE(SUM(handling_fee), 0) as handling_fees,
        COALESCE(SUM(nav_fee), 0) as nav_fees,
        COALESCE(SUM(maint_reserve), 0) as maintenance_reserve
      FROM finance_flight_pnl
      WHERE computed_at >= ? AND computed_at < ?
    `).get(periodStart, periodEnd) as FlightAggregateRow;

    const totalRevenue = flightAgg.total_revenue;
    const totalDoc = flightAgg.total_doc;
    const totalBlockHours = flightAgg.total_block_hours;
    const flightsCount = flightAgg.flights_count;

    // ── 2. Generate fixed costs per active aircraft ──────────────
    const aircraft = db.prepare(`
      SELECT id, registration, acquisition_type, lease_monthly, insurance_monthly,
             depreciation_monthly, loan_balance, interest_rate, loan_term_months,
             book_value, base_icao, acquisition_cost, useful_life_years
      FROM fleet WHERE status IN ('active', 'maintenance') AND is_active = 1
    `).all() as FleetFinancingRow[];

    let leasePayments = 0;
    let loanPayments = 0;
    let insurance = 0;
    let depreciation = 0;
    let hangarParking = 0;
    const activeAircraftCount = aircraft.length;

    // Default parking rate for aircraft with no base
    const defaultParkingRow = db.prepare(
      `SELECT parking_rate FROM airport_fee_tiers WHERE tier = 'regional'`
    ).get() as ParkingRateRow | undefined;
    const defaultParkingRate = defaultParkingRow?.parking_rate ?? 20;

    for (const ac of aircraft) {
      let acFixedCost = 0;

      // Lease / Loan / Purchase costs
      switch (ac.acquisition_type) {
        case 'dry_lease':
        case 'wet_lease':
        case 'acmi': {
          const leaseAmount = ac.lease_monthly;
          leasePayments += leaseAmount;
          acFixedCost += leaseAmount;
          break;
        }
        case 'loan': {
          if (ac.loan_balance > 0 && ac.interest_rate > 0 && ac.loan_term_months > 0) {
            const r = ac.interest_rate / 12 / 100;
            const n = ac.loan_term_months;
            const payment = ac.loan_balance * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
            loanPayments += payment;
            acFixedCost += payment;

            // Update loan balance (subtract principal portion)
            const interestPortion = ac.loan_balance * r;
            const principalPortion = payment - interestPortion;
            const newBalance = Math.max(0, ac.loan_balance - principalPortion);
            db.prepare('UPDATE fleet SET loan_balance = ?, loan_term_months = ? WHERE id = ?')
              .run(newBalance, Math.max(0, n - 1), ac.id);
          }
          break;
        }
        case 'purchased':
        default: {
          // Depreciation
          if (ac.acquisition_cost > 0 && ac.useful_life_years > 0) {
            const depAmount = ac.acquisition_cost / (ac.useful_life_years * 12);
            depreciation += depAmount;
            acFixedCost += depAmount;
          }
          break;
        }
      }

      // Insurance (not bundled with ACMI)
      if (ac.acquisition_type !== 'acmi') {
        insurance += ac.insurance_monthly;
        acFixedCost += ac.insurance_monthly;
      }

      // Hangar/parking costs: look up base_icao tier → parking_rate * 500
      let parkingRate = defaultParkingRate;
      if (ac.base_icao) {
        const airportRow = db.prepare(
          `SELECT aft.parking_rate FROM airports a
           JOIN airport_fee_tiers aft ON aft.tier = a.fee_tier
           WHERE a.icao = ?`
        ).get(ac.base_icao) as ParkingRateRow | undefined;
        if (airportRow) {
          parkingRate = airportRow.parking_rate;
        }
      }
      const hangarCost = parkingRate * 500;
      hangarParking += hangarCost;
      acFixedCost += hangarCost;

      // Create finance ledger entry for this aircraft
      if (acFixedCost > 0) {
        this.financeService.create({
          pilotId: null,
          type: 'expense',
          amount: acFixedCost,
          description: `Monthly fixed costs - ${ac.registration}`,
          category: 'fixed_costs',
        }, 0);
      }
    }

    const totalFixed = leasePayments + loanPayments + insurance + depreciation + hangarParking;

    // ── 3. Maintenance shortfall ─────────────────────────────────
    const shortfallRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM finances
      WHERE category = 'maintenance_shortfall' AND created_at >= ? AND created_at < ?
    `).get(periodStart, periodEnd) as MaintenanceShortfallRow;
    const maintenanceShortfall = shortfallRow.total;

    // ── 4. Calculate KPIs ────────────────────────────────────────
    const operatingIncome = totalRevenue - totalDoc - totalFixed - maintenanceShortfall;
    const operatingMarginPct = totalRevenue > 0 ? (operatingIncome / totalRevenue) * 100 : 0;

    // Simplified ATM: block_hours * avg_cargo_capacity * avg_cruise_speed / 2000
    // Use a reasonable cargo freighter average: 80,000 lbs capacity, 450 kt cruise
    const avgCargoCapacity = 80000;
    const avgCruiseSpeed = 450;
    const totalAtm = totalBlockHours * avgCargoCapacity * avgCruiseSpeed / 2000;

    const ratm = totalAtm > 0 ? totalRevenue / totalAtm : 0;
    const catm = totalAtm > 0 ? (totalDoc + totalFixed) / totalAtm : 0;

    const fleetUtilizationPct = activeAircraftCount > 0
      ? (totalBlockHours / (activeAircraftCount * 720)) * 100
      : 0;

    const breakEvenLf = totalRevenue > 0 ? (totalDoc + totalFixed) / totalRevenue : 0;

    // Average load factor from flight P&L
    const avgLoadFactorRow = db.prepare(`
      SELECT COALESCE(AVG(load_factor), 0) as avg_lf FROM finance_flight_pnl
      WHERE computed_at >= ? AND computed_at < ?
    `).get(periodStart, periodEnd) as { avg_lf: number };
    const avgLoadFactor = avgLoadFactorRow.avg_lf;

    // Daily utilization = total block hours / (active aircraft * days in month)
    const daysInMonth = this.getDaysInMonth(periodKey);
    const avgUtilizationHrs = activeAircraftCount > 0
      ? totalBlockHours / (activeAircraftCount * daysInMonth)
      : 0;

    // EBITDA = revenue - variable costs - fixed costs (excl depreciation)
    const ebitda = totalRevenue - totalDoc - (totalFixed - depreciation);
    const netIncome = operatingIncome;

    // Airport fees = landing + handling + nav + parking from flight P&L
    const airportFees = flightAgg.landing_fees + flightAgg.handling_fees + flightAgg.nav_fees;

    // ── 5. UPSERT into finance_period_pnl ────────────────────────
    db.prepare(`
      INSERT INTO finance_period_pnl (
        period_type, period_key,
        total_revenue, cargo_revenue, pax_revenue, charter_revenue, surcharge_revenue,
        total_variable_cost, total_fixed_cost,
        fuel_cost, maintenance_cost, lease_cost, crew_cost, airport_fees,
        ebitda, net_income,
        ratm, catm, avg_load_factor, avg_utilization_hrs,
        total_flights, total_block_hours, total_asm,
        computed_at
      ) VALUES (
        'monthly', ?,
        ?, ?, 0, 0, ?,
        ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        datetime('now')
      )
      ON CONFLICT(period_type, period_key) DO UPDATE SET
        total_revenue = excluded.total_revenue,
        cargo_revenue = excluded.cargo_revenue,
        surcharge_revenue = excluded.surcharge_revenue,
        total_variable_cost = excluded.total_variable_cost,
        total_fixed_cost = excluded.total_fixed_cost,
        fuel_cost = excluded.fuel_cost,
        maintenance_cost = excluded.maintenance_cost,
        lease_cost = excluded.lease_cost,
        crew_cost = excluded.crew_cost,
        airport_fees = excluded.airport_fees,
        ebitda = excluded.ebitda,
        net_income = excluded.net_income,
        ratm = excluded.ratm,
        catm = excluded.catm,
        avg_load_factor = excluded.avg_load_factor,
        avg_utilization_hrs = excluded.avg_utilization_hrs,
        total_flights = excluded.total_flights,
        total_block_hours = excluded.total_block_hours,
        total_asm = excluded.total_asm,
        computed_at = datetime('now')
    `).run(
      periodKey,
      totalRevenue, flightAgg.cargo_revenue, flightAgg.fuel_surcharge_rev,
      totalDoc, totalFixed,
      flightAgg.fuel_cost, flightAgg.maintenance_reserve + maintenanceShortfall,
      leasePayments + loanPayments, flightAgg.crew_cost, airportFees,
      ebitda, netIncome,
      ratm, catm, avgLoadFactor, avgUtilizationHrs,
      flightsCount, totalBlockHours, totalAtm,
    );

    logger.info(TAG, `Month ${periodKey} closed`, {
      flights: flightsCount,
      revenue: Math.round(totalRevenue),
      doc: Math.round(totalDoc),
      fixedCosts: Math.round(totalFixed),
      netIncome: Math.round(netIncome),
      aircraft: activeAircraftCount,
    });
  }

  /** Close any missed months between the last closed period and current */
  checkAndCloseMissedMonths(): void {
    const lastClosed = this.getLastClosedPeriod();
    const current = this.getCurrentPeriodKey();

    if (!lastClosed) {
      logger.info(TAG, 'No previously closed periods found');
      return;
    }

    const missed = this.getMonthsBetween(lastClosed, current);
    if (missed.length === 0) {
      return;
    }

    logger.info(TAG, `Closing ${missed.length} missed month(s)`, { missed });
    for (const periodKey of missed) {
      this.closeMonth(periodKey);
    }
  }

  /** Close the current month and return the period key */
  triggerManualClose(): string {
    const periodKey = this.getCurrentPeriodKey();
    this.closeMonth(periodKey);
    return periodKey;
  }

  // ── Helpers ──────────────────────────────────────────────────────

  /** Returns the first day of the month after the given period key */
  private getNextMonthStart(periodKey: string): string {
    const [yearStr, monthStr] = periodKey.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    return `${year}-${String(month).padStart(2, '0')}-01`;
  }

  /** Returns the number of days in the given month */
  private getDaysInMonth(periodKey: string): number {
    const [yearStr, monthStr] = periodKey.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    return new Date(year, month, 0).getDate();
  }

  /** Returns all month keys strictly between lastClosed and current (exclusive of lastClosed) */
  private getMonthsBetween(lastClosed: string, current: string): string[] {
    const months: string[] = [];
    const [startYear, startMonth] = lastClosed.split('-').map(Number);
    const [endYear, endMonth] = current.split('-').map(Number);

    let year = startYear;
    let month = startMonth + 1;
    if (month > 12) { month = 1; year += 1; }

    while (year < endYear || (year === endYear && month <= endMonth)) {
      months.push(`${year}-${String(month).padStart(2, '0')}`);
      month += 1;
      if (month > 12) { month = 1; year += 1; }
    }

    return months;
  }
}
