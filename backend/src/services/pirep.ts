import { getDb } from '../db/index.js';
import { logger } from '../lib/logger.js';
import { SettingsService } from './settings.js';
import { FinanceService } from './finance.js';
import { NotificationService } from './notification.js';
import { AuditService } from './audit.js';
import type { FlightEvents } from './flight-event-tracker.js';
import type { LogbookEntry } from '@acars/shared';
import { LogbookService } from './logbook.js';
import { ExceedanceService } from './exceedance.js';
import { RevenueModelService } from './revenue-model.js';
import { MaintenanceService } from './maintenance.js';

// ── Score calculation (G-force based) ────────────────────────────

export function calculateScore(landingGForce: number | null): number | null {
  if (landingGForce == null) return null;
  const g = Math.abs(landingGForce);
  if (g <= 1.2) return 100;   // Butter — feather-light touchdown
  if (g <= 1.5) return 100;   // Normal — full marks
  if (g <= 1.8) return 85;    // Firm
  if (g <= 2.1) return 60;    // Hard
  if (g <= 2.5) return 35;    // Very hard — inspection territory
  return 10;                  // Crash
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
const revenueModelService = new RevenueModelService();
const maintenanceService = new MaintenanceService();

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
    if (bid.flight_plan_phase === 'completed') {
      throw new Error('Flight has already been completed');
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

    // 6. Score from landing G-force (primary metric)
    const score = calculateScore(flightEvents.landingGForce);

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
          landing_rate_fpm, landing_g_force, score,
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
          ?, ?, ?,
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
        flightEvents.landingGForce,
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

      // Delete the bid — flight is complete, logbook entry carries all data
      db.prepare('DELETE FROM active_bids WHERE id = ?').run(bidId);

      // Link exceedances to the logbook entry
      exceedanceService.linkToLogbook(bidId, logbookId);

      // Auto-approve: create finance entries via revenue model
      if (autoApprove && flightTimeMin > 0) {
        const breakdown = revenueModelService.calculate({
          cargoLbs: cargoLbs,
          distanceNm: schedule.distance_nm,
          aircraftRegistration: aircraftReg,
          aircraftType: schedule.aircraft_type,
          blockHours: flightTimeMin / 60,
        });

        // Pilot pay
        financeService.create({
          pilotId: userId,
          type: 'pay',
          amount: breakdown.pilotPay,
          description: `Flight pay: ${schedule.flight_number} (${schedule.dep_icao}-${schedule.arr_icao})`,
          pirepId: logbookId,
        }, userId);

        // Cargo revenue
        if (breakdown.revenue.total > 0) {
          financeService.create({
            pilotId: userId,
            type: 'income',
            amount: breakdown.revenue.total,
            description: `Cargo revenue: ${schedule.flight_number} (${breakdown.cargoLbs.toLocaleString()} lbs, Class ${breakdown.aircraftClass})`,
            pirepId: logbookId,
          }, userId);
        }

        // Accumulate aircraft flight hours/cycles for maintenance tracking (auto-approve path)
        let effectiveReg = aircraftReg;
        if (!effectiveReg) {
          // Fallback: look up registration from the schedule's aircraft type via fleet
          const fleetLookup = db.prepare(
            'SELECT registration FROM fleet WHERE icao_type = ? AND status = ? LIMIT 1'
          ).get(schedule.aircraft_type, 'active') as { registration: string } | undefined;
          if (fleetLookup) {
            effectiveReg = fleetLookup.registration;
            logger.warn('PIREP', `aircraftRegistration missing from flight plan, fell back to fleet lookup: ${effectiveReg}`);
          }
        }
        if (effectiveReg) {
          maintenanceService.accumulateFlightHours(effectiveReg, flightTimeMin);
        } else {
          logger.warn('PIREP', `Cannot accumulate flight hours for ${schedule.flight_number}: no aircraftRegistration available`);
        }

        // Back-fill discrepancies with logbook entry ID
        if (aircraftReg && schedule.flight_number) {
          const fleetRow = db.prepare('SELECT id FROM fleet WHERE registration = ?').get(aircraftReg) as { id: number } | undefined;
          if (fleetRow) {
            db.prepare(`
              UPDATE discrepancies SET logbook_entry_id = ?
              WHERE aircraft_id = ? AND flight_number = ? AND logbook_entry_id IS NULL
            `).run(logbookId, fleetRow.id, schedule.flight_number);
          }
        }

        notificationService.send({
          userId,
          message: `PIREP auto-approved for ${schedule.flight_number}. Pay: $${breakdown.pilotPay.toFixed(2)}, Cargo Revenue: $${breakdown.revenue.total.toFixed(2)}`,
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
          landingGForce: flightEvents.landingGForce,
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
