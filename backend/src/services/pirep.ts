import { getDb } from '../db/index.js';
import { SettingsService } from './settings.js';
import { FinanceService } from './finance.js';
import { NotificationService } from './notification.js';
import { AuditService } from './audit.js';
import type { FlightEvents } from './flight-event-tracker.js';
import type { LogbookEntry } from '@acars/shared';
import { LogbookService } from './logbook.js';
import { ExceedanceService } from './exceedance.js';

// ── Score calculation ────────────────────────────────────────────

export function calculateScore(landingRateFpm: number | null): number | null {
  if (landingRateFpm == null) return null;
  const abs = Math.abs(landingRateFpm);
  if (abs <= 100) return 100;
  if (abs <= 150) return 90;
  if (abs <= 200) return 80;
  if (abs <= 250) return 65;
  if (abs <= 400) return 45;
  return 20;
}

// ── Types ────────────────────────────────────────────────────────

interface ActiveBidRow {
  id: number;
  user_id: number;
  schedule_id: number;
  flight_plan_data: string | null;
  flight_plan_phase: string;
  simbrief_ofp_json: string | null;
  vatsim_connected: number;
  vatsim_callsign: string | null;
  vatsim_cid: number | null;
}

interface ScheduleRow {
  flight_number: string;
  dep_icao: string;
  arr_icao: string;
  aircraft_type: string;
  distance_nm: number;
  dep_time: string;
  arr_time: string;
}

export interface PirepResult {
  logbookId: number;
  entry: LogbookEntry;
}

// ── Service ──────────────────────────────────────────────────────

const settingsService = new SettingsService();
const financeService = new FinanceService();
const notificationService = new NotificationService();
const auditService = new AuditService();
const logbookService = new LogbookService();
const exceedanceService = new ExceedanceService();

