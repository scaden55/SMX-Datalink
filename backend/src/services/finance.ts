import { getDb } from '../db/index.js';
import type { FinanceEntry, FinanceType, FinanceFilters, PilotBalance, FinanceSummary } from '@acars/shared';
import type { FinanceBalanceQueryRow, FinanceSummaryQueryRow, RouteProfitabilityRow, PilotPaySummaryRow, RevenueByFlightRow } from '../types/db-rows.js';

interface FinanceRow {
  id: number;
  pilot_id: number;
  pirep_id: number | null;
  type: string;
  amount: number;
  description: string | null;
  created_by: number | null;
  created_at: string;
  pilot_callsign: string;
  pilot_name: string;
  creator_callsign: string | null;
}

const VALID_TYPES = new Set<FinanceType>(['pay', 'bonus', 'deduction', 'expense', 'income']);

export class FinanceService {

  create(data: { pilotId: number; type: FinanceType; amount: number; description?: string; pirepId?: number | null; category?: string }, createdBy: number): number {
    const category = data.category ?? (data.type === 'income' ? 'revenue' : data.type === 'pay' ? 'payroll' : data.type === 'expense' ? 'expense' : 'admin');
    const result = getDb().prepare(`
      INSERT INTO finances (pilot_id, pirep_id, type, amount, description, created_by, category)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(data.pilotId, data.pirepId ?? null, data.type, data.amount, data.description ?? null, createdBy, category);
    return result.lastInsertRowid as number;
  }

  findAll(filters?: FinanceFilters, page = 1, pageSize = 50): { entries: FinanceEntry[]; total: number } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.pilotId) {
      conditions.push('f.pilot_id = ?');
      params.push(filters.pilotId);
    }
    if (filters?.type && VALID_TYPES.has(filters.type)) {
      conditions.push('f.type = ?');
      params.push(filters.type);
    }
    if (filters?.dateFrom) {
      conditions.push('f.created_at >= ?');
      params.push(filters.dateFrom);
    }
    if (filters?.dateTo) {
      conditions.push('f.created_at <= ?');
      params.push(filters.dateTo);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as count FROM finances f ${where}`;
    const { count: total } = getDb().prepare(countSql).get(...params) as { count: number };

    const offset = (page - 1) * pageSize;
    const sql = `
      SELECT f.*,
        p.callsign AS pilot_callsign,
        p.first_name || ' ' || p.last_name AS pilot_name,
        c.callsign AS creator_callsign
      FROM finances f
      LEFT JOIN users p ON p.id = f.pilot_id
      LEFT JOIN users c ON c.id = f.created_by
      ${where}
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = getDb().prepare(sql).all(...params, pageSize, offset) as FinanceRow[];
    return { entries: rows.map(this.toEntry), total };
  }

  getPilotBalance(pilotId: number): number {
    const row = getDb().prepare(`
      SELECT COALESCE(SUM(CASE WHEN type IN ('pay', 'bonus', 'income') THEN amount ELSE -amount END), 0) AS balance
      FROM finances WHERE pilot_id = ?
    `).get(pilotId) as { balance: number };
    return row.balance;
  }

  getAllBalances(): PilotBalance[] {
    const rows = getDb().prepare(`
      SELECT
        u.id AS pilot_id,
        u.callsign,
        u.first_name || ' ' || u.last_name AS pilot_name,
        COALESCE(SUM(CASE WHEN f.type IN ('pay', 'bonus', 'income') THEN f.amount ELSE -f.amount END), 0) AS balance,
        COALESCE(SUM(CASE WHEN f.type = 'pay' THEN f.amount ELSE 0 END), 0) AS total_pay,
        COALESCE(SUM(CASE WHEN f.type = 'bonus' THEN f.amount ELSE 0 END), 0) AS total_bonuses,
        COALESCE(SUM(CASE WHEN f.type = 'deduction' THEN f.amount ELSE 0 END), 0) AS total_deductions
      FROM users u
      LEFT JOIN finances f ON f.pilot_id = u.id
      WHERE u.status = 'active'
      GROUP BY u.id
      ORDER BY u.callsign
    `).all() as FinanceBalanceQueryRow[];

    return rows.map(r => ({
      pilotId: r.pilot_id,
      callsign: r.callsign,
      pilotName: r.pilot_name,
      balance: r.balance,
      totalPay: r.total_pay,
      totalBonuses: r.total_bonuses,
      totalDeductions: r.total_deductions,
    }));
  }

  getSummary(dateFrom?: string, dateTo?: string): FinanceSummary {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (dateFrom) { conditions.push('created_at >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('created_at <= ?'); params.push(dateTo); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const row = getDb().prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'pay' THEN amount ELSE 0 END), 0) AS total_pay,
        COALESCE(SUM(CASE WHEN type = 'bonus' THEN amount ELSE 0 END), 0) AS total_bonuses,
        COALESCE(SUM(CASE WHEN type = 'deduction' THEN amount ELSE 0 END), 0) AS total_deductions,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expenses,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income
      FROM finances ${where}
    `).get(...params) as FinanceSummaryQueryRow;

    const totalPay = row.total_pay;
    const totalBonuses = row.total_bonuses;
    const totalDeductions = row.total_deductions;
    const totalExpenses = row.total_expenses;
    const totalIncome = row.total_income;

    return {
      totalPay,
      totalBonuses,
      totalDeductions,
      totalExpenses,
      totalIncome,
      netTotal: totalPay + totalBonuses + totalIncome - totalDeductions - totalExpenses,
    };
  }

