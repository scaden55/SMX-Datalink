import { getDb } from '../db/index.js';
import type { FinanceEntry, FinanceType, FinanceFilters, PilotBalance, FinanceSummary } from '@acars/shared';
import type { FinanceBalanceQueryRow, FinanceSummaryQueryRow } from '../types/db-rows.js';

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