export class PirepService {
  /**
   * Submit a PIREP (pilot report) at end of flight.
   * Creates a logbook entry, marks the bid as completed, and optionally auto-approves.
   */
  submit(
    bidId: number,
    userId: number,
    currentFuelLbs: number,
    flightEvents: FlightEvents,
    remarks?: string,
  ): PirepResult {
    const db = getDb();

    // 1. Validate bid exists, belongs to user, is active
    const bid = db.prepare(
      'SELECT * FROM active_bids WHERE id = ?',
    ).get(bidId) as ActiveBidRow | undefined;

    if (!bid) throw new Error('Bid not found');
    if (bid.user_id !== userId) throw new Error('Not your bid');
    if (bid.flight_plan_phase !== 'active') {
      throw new Error(`Flight is not active (phase: ${bid.flight_plan_phase})`);
    }

    // 2. Get schedule data
    const schedule = db.prepare(
      'SELECT flight_number, dep_icao, arr_icao, aircraft_type, distance_nm, dep_time, arr_time FROM scheduled_flights WHERE id = ?',
    ).get(bid.schedule_id) as ScheduleRow | undefined;

    if (!schedule) throw new Error('Schedule not found for bid');

    // 3. Parse stored JSON
    let flightPlanData: Record<string, any> = {};
    let ofpData: Record<string, any> = {};
    try { flightPlanData = bid.flight_plan_data ? JSON.parse(bid.flight_plan_data) : {}; } catch { /* skip */ }
    try { ofpData = bid.simbrief_ofp_json ? JSON.parse(bid.simbrief_ofp_json) : {}; } catch { /* skip */ }

    // 4. Calculate flight time from OOOI (OFF → ON)
    const now = new Date();
    const oooiOff = flightEvents.oooiOff ? new Date(flightEvents.oooiOff) : null;
    const oooiOn = flightEvents.oooiOn ? new Date(flightEvents.oooiOn) : null;
    const takeoffTime = flightEvents.takeoffTime ? new Date(flightEvents.takeoffTime) : null;

    // Flight time: prefer OFF→ON, fall back to takeoff→now
    const flightTimeMin = (oooiOff && oooiOn)
      ? Math.round((oooiOn.getTime() - oooiOff.getTime()) / 60000)
      : takeoffTime
        ? Math.round((now.getTime() - takeoffTime.getTime()) / 60000)
        : 0;

    // actual_dep = OFF time (wheels up), actual_arr = ON time (touchdown)
    const actualDep = flightEvents.oooiOff ?? flightEvents.takeoffTime ?? now.toISOString();
    const actualArr = flightEvents.oooiOn ?? now.toISOString();

    // IN time fallback: use submission time if pilot submits before parking
    const oooiIn = flightEvents.oooiIn ?? now.toISOString();

    // 5. Calculate fuel used
    const takeoffFuel = flightEvents.takeoffFuelLbs ?? 0;
    const fuelUsedLbs = takeoffFuel > 0
      ? Math.round(takeoffFuel - currentFuelLbs)
      : null;

    // 6. Score from landing rate
    const score = calculateScore(flightEvents.landingRateFpm);

    // 7. Gather fields from flight plan and OFP
    const route = ofpData.route || flightPlanData.route || null;
    const cruiseAltitude = ofpData.cruiseAltitude
      ? `FL${ofpData.cruiseAltitude}`
      : flightPlanData.cruiseFL || null;
    const paxCount = parseInt(flightPlanData.paxCount, 10) || 0;
    const cargoLbs = parseInt(flightPlanData.cargoLbs, 10) || 0;
    const fuelPlannedLbs = parseInt(flightPlanData.fuelBurn || flightPlanData.fuelPlanned, 10) || null;
    const aircraftReg = flightPlanData.aircraftRegistration || null;

    // 8. Check auto-approve setting
    const autoApprove = settingsService.get('pirep.auto_approve') === 'true';
    const status = autoApprove ? 'approved' : 'pending';

    // 9. Transaction: INSERT logbook + UPDATE bid
    const txn = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO logbook (
          user_id, flight_number, dep_icao, arr_icao,
          aircraft_type, aircraft_registration,
          scheduled_dep, scheduled_arr,
          actual_dep, actual_arr,
          flight_time_min, distance_nm,
          fuel_used_lbs, fuel_planned_lbs,
          route, cruise_altitude,
          pax_count, cargo_lbs,
          landing_rate_fpm, score,
          status, remarks,
          vatsim_connected, vatsim_callsign, vatsim_cid,
          oooi_out, oooi_off, oooi_on, oooi_in
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?,
          ?, ?,
          ?, ?,
          ?, ?,
          ?, ?,
          ?, ?,
          ?, ?,
          ?, ?,
          ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?
        )
      `).run(
        userId,
        schedule.flight_number,
        schedule.dep_icao,
        schedule.arr_icao,
        schedule.aircraft_type,
        aircraftReg,
        schedule.dep_time,
        schedule.arr_time,
        actualDep,
        actualArr,
        flightTimeMin,
        schedule.distance_nm,
        fuelUsedLbs,
        fuelPlannedLbs,
        route,
        cruiseAltitude,
        paxCount,
        cargoLbs,
        flightEvents.landingRateFpm,
        score,
        status,
        remarks ?? null,
        bid.vatsim_connected,
        bid.vatsim_callsign,
        bid.vatsim_cid,
        flightEvents.oooiOut,
        flightEvents.oooiOff,
        flightEvents.oooiOn,
        oooiIn,
      );

      const logbookId = result.lastInsertRowid as number;

      // Mark bid as completed
      db.prepare(
        "UPDATE active_bids SET flight_plan_phase = 'completed' WHERE id = ?",
      ).run(bidId);

      // Link exceedances to the logbook entry
      exceedanceService.linkToLogbook(bidId, logbookId);

      // Auto-approve: create finance entry
      if (autoApprove && flightTimeMin > 0) {
        const payRate = parseFloat(settingsService.get('finance.pay_per_hour') ?? '50');
        const hours = flightTimeMin / 60;
        const amount = Math.round(hours * payRate * 100) / 100;

        financeService.create({
          pilotId: userId,
          type: 'pay',
          amount,
          description: `Flight pay: ${schedule.flight_number} (${schedule.dep_icao}-${schedule.arr_icao})`,
          pirepId: logbookId,
        }, userId);

        notificationService.send({
          userId,
          message: `PIREP auto-approved for ${schedule.flight_number}. $${amount.toFixed(2)} credited.`,
          type: 'success',
          link: `/logbook/${logbookId}`,
        });
      } else {
        notificationService.send({
          userId,
          message: `PIREP filed for ${schedule.flight_number}. Awaiting review.`,
          type: 'info',
          link: `/logbook/${logbookId}`,
        });
      }

      auditService.log({
        actorId: userId,
        action: 'pirep.filed',
        targetType: 'pirep',
        targetId: logbookId,
        after: {
          flightNumber: schedule.flight_number,
          landingRate: flightEvents.landingRateFpm,
          score,
          status,
        } as Record<string, unknown>,
      });

      return logbookId;
    });

    const logbookId = txn();

    // Fetch the complete entry with joins for the response
    const entry = logbookService.findById(logbookId);
    if (!entry) throw new Error('Failed to read created logbook entry');

    return { logbookId, entry };
  }
}
