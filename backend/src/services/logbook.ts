import { getDb } from '../db/index.js';
import type { LogbookEntry, LogbookStatus, LogbookFilters } from '@acars/shared';

// ── Raw DB row type ─────────────────────────────────────────────

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
  // Reviewer fields
  reviewer_id: number | null;
  reviewed_at: string | null;
  review_notes: string | null;
  // VATSIM tracking
  vatsim_connected: number;
  vatsim_callsign: string | null;
  vatsim_cid: number | null;
  // Joined fields
  pilot_callsign?: string;
  pilot_name?: string;
  dep_name?: string;
  arr_name?: string;
  reviewer_callsign?: string;
  reviewer_name?: string;
}

// ── Service ─────────────────────────────────────────────────────

export class LogbookService {

  findAll(filters?: LogbookFilters, page = 1, pageSize = 50): { entries: LogbookEntry[]; total: number } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.userId) {
      conditions.push('l.user_id = ?');
      params.push(filters.userId);
    }
    if (filters?.depIcao) {
      conditions.push('l.dep_icao = ?');
      params.push(filters.depIcao);
    }
    if (filters?.arrIcao) {
      conditions.push('l.arr_icao = ?');
      params.push(filters.arrIcao);
    }
    if (filters?.aircraftType) {
      conditions.push('l.aircraft_type = ?');
      params.push(filters.aircraftType);
    }
    if (filters?.status) {
      conditions.push('l.status = ?');
      params.push(filters.status);
    }
    if (filters?.search) {
      conditions.push('(l.flight_number LIKE ? OR l.dep_icao LIKE ? OR l.arr_icao LIKE ? OR l.aircraft_registration LIKE ?)');
      const term = `%${filters.search}%`;
      params.push(term, term, term, term);
    }
    if (filters?.dateFrom) {
      conditions.push('l.actual_dep >= ?');
      params.push(filters.dateFrom);
    }
    if (filters?.dateTo) {
      conditions.push('l.actual_dep <= ?');
      params.push(filters.dateTo);
    }
    if (filters?.vatsimOnly) {
      conditions.push('l.vatsim_connected = 1');
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countSql = `SELECT COUNT(*) as count FROM logbook l ${where}`;
    const { count: total } = getDb().prepare(countSql).get(...params) as { count: number };

    // Paginated query with joins
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
    return { entries: rows.map(this.toLogbookEntry), total };
  }

  findById(id: number): LogbookEntry | undefined {
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
      WHERE l.id = ?
    `;
    const row = getDb().prepare(sql).get(id) as LogbookRow | undefined;
    return row ? this.toLogbookEntry(row) : undefined;
  }

  // ── Mapper ──────────────────────────────────────────────────

  private toLogbookEntry(row: LogbookRow): LogbookEntry {
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
      status: (row.status ?? 'approved') as LogbookStatus,
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
