import { getDb } from '../db/index.js';
import type { CharterType, DispatchFlight, FlightPlanPhase } from '@acars/shared';

interface DispatchBidRow {
  id: number;
  user_id: number;
  schedule_id: number;
  aircraft_id: number | null;
  created_at: string;
  flight_number: string;
  dep_icao: string;
  arr_icao: string;
  dep_name: string;
  arr_name: string;
  aircraft_type: string | null;
  dep_time: string;
  arr_time: string;
  distance_nm: number;
  flight_time_min: number;
  days_of_week: string;
  charter_type: string | null;
  event_tag: string | null;
  aircraft_registration: string | null;
  aircraft_name: string | null;
  simbrief_ofp_json: string | null;
  flight_plan_data: string | null;
  flight_plan_phase: string;
  pilot_callsign: string;
  pilot_first_name: string;
  pilot_last_name: string;
  vatsim_connected: number;
  vatsim_callsign: string | null;
  vatsim_cid: number | null;
}

export class DispatchService {
  /** Quick lookup for bid ownership checks */
  findBidOwner(bidId: number): { userId: number } | null {
    const row = getDb().prepare('SELECT user_id FROM active_bids WHERE id = ?').get(bidId) as { user_id: number } | undefined;
    return row ? { userId: row.user_id } : null;
  }

  findActiveFlights(userId?: number): DispatchFlight[] {
    const conditions = ['ab.flight_plan_data IS NOT NULL'];
    const params: unknown[] = [];

    if (userId !== undefined) {
      conditions.push('ab.user_id = ?');
      params.push(userId);
    }

    const sql = `
      SELECT
        ab.id, ab.user_id, ab.schedule_id, ab.created_at,
        sf.flight_number, sf.dep_icao, sf.arr_icao, sf.aircraft_type,
        sf.dep_time, sf.arr_time, sf.distance_nm, sf.flight_time_min, sf.days_of_week,
        sf.charter_type, sf.event_tag,
        COALESCE(dep.name, oa_dep.name, sf.dep_icao) AS dep_name,
        COALESCE(arr.name, oa_arr.name, sf.arr_icao) AS arr_name,
        ab.aircraft_id,
        ab.simbrief_ofp_json,
        ab.flight_plan_data,
        ab.flight_plan_phase,
        ab.vatsim_connected,
        ab.vatsim_callsign,
        ab.vatsim_cid,
        f.registration AS aircraft_registration,
        f.name AS aircraft_name,
        u.callsign AS pilot_callsign,
        u.first_name AS pilot_first_name,
        u.last_name AS pilot_last_name
      FROM active_bids ab
      JOIN scheduled_flights sf ON sf.id = ab.schedule_id
      LEFT JOIN airports dep ON dep.icao = sf.dep_icao
      LEFT JOIN airports arr ON arr.icao = sf.arr_icao
      LEFT JOIN oa_airports oa_dep ON oa_dep.ident = sf.dep_icao
      LEFT JOIN oa_airports oa_arr ON oa_arr.ident = sf.arr_icao
      LEFT JOIN fleet f ON f.id = ab.aircraft_id
      JOIN users u ON u.id = ab.user_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY ab.created_at DESC
    `;

    const rows = getDb().prepare(sql).all(...params) as DispatchBidRow[];
    return rows.map(this.toDispatchFlight);
  }

  private toDispatchFlight(row: DispatchBidRow): DispatchFlight {
    let flightPlanData = null;
    let ofpJson = null;

    try { flightPlanData = row.flight_plan_data ? JSON.parse(row.flight_plan_data) : null; } catch { /* corrupt JSON — skip */ }
    try { ofpJson = row.simbrief_ofp_json ? JSON.parse(row.simbrief_ofp_json) : null; } catch { /* corrupt JSON — skip */ }

    const phase = row.flight_plan_phase as FlightPlanPhase;
    return {
      bid: {
        id: row.id,
        userId: row.user_id,
        scheduleId: row.schedule_id,
        aircraftId: row.aircraft_id ?? null,
        createdAt: row.created_at,
        flightNumber: row.flight_number,
        depIcao: row.dep_icao,
        arrIcao: row.arr_icao,
        depName: row.dep_name,
        arrName: row.arr_name,
        aircraftType: row.aircraft_type,
        depTime: row.dep_time,
        arrTime: row.arr_time,
        distanceNm: row.distance_nm,
        flightTimeMin: row.flight_time_min,
        daysOfWeek: row.days_of_week,
        charterType: row.charter_type as CharterType | null,
        eventTag: row.event_tag ?? null,
        aircraftRegistration: row.aircraft_registration ?? null,
        aircraftName: row.aircraft_name ?? null,
      },
      flightPlanData,
      ofpJson,
      phase,
      pilot: {
        callsign: row.pilot_callsign,
        name: `${row.pilot_first_name} ${row.pilot_last_name}`,
      },
      vatsimConnected: row.vatsim_connected === 1,
      vatsimCallsign: row.vatsim_callsign ?? null,
    };
  }
}