  getRouteProfitability(dateFrom?: string, dateTo?: string): Array<{
    route: string; depIcao: string; arrIcao: string;
    flights: number; revenue: number; costs: number; profit: number; margin: number;
  }> {
    const conditions: string[] = ["l.status = 'approved'"];
    const params: unknown[] = [];
    if (dateFrom) { conditions.push('l.created_at >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('l.created_at <= ?'); params.push(dateTo); }

    const rows = getDb().prepare(`
      SELECT
        l.dep_icao,
        l.arr_icao,
        COUNT(DISTINCT l.id) AS flights,
        COALESCE(SUM(CASE WHEN f.type = 'income' THEN f.amount ELSE 0 END), 0) AS revenue,
        COALESCE(SUM(CASE WHEN f.type = 'pay' THEN f.amount ELSE 0 END), 0) AS costs
      FROM logbook l
      LEFT JOIN finances f ON f.pirep_id = l.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY l.dep_icao, l.arr_icao
      HAVING flights > 0
      ORDER BY (revenue - costs) DESC
      LIMIT 20
    `).all(...params) as RouteProfitabilityRow[];

    return rows.map(r => {
      const profit = r.revenue - r.costs;
      const margin = r.revenue > 0 ? Math.round((profit / r.revenue) * 1000) / 10 : 0;
      return {
        route: `${r.dep_icao}-${r.arr_icao}`,
        depIcao: r.dep_icao,
        arrIcao: r.arr_icao,
        flights: r.flights,
        revenue: Math.round(r.revenue * 100) / 100,
        costs: Math.round(r.costs * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        margin,
      };
    });
  }

  getRevenueByFlight(filters?: { dateFrom?: string; dateTo?: string; pilotId?: number }, page = 1, pageSize = 50): { entries: Array<{
    financeId: number; pirepId: number; flightNumber: string; depIcao: string; arrIcao: string;
    aircraftType: string; cargoLbs: number; revenue: number; pilotCallsign: string; pilotName: string; flightDate: string;
  }>; total: number } {
    const conditions: string[] = ["f.type = 'income'", 'f.pirep_id IS NOT NULL'];
    const params: unknown[] = [];
    if (filters?.dateFrom) { conditions.push('f.created_at >= ?'); params.push(filters.dateFrom); }
    if (filters?.dateTo) { conditions.push('f.created_at <= ?'); params.push(filters.dateTo); }
    if (filters?.pilotId) { conditions.push('f.pilot_id = ?'); params.push(filters.pilotId); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const { count: total } = getDb().prepare(`
      SELECT COUNT(*) as count FROM finances f
      LEFT JOIN logbook l ON l.id = f.pirep_id
      ${where}
    `).get(...params) as { count: number };

    const offset = (page - 1) * pageSize;
    const rows = getDb().prepare(`
      SELECT
        f.id AS finance_id,
        l.id AS pirep_id,
        l.flight_number,
        l.dep_icao,
        l.arr_icao,
        l.aircraft_type,
        l.cargo_lbs,
        f.amount AS revenue,
        u.callsign AS pilot_callsign,
        u.first_name || ' ' || u.last_name AS pilot_name,
        l.created_at AS flight_date
      FROM finances f
      LEFT JOIN logbook l ON l.id = f.pirep_id
      LEFT JOIN users u ON u.id = f.pilot_id
      ${where}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset) as RevenueByFlightRow[];

    return {
      entries: rows.map(r => ({
        financeId: r.finance_id,
        pirepId: r.pirep_id,
        flightNumber: r.flight_number,
        depIcao: r.dep_icao,
        arrIcao: r.arr_icao,
        aircraftType: r.aircraft_type,
        cargoLbs: r.cargo_lbs,
        revenue: r.revenue,
        pilotCallsign: r.pilot_callsign,
        pilotName: r.pilot_name,
        flightDate: r.flight_date,
      })),
      total,
    };
  }

  getPilotPaySummary(dateFrom?: string, dateTo?: string): Array<{
    pilotId: number; callsign: string; pilotName: string;
    hours: number; flights: number; basePay: number; bonuses: number; deductions: number; netPay: number;
  }> {
    const conditions: string[] = ["l.status = 'approved'"];
    const params: unknown[] = [];
    if (dateFrom) { conditions.push('l.created_at >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('l.created_at <= ?'); params.push(dateTo); }
    const where = conditions.join(' AND ');

    const rows = getDb().prepare(`
      SELECT
        u.id AS pilot_id,
        u.callsign,
        u.first_name || ' ' || u.last_name AS pilot_name,
        COALESCE(SUM(l.flight_time_min), 0) / 60.0 AS hours,
        COUNT(DISTINCT l.id) AS flights,
        COALESCE(SUM(CASE WHEN f.type = 'pay' THEN f.amount ELSE 0 END), 0) AS base_pay,
        COALESCE(SUM(CASE WHEN f.type = 'bonus' THEN f.amount ELSE 0 END), 0) AS bonuses,
        COALESCE(SUM(CASE WHEN f.type = 'deduction' THEN f.amount ELSE 0 END), 0) AS deductions
      FROM logbook l
      JOIN users u ON u.id = l.user_id
      LEFT JOIN finances f ON f.pirep_id = l.id AND f.type IN ('pay', 'bonus', 'deduction')
      WHERE ${where}
      GROUP BY u.id
      ORDER BY base_pay DESC
    `).all(...params) as PilotPaySummaryRow[];

    return rows.map(r => ({
      pilotId: r.pilot_id,
      callsign: r.callsign,
      pilotName: r.pilot_name,
      hours: Math.round(r.hours * 10) / 10,
      flights: r.flights,
      basePay: Math.round(r.base_pay * 100) / 100,
      bonuses: Math.round(r.bonuses * 100) / 100,
      deductions: Math.round(r.deductions * 100) / 100,
      netPay: Math.round((r.base_pay + r.bonuses - r.deductions) * 100) / 100,
    }));
  }

  voidEntry(id: number, actorId: number): number | null {
    const db = getDb();
    const original = db.prepare('SELECT * FROM finances WHERE id = ?').get(id) as { pilot_id: number; type: string; amount: number; description: string | null; pirep_id: number | null; category: string | null } | undefined;
    if (!original) return null;

    // Create offsetting reversal entry
    const reversalAmount = original.amount;
    const result = db.prepare(`
      INSERT INTO finances (pilot_id, pirep_id, type, amount, description, created_by, category, voided_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
    `).run(
      original.pilot_id,
      original.pirep_id ?? null,
      original.type === 'income' ? 'expense' : original.type === 'pay' ? 'deduction' : original.type,
      reversalAmount,
      `VOID: ${original.description ?? 'Entry #' + id}`,
      actorId,
      'adjustment',
    );

    // Mark original as voided
    db.prepare('UPDATE finances SET voided_by = ? WHERE id = ?').run(result.lastInsertRowid, id);

    return result.lastInsertRowid as number;
  }

  delete(id: number): boolean {
    const result = getDb().prepare('DELETE FROM finances WHERE id = ?').run(id);
    return result.changes > 0;
  }

  private toEntry(row: FinanceRow): FinanceEntry {
    return {
      id: row.id,
      pilotId: row.pilot_id,
      pilotCallsign: row.pilot_callsign,
      pilotName: row.pilot_name,
      pirepId: row.pirep_id,
      type: row.type as FinanceType,
      amount: row.amount,
      description: row.description,
      createdBy: row.created_by,
      creatorCallsign: row.creator_callsign,
      createdAt: row.created_at,
    };
  }
}
