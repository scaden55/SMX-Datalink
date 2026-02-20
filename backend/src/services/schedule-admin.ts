import { getDb } from '../db/index.js';
import { AuditService } from './audit.js';
import type { CreateScheduleRequest, UpdateScheduleRequest } from '@acars/shared';

interface ScheduleRow {
  id: number;
  flight_number: string;
  dep_icao: string;
  arr_icao: string;
  aircraft_type: string;
  dep_time: string;
  arr_time: string;
  distance_nm: number;
  flight_time_min: number;
  days_of_week: string;
  is_active: number;
  charter_type: string | null;
  dep_name?: string;
  arr_name?: string;
  bid_count?: number;
}

const auditService = new AuditService();

export class ScheduleAdminService {

  findAll(filters?: { depIcao?: string; arrIcao?: string; aircraftType?: string; search?: string; isActive?: boolean }, page = 1, pageSize = 50): { schedules: any[]; total: number } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.depIcao) { conditions.push('sf.dep_icao = ?'); params.push(filters.depIcao); }
    if (filters?.arrIcao) { conditions.push('sf.arr_icao = ?'); params.push(filters.arrIcao); }
    if (filters?.aircraftType) { conditions.push('sf.aircraft_type = ?'); params.push(filters.aircraftType); }
    if (filters?.isActive !== undefined) { conditions.push('sf.is_active = ?'); params.push(filters.isActive ? 1 : 0); }
    if (filters?.search) {
      conditions.push('(sf.flight_number LIKE ? OR sf.dep_icao LIKE ? OR sf.arr_icao LIKE ?)');
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { count: total } = getDb().prepare(`SELECT COUNT(*) as count FROM scheduled_flights sf ${where}`).get(...params) as { count: number };

    const offset = (page - 1) * pageSize;
    const sql = `
      SELECT sf.*,
        dep.name AS dep_name,
        arr.name AS arr_name,
        (SELECT COUNT(*) FROM active_bids ab WHERE ab.schedule_id = sf.id) AS bid_count
      FROM scheduled_flights sf
      LEFT JOIN airports dep ON dep.icao = sf.dep_icao
      LEFT JOIN airports arr ON arr.icao = sf.arr_icao
      ${where}
      ORDER BY sf.flight_number
      LIMIT ? OFFSET ?
    `;

    const rows = getDb().prepare(sql).all(...params, pageSize, offset) as ScheduleRow[];
    return {
      schedules: rows.map(r => ({
        id: r.id,
        flightNumber: r.flight_number,
        depIcao: r.dep_icao,
        arrIcao: r.arr_icao,
        aircraftType: r.aircraft_type,
        depTime: r.dep_time,
        arrTime: r.arr_time,
        distanceNm: r.distance_nm,
        flightTimeMin: r.flight_time_min,
        daysOfWeek: r.days_of_week,
        isActive: r.is_active === 1,
        charterType: r.charter_type,
        depName: r.dep_name,
        arrName: r.arr_name,
        bidCount: r.bid_count ?? 0,
      })),
      total,
    };
  }

  create(data: CreateScheduleRequest, actorId: number): any {
    const result = getDb().prepare(`
      INSERT INTO scheduled_flights (flight_number, dep_icao, arr_icao, aircraft_type, dep_time, arr_time, distance_nm, flight_time_min, days_of_week, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.flightNumber, data.depIcao, data.arrIcao, data.aircraftType,
      data.depTime, data.arrTime, data.distanceNm, data.flightTimeMin,
      data.daysOfWeek, data.isActive !== false ? 1 : 0,
    );

    const id = result.lastInsertRowid as number;
    auditService.log({ actorId, action: 'schedule.create', targetType: 'schedule', targetId: id, after: data as any });
    return this.findById(id);
  }

  findById(id: number): any | undefined {
    const row = getDb().prepare(`
      SELECT sf.*,
        dep.name AS dep_name,
        arr.name AS arr_name,
        (SELECT COUNT(*) FROM active_bids ab WHERE ab.schedule_id = sf.id) AS bid_count
      FROM scheduled_flights sf
      LEFT JOIN airports dep ON dep.icao = sf.dep_icao
      LEFT JOIN airports arr ON arr.icao = sf.arr_icao
      WHERE sf.id = ?
    `).get(id) as ScheduleRow | undefined;

    if (!row) return undefined;
    return {
      id: row.id,
      flightNumber: row.flight_number,
      depIcao: row.dep_icao,
      arrIcao: row.arr_icao,
      aircraftType: row.aircraft_type,
      depTime: row.dep_time,
      arrTime: row.arr_time,
      distanceNm: row.distance_nm,
      flightTimeMin: row.flight_time_min,
      daysOfWeek: row.days_of_week,
      isActive: row.is_active === 1,
      charterType: row.charter_type,
      depName: row.dep_name,
      arrName: row.arr_name,
      bidCount: row.bid_count ?? 0,
    };
  }

  update(id: number, data: UpdateScheduleRequest, actorId: number): any | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const sets: string[] = [];
    const params: unknown[] = [];

    if (data.flightNumber !== undefined) { sets.push('flight_number = ?'); params.push(data.flightNumber); }
    if (data.depIcao !== undefined) { sets.push('dep_icao = ?'); params.push(data.depIcao); }
    if (data.arrIcao !== undefined) { sets.push('arr_icao = ?'); params.push(data.arrIcao); }
    if (data.aircraftType !== undefined) { sets.push('aircraft_type = ?'); params.push(data.aircraftType); }
    if (data.depTime !== undefined) { sets.push('dep_time = ?'); params.push(data.depTime); }
    if (data.arrTime !== undefined) { sets.push('arr_time = ?'); params.push(data.arrTime); }
    if (data.distanceNm !== undefined) { sets.push('distance_nm = ?'); params.push(data.distanceNm); }
    if (data.flightTimeMin !== undefined) { sets.push('flight_time_min = ?'); params.push(data.flightTimeMin); }
    if (data.daysOfWeek !== undefined) { sets.push('days_of_week = ?'); params.push(data.daysOfWeek); }
    if (data.isActive !== undefined) { sets.push('is_active = ?'); params.push(data.isActive ? 1 : 0); }

    if (sets.length === 0) return existing;

    params.push(id);
    getDb().prepare(`UPDATE scheduled_flights SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    const after = this.findById(id)!;
    auditService.log({ actorId, action: 'schedule.update', targetType: 'schedule', targetId: id, before: existing, after });
    return after;
  }

  delete(id: number, actorId: number): boolean {
    const existing = this.findById(id);
    if (!existing) return false;

    // Delete associated bids first
    getDb().prepare('DELETE FROM active_bids WHERE schedule_id = ?').run(id);
    const result = getDb().prepare('DELETE FROM scheduled_flights WHERE id = ?').run(id);

    auditService.log({ actorId, action: 'schedule.delete', targetType: 'schedule', targetId: id, before: existing });
    return result.changes > 0;
  }

  toggleActive(id: number, actorId: number): any | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const newActive = !existing.isActive;
    getDb().prepare('UPDATE scheduled_flights SET is_active = ? WHERE id = ?').run(newActive ? 1 : 0, id);

    auditService.log({ actorId, action: 'schedule.toggle', targetType: 'schedule', targetId: id });
    return this.findById(id);
  }

  clone(id: number, newFlightNumber: string, actorId: number): any | null {
    const existing = getDb().prepare('SELECT * FROM scheduled_flights WHERE id = ?').get(id) as any;
    if (!existing) return null;

    const result = getDb().prepare(`
      INSERT INTO scheduled_flights (flight_number, dep_icao, arr_icao, aircraft_type, dep_time, arr_time, distance_nm, flight_time_min, days_of_week, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(newFlightNumber, existing.dep_icao, existing.arr_icao, existing.aircraft_type, existing.dep_time, existing.arr_time, existing.distance_nm, existing.flight_time_min, existing.days_of_week);

    const newId = result.lastInsertRowid as number;
    auditService.log({ actorId, action: 'schedule.clone', targetType: 'schedule', targetId: newId });
    return this.findById(newId);
  }
}
