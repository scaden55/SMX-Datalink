import { getDb } from '../db/index.js';
import type { FlightPlanPhase, DispatchEditPayload } from '@acars/shared';

interface FlightPlanRow {
  simbrief_ofp_json: string | null;
  flight_plan_data: string | null;
  flight_plan_phase: string;
}

const FUEL_FIELDS = new Set([
  'fuelPlanned', 'fuelExtra', 'fuelAlternate', 'fuelReserve',
  'fuelTaxi', 'fuelContingency', 'fuelTotal', 'fuelBurn',
]);

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

  /**
   * Patch flight plan data (admin dispatch edits).
   * Merges partial fields into existing flight_plan_data JSON.
   * Enforces phase restrictions:
   *   - planning: all fields allowed
   *   - active: route/alternates/MEL/remarks only (no fuel)
   *   - completed: no edits allowed
   */
  patchFlightPlanData(bidId: number, fields: DispatchEditPayload): { ok: boolean; error?: string } {
    const row = getDb().prepare(
      'SELECT flight_plan_data, flight_plan_phase FROM active_bids WHERE id = ?'
    ).get(bidId) as FlightPlanRow | undefined;

    if (!row) return { ok: false, error: 'Flight not found' };

    const phase = row.flight_plan_phase as FlightPlanPhase;

    if (phase === 'completed') {
      return { ok: false, error: 'Cannot edit a completed flight' };
    }

    // In active phase, reject fuel field edits
    if (phase === 'active') {
      const hasFuelEdit = Object.keys(fields).some((k) => FUEL_FIELDS.has(k));
      if (hasFuelEdit) {
        return { ok: false, error: 'Fuel fields cannot be edited after takeoff' };
      }
    }

    let existing: Record<string, unknown> = {};
    try { existing = row.flight_plan_data ? JSON.parse(row.flight_plan_data) : {}; } catch { /* corrupt stored JSON — start fresh */ }
    const merged = { ...existing, ...fields };

    const result = getDb().prepare(
      'UPDATE active_bids SET flight_plan_data = ? WHERE id = ?'
    ).run(JSON.stringify(merged), bidId);

    return { ok: result.changes > 0 };
  }
}
