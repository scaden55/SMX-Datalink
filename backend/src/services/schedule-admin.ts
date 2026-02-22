import { getDb } from '../db/index.js';
import { AuditService } from './audit.js';
import type { CreateScheduleRequest, UpdateScheduleRequest } from '@acars/shared';

// ── Airport lookup types ─────────────────────────────────────────

interface OaAirportRow {
  id: number;
  ident: string;
  name: string;
  latitude_deg: number | null;
  longitude_deg: number | null;
  elevation_ft: number | null;
  iso_country: string | null;
  municipality: string | null;
}

interface LegacyAirportRow {
  icao: string;
  name: string;
  lat: number;
  lon: number;
  elevation: number;
  city: string;
  country: string;
}

interface AirportInfo {
  icao: string;
  name: string;
  municipality: string | null;
  country: string | null;
  lat: number;
  lon: number;
  elevation: number | null;
}

export interface AutofillResult {
  depAirport?: AirportInfo;
  arrAirport?: AirportInfo;
  distanceNm?: number;
  flightTimeMin?: number;
  arrTime?: string;
  cruiseSpeed?: number;
}

// ── Haversine (nautical miles) ───────────────────────────────────

function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

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
        COALESCE(dep.name, oa_dep.name) AS dep_name,
        COALESCE(arr.name, oa_arr.name) AS arr_name,
        (SELECT COUNT(*) FROM active_bids ab WHERE ab.schedule_id = sf.id) AS bid_count
      FROM scheduled_flights sf
      LEFT JOIN airports dep ON dep.icao = sf.dep_icao
      LEFT JOIN airports arr ON arr.icao = sf.arr_icao
      LEFT JOIN oa_airports oa_dep ON oa_dep.ident = sf.dep_icao
      LEFT JOIN oa_airports oa_arr ON oa_arr.ident = sf.arr_icao
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
        COALESCE(dep.name, oa_dep.name) AS dep_name,
        COALESCE(arr.name, oa_arr.name) AS arr_name,
        (SELECT COUNT(*) FROM active_bids ab WHERE ab.schedule_id = sf.id) AS bid_count
      FROM scheduled_flights sf
      LEFT JOIN airports dep ON dep.icao = sf.dep_icao
      LEFT JOIN airports arr ON arr.icao = sf.arr_icao
      LEFT JOIN oa_airports oa_dep ON oa_dep.ident = sf.dep_icao
      LEFT JOIN oa_airports oa_arr ON oa_arr.ident = sf.arr_icao
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

  // ── Autofill: progressive airport/distance/time lookup ───────

  autofill(params: { depIcao?: string; arrIcao?: string; aircraftType?: string; depTime?: string }): AutofillResult {
    const db = getDb();
    const result: AutofillResult = {};

    const lookupAirport = (icao: string): AirportInfo | undefined => {
      // Try oa_airports first (47k global), then legacy airports table (26 US hubs)
      const oa = db.prepare(
        'SELECT ident, name, latitude_deg, longitude_deg, elevation_ft, iso_country, municipality FROM oa_airports WHERE ident = ?'
      ).get(icao) as OaAirportRow | undefined;

      if (oa && oa.latitude_deg != null && oa.longitude_deg != null) {
        return {
          icao: oa.ident,
          name: oa.name,
          municipality: oa.municipality,
          country: oa.iso_country,
          lat: oa.latitude_deg,
          lon: oa.longitude_deg,
          elevation: oa.elevation_ft,
        };
      }

      const legacy = db.prepare(
        'SELECT icao, name, lat, lon, elevation, city, country FROM airports WHERE icao = ?'
      ).get(icao) as LegacyAirportRow | undefined;

      if (legacy) {
        return {
          icao: legacy.icao,
          name: legacy.name,
          municipality: legacy.city,
          country: legacy.country,
          lat: legacy.lat,
          lon: legacy.lon,
          elevation: legacy.elevation,
        };
      }

      return undefined;
    };

    // Lookup departure airport
    if (params.depIcao && params.depIcao.length >= 3) {
      result.depAirport = lookupAirport(params.depIcao);
    }

    // Lookup arrival airport
    if (params.arrIcao && params.arrIcao.length >= 3) {
      result.arrAirport = lookupAirport(params.arrIcao);
    }

    // Calculate distance if both airports have coordinates
    if (result.depAirport && result.arrAirport) {
      result.distanceNm = haversineNm(
        result.depAirport.lat, result.depAirport.lon,
        result.arrAirport.lat, result.arrAirport.lon,
      );

      // Get cruise speed from fleet for flight time estimation
      if (params.aircraftType) {
        const fleetRow = db.prepare(
          'SELECT cruise_speed FROM fleet WHERE icao_type = ? AND is_active = 1 LIMIT 1'
        ).get(params.aircraftType) as { cruise_speed: number } | undefined;

        if (fleetRow && fleetRow.cruise_speed > 0) {
          result.cruiseSpeed = fleetRow.cruise_speed;
          result.flightTimeMin = Math.round((result.distanceNm / fleetRow.cruise_speed) * 60);

          // Calculate arrival time if departure time provided
          if (params.depTime && /^\d{2}:\d{2}$/.test(params.depTime)) {
            const [depH, depM] = params.depTime.split(':').map(Number);
            const arrTotalMin = depH * 60 + depM + result.flightTimeMin;
            const arrH = Math.floor(arrTotalMin / 60) % 24;
            const arrM = arrTotalMin % 60;
            result.arrTime = `${String(arrH).padStart(2, '0')}:${String(arrM).padStart(2, '0')}`;
          }
        }
      }
    }

    return result;
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
