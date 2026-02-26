import { getDb } from '../db/index.js';
import { AuditService } from './audit.js';
import { NotificationService } from './notification.js';
import { FinanceService } from './finance.js';
import { SettingsService } from './settings.js';
import { MaintenanceService } from './maintenance.js';
import type { LogbookEntry, LogbookStatus, LogbookFilters } from '@acars/shared';

interface LogbookRow {
  id: number;
  user_id: number;
  flight_number: string;
  dep_icao: string;
  arr_icao: string;
  aircraft_type: string;
  aircraft_registration: string | null;
  scheduled_dep: string | null;
  scheduled_arr: string | null;
  actual_dep: string;
  actual_arr: string;
  flight_time_min: number;
  distance_nm: number;
  fuel_used_lbs: number | null;
  fuel_planned_lbs: number | null;
  route: string | null;
  cruise_altitude: string | null;
  pax_count: number;
  cargo_lbs: number;
  landing_rate_fpm: number | null;
  score: number | null;
  status: string;
  remarks: string | null;
  created_at: string;
  reviewer_id: number | null;
  reviewed_at: string | null;
  review_notes: string | null;
  vatsim_connected: number;
  vatsim_callsign: string | null;
  vatsim_cid: number | null;
  pilot_callsign?: string;
  pilot_name?: string;
  dep_name?: string;
  arr_name?: string;
  reviewer_callsign?: string;
  reviewer_name?: string;
}

const auditService = new AuditService();
const notificationService = new NotificationService();
const financeService = new FinanceService();
const settingsService = new SettingsService();
const maintenanceService = new MaintenanceService();

export class PirepAdminService {

