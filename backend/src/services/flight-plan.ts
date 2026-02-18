import { getDb } from '../db/index.js';
import type { FlightPlanPhase } from '@acars/shared';

interface FlightPlanRow {
  simbrief_ofp_json: string | null;
  flight_plan_data: string | null;
  flight_plan_phase: string;
}

export class FlightPlanService {
  getFlightPlan(bidId: number, userId: number): FlightPlanRow | null {
    const row = getDb().prepare(
      'SELECT simbrief_ofp_json, flight_plan_data, flight_plan_phase FROM active_bids WHERE id = ? AND user_id = ?'
    ).get(bidId, userId) as FlightPlanRow | undefined;

    return row ?? null;
  }

  saveFlightPlan(
    bidId: number,
    userId: number,
    data: { ofpJson?: string | null; flightPlanData?: string | null; phase?: FlightPlanPhase }
  ): boolean {
    const sets: string[] = [];
    const params: unknown[] = [];

    if (data.ofpJson !== undefined) {
      sets.push('simbrief_ofp_json = ?');
      params.push(data.ofpJson);
    }
    if (data.flightPlanData !== undefined) {
      sets.push('flight_plan_data = ?');
      params.push(data.flightPlanData);
    }
    if (data.phase !== undefined) {
      sets.push('flight_plan_phase = ?');
      params.push(data.phase);
    }

    if (sets.length === 0) return false;

    params.push(bidId, userId);
    const result = getDb().prepare(
      `UPDATE active_bids SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`
    ).run(...params);

    return result.changes > 0;
  }
}
