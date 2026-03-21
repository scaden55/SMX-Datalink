import { getDb } from '../db/index.js';
import type { FlightType, DispatchFlight, FlightPlanPhase } from '@acars/shared';

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
  flight_type: string | null;
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
  expires_at: string | null;
  released_fields: string | null;
}

/** Shared SELECT columns + JOINs for dispatch flight queries */
const DISPATCH_FLIGHT_SQL = `
  SELECT
    ab.id, ab.user_id, ab.schedule_id, ab.created_at,
    sf.flight_number, sf.dep_icao, sf.arr_icao, sf.aircraft_type,
    sf.dep_time, sf.arr_time, sf.distance_nm, sf.flight_time_min, sf.days_of_week,
    sf.flight_type, sf.event_tag,
    COALESCE(dep.name, oa_dep.name, sf.dep_icao) AS dep_name,
    COALESCE(arr.name, oa_arr.name, sf.arr_icao) AS arr_name,
    ab.aircraft_id,
    ab.simbrief_ofp_json,
    ab.flight_plan_data,
    ab.flight_plan_phase,
    ab.vatsim_connected,
    ab.vatsim_callsign,
    ab.vatsim_cid,
    ab.expires_at,
    ab.released_fields,
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
`;

export class DispatchService {
  /** Quick lookup for bid ownership checks */
  findBidOwner(bidId: number): { userId: number } | null {
    const row = getDb().prepare('SELECT user_id FROM active_bids WHERE id = ?').get(bidId) as { user_id: number } | undefined;
    return row ? { userId: row.user_id } : null;
  }

  /** Get a single flight by bid ID */
  findFlightById(bidId: number): DispatchFlight | null {
    const sql = `${DISPATCH_FLIGHT_SQL} WHERE ab.id = ?`;
    const row = getDb().prepare(sql).get(bidId) as DispatchBidRow | undefined;
    return row ? this.toDispatchFlight(row) : null;
  }

  findActiveFlights(userId?: number, phase?: string): DispatchFlight[] {
    const conditions = ['ab.flight_plan_data IS NOT NULL'];
    const params: unknown[] = [];

    if (userId !== undefined) {
      conditions.push('ab.user_id = ?');
      params.push(userId);
    }

    if (phase === 'planning') {
      conditions.push("ab.flight_plan_phase = 'planning'");
    } else if (phase === 'active') {
      conditions.push("ab.flight_plan_phase = 'active'");
    }
    // 'all' or undefined → no additional filter

    const sql = `${DISPATCH_FLIGHT_SQL}
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
        expiresAt: row.expires_at ?? null,
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
        flightType: row.flight_type as FlightType | null,
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
      releasedFields: row.released_fields ? JSON.parse(row.released_fields) : null,
    };
  }

  /** Persist the list of changed fields when a dispatcher releases edits */
  setReleasedFields(bidId: number, fields: string[]): void {
    getDb().prepare('UPDATE active_bids SET released_fields = ? WHERE id = ?')
      .run(JSON.stringify(fields), bidId);
  }

  /** Clear released fields after the pilot acknowledges the changes */
  acknowledgeRelease(bidId: number): void {
    getDb().prepare('UPDATE active_bids SET released_fields = NULL WHERE id = ?')
      .run(bidId);
  }
}