  findAll(filters?: LogbookFilters & { statusIn?: string[] }, page = 1, pageSize = 50): { entries: LogbookEntry[]; total: number } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.userId) { conditions.push('l.user_id = ?'); params.push(filters.userId); }
    if (filters?.depIcao) { conditions.push('l.dep_icao = ?'); params.push(filters.depIcao); }
    if (filters?.arrIcao) { conditions.push('l.arr_icao = ?'); params.push(filters.arrIcao); }
    if (filters?.aircraftType) { conditions.push('l.aircraft_type = ?'); params.push(filters.aircraftType); }
    if (filters?.statusIn?.length) {
      conditions.push(`l.status IN (${filters.statusIn.map(() => '?').join(', ')})`);
      params.push(...filters.statusIn);
    } else if (filters?.status) {
      conditions.push('l.status = ?');
      params.push(filters.status);
    }
    if (filters?.search) {
      conditions.push('(l.flight_number LIKE ? OR l.dep_icao LIKE ? OR l.arr_icao LIKE ? OR u.callsign LIKE ?)');
      const term = `%${filters.search}%`;
      params.push(term, term, term, term);
    }
    if (filters?.dateFrom) { conditions.push('l.actual_dep >= ?'); params.push(filters.dateFrom); }
    if (filters?.dateTo) { conditions.push('l.actual_dep <= ?'); params.push(filters.dateTo); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { count: total } = getDb().prepare(`SELECT COUNT(*) as count FROM logbook l LEFT JOIN users u ON u.id = l.user_id ${where}`).get(...params) as { count: number };

    const offset = (page - 1) * pageSize;
    const sql = `
      SELECT l.*,
        u.callsign AS pilot_callsign,
        u.first_name || ' ' || u.last_name AS pilot_name,
        COALESCE(d.name, oa_d.name) AS dep_name,
        COALESCE(a.name, oa_a.name) AS arr_name,
        r.callsign AS reviewer_callsign,
        r.first_name || ' ' || r.last_name AS reviewer_name
      FROM logbook l
      LEFT JOIN users u ON u.id = l.user_id
      LEFT JOIN airports d ON d.icao = l.dep_icao
      LEFT JOIN airports a ON a.icao = l.arr_icao
      LEFT JOIN oa_airports oa_d ON oa_d.ident = l.dep_icao
      LEFT JOIN oa_airports oa_a ON oa_a.ident = l.arr_icao
      LEFT JOIN users r ON r.id = l.reviewer_id
      ${where}
      ORDER BY l.actual_dep DESC
      LIMIT ? OFFSET ?
    `;

    const rows = getDb().prepare(sql).all(...params, pageSize, offset) as LogbookRow[];
    return { entries: rows.map(this.toEntry), total };
  }

  review(pirepId: number, reviewerId: number, status: 'approved' | 'rejected', notes?: string): boolean {
    const pirep = getDb().prepare('SELECT * FROM logbook WHERE id = ?').get(pirepId) as LogbookRow | undefined;
    if (!pirep) return false;

    const db = getDb();
    const txn = db.transaction(() => {
      // Update PIREP status
      db.prepare(`
        UPDATE logbook SET status = ?, reviewer_id = ?, reviewed_at = datetime('now'), review_notes = ?
        WHERE id = ?
      `).run(status, reviewerId, notes ?? null, pirepId);

      // On approve: create finance entry for pilot pay
      if (status === 'approved') {
        const payRate = parseFloat(settingsService.get('finance.pay_per_hour') ?? '50');
        const hours = pirep.flight_time_min / 60;
        const amount = Math.round(hours * payRate * 100) / 100;

        financeService.create({
          pilotId: pirep.user_id,
          type: 'pay',
          amount,
          description: `Flight pay: ${pirep.flight_number} (${pirep.dep_icao}-${pirep.arr_icao})`,
          pirepId,
        }, reviewerId);

        // Accumulate aircraft flight hours/cycles for maintenance tracking
        if (pirep.aircraft_registration) {
          maintenanceService.accumulateFlightHours(pirep.aircraft_registration, pirep.flight_time_min);
        }

        notificationService.send({
          userId: pirep.user_id,
          message: `Your PIREP for ${pirep.flight_number} has been approved. $${amount.toFixed(2)} credited.`,
          type: 'success',
          link: `/logbook/${pirepId}`,
        });
      } else {
        notificationService.send({
          userId: pirep.user_id,
          message: `Your PIREP for ${pirep.flight_number} has been rejected.${notes ? ` Reason: ${notes}` : ''}`,
          type: 'error',
          link: `/logbook/${pirepId}`,
        });
      }

      auditService.log({
        actorId: reviewerId,
        action: `pirep.${status}`,
        targetType: 'pirep',
        targetId: pirepId,
        after: { status, notes } as Record<string, unknown>,
      });
    });

    txn();
    return true;
  }

  bulkReview(ids: number[], reviewerId: number, status: 'approved' | 'rejected', notes?: string): number {
    // Wrap all reviews in a single outer transaction for atomicity and performance
    const db = getDb();
    const txn = db.transaction(() => {
      let count = 0;
      for (const id of ids) {
        if (this.review(id, reviewerId, status, notes)) count++;
      }
      return count;
    });
    return txn();
  }

  getPendingCount(): number {
    const row = getDb().prepare("SELECT COUNT(*) as count FROM logbook WHERE status = 'pending'").get() as { count: number };
    return row.count;
  }

  private toEntry(row: LogbookRow): LogbookEntry {
    return {
      id: row.id,
      userId: row.user_id,
      flightNumber: row.flight_number,
      depIcao: row.dep_icao,
      arrIcao: row.arr_icao,
      aircraftType: row.aircraft_type,
      aircraftRegistration: row.aircraft_registration,
      scheduledDep: row.scheduled_dep,
      scheduledArr: row.scheduled_arr,
      actualDep: row.actual_dep,
      actualArr: row.actual_arr,
      flightTimeMin: row.flight_time_min,
      distanceNm: row.distance_nm,
      fuelUsedLbs: row.fuel_used_lbs,
      fuelPlannedLbs: row.fuel_planned_lbs,
      route: row.route,
      cruiseAltitude: row.cruise_altitude,
      paxCount: row.pax_count,
      cargoLbs: row.cargo_lbs,
      landingRateFpm: row.landing_rate_fpm,
      score: row.score,
      status: row.status as LogbookStatus,
      remarks: row.remarks,
      createdAt: row.created_at,
      reviewerId: row.reviewer_id,
      reviewedAt: row.reviewed_at,
      reviewNotes: row.review_notes,
      reviewerCallsign: row.reviewer_callsign ?? null,
      reviewerName: row.reviewer_name ?? null,
      vatsimConnected: row.vatsim_connected === 1,
      vatsimCallsign: row.vatsim_callsign ?? null,
      vatsimCid: row.vatsim_cid ?? null,
      pilotCallsign: row.pilot_callsign,
      pilotName: row.pilot_name,
      depName: row.dep_name,
      arrName: row.arr_name,
    };
  }
}
