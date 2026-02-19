import { getDb } from '../db/index.js';
import type { DispatchFlight, FlightPlanPhase } from '@acars/shared';

interface DispatchBidRow {
  id: number;
  user_id: number;
  schedule_id: number;
  created_at: string;
  flight_number: string;
  dep_icao: string;
  arr_icao: string;
  dep_name: string;
  arr_name: string;
  aircraft_type: string;
  dep_time: string;
  arr_time: string;
  distance_nm: number;
  flight_time_min: number;
  days_of_week: string;
  simbrief_ofp_json: string | null;
  flight_plan_data: string | null;
  flight_plan_phase: string;
  pilot_callsign: string;
  pilot_first_name: string;
  pilot_last_name: string;
}

export class DispatchService {
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
        dep.name AS dep_name,
        arr.name AS arr_name,
        ab.simbrief_ofp_json,
        ab.flight_plan_data,
        ab.flight_plan_phase,
        u.callsign AS pilot_callsign,
        u.first_name AS pilot_first_name,
        u.last_name AS pilot_last_name
      FROM active_bids ab
      JOIN scheduled_flights sf ON sf.id = ab.schedule_id
      JOIN airports dep ON dep.icao = sf.dep_icao
      JOIN airports arr ON arr.icao = sf.arr_icao
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
      },
      flightPlanData,
      ofpJson,
      phase,
      pilot: {
        callsign: row.pilot_callsign,
        name: `${row.pilot_first_name} ${row.pilot_last_name}`,
      },
    };
  }
}
