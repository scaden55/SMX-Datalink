import { getDb } from '../db/index.js';
import { logger } from '../lib/logger.js';
import { AuditService } from './audit.js';
import { FinanceService } from './finance.js';
import type {
  AircraftHours,
  MaintenanceCheckSchedule,
  MaintenanceLogEntry,
  AirworthinessDirective,
  MELDeferral,
  AircraftComponent,
  CheckDueStatus,
  FleetMaintenanceStatus,
  MaintenanceCheckType,
  MaintenanceLogType,
  MaintenanceLogStatus,
  ADComplianceStatus,
  MELCategory,
  MELStatus,
  ComponentType,
  ComponentStatus,
  CreateMaintenanceLogRequest,
  UpdateMaintenanceLogRequest,
  CreateCheckScheduleRequest,
  UpdateCheckScheduleRequest,
  CreateADRequest,
  UpdateADRequest,
  CreateMELRequest,
  UpdateMELRequest,
  CreateComponentRequest,
  UpdateComponentRequest,
  AdjustHoursRequest,
  MaintenanceLogListResponse,
  ADListResponse,
  MELListResponse,
} from '@acars/shared';
import type {
  AircraftHoursRow,
  MaintenanceCheckRow,
  MaintenanceLogRow,
  AirworthinessDirectiveRow,
  MELDeferralRow,
  AircraftComponentRow,
  FleetMaintenanceStatusRow,
  MaintenanceLogJoinRow,
  ADJoinRow,
  MELJoinRow,
  ComponentJoinRow,
} from '../types/db-rows.js';

const TAG = 'Maintenance';
const auditService = new AuditService();

/** Universal default check intervals — used when no type-specific rows exist in maintenance_checks */
const DEFAULT_CHECKS: Omit<MaintenanceCheckRow, 'id' | 'icao_type'>[] = [
  { check_type: 'A', interval_hours: 500,  interval_cycles: null, interval_months: null, overflight_pct: 10, estimated_duration_hours: 8,   description: 'A Check - Routine inspection', default_cost: 40000, reserve_rate_per_hour: 60 },
  { check_type: 'B', interval_hours: 4500, interval_cycles: null, interval_months: null, overflight_pct: 0,  estimated_duration_hours: 48,  description: 'B Check - Intermediate inspection', default_cost: 200000, reserve_rate_per_hour: 15 },
  { check_type: 'C', interval_hours: 6000, interval_cycles: 3000, interval_months: 18,   overflight_pct: 0,  estimated_duration_hours: 336, description: 'C Check - Heavy inspection (2 weeks)', default_cost: 1500000, reserve_rate_per_hour: 20 },
  { check_type: 'D', interval_hours: null, interval_cycles: null, interval_months: 72,   overflight_pct: 0,  estimated_duration_hours: 672, description: 'D Check - Structural overhaul (4 weeks)', default_cost: 8000000, reserve_rate_per_hour: 0 },
];

/** Get maintenance check intervals for an aircraft type, falling back to universal defaults */
function getChecksForType(icaoType: string): MaintenanceCheckRow[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM maintenance_checks WHERE icao_type = ?')
    .all(icaoType) as MaintenanceCheckRow[];
  if (rows.length > 0) return rows;

  // Synthesize default rows for types without specific configuration
  return DEFAULT_CHECKS.map((c, i) => ({
    ...c,
    id: -(i + 1), // negative IDs indicate synthetic defaults
    icao_type: icaoType,
  })) as MaintenanceCheckRow[];
}

export class MaintenanceService {

  // ═══════════════════════════════════════════════════════════
  // Fleet Status
  // ═══════════════════════════════════════════════════════════

  getFleetStatus(): FleetMaintenanceStatus[] {
    const db = getDb();
    const rows = db.prepare(`
      SELECT f.id, f.registration, f.icao_type, f.name, f.status, f.created_at,
             h.total_hours, h.total_cycles,
             h.hours_at_last_a, h.hours_at_last_b,
             h.hours_at_last_c, h.cycles_at_last_c,
             h.last_d_check_date, h.hours_at_last_d,
             h.maintenance_reserve_balance
      FROM fleet f
      LEFT JOIN aircraft_hours h ON h.aircraft_id = f.id
      ORDER BY f.icao_type, f.registration
    `).all() as FleetMaintenanceStatusRow[];

    return rows.map(row => this.buildFleetStatus(row));
  }

  getAircraftStatus(aircraftId: number): FleetMaintenanceStatus | undefined {
    const db = getDb();
    const row = db.prepare(`
      SELECT f.id, f.registration, f.icao_type, f.name, f.status, f.created_at,
             h.total_hours, h.total_cycles,
             h.hours_at_last_a, h.hours_at_last_b,
             h.hours_at_last_c, h.cycles_at_last_c,
             h.last_d_check_date, h.hours_at_last_d,
             h.maintenance_reserve_balance
      FROM fleet f
      LEFT JOIN aircraft_hours h ON h.aircraft_id = f.id
      WHERE f.id = ?
    `).get(aircraftId) as FleetMaintenanceStatusRow | undefined;

    return row ? this.buildFleetStatus(row) : undefined;
  }

  adjustHours(aircraftId: number, data: AdjustHoursRequest, actorId: number): AircraftHours | undefined {
    const db = getDb();
    this.ensureAircraftHours(aircraftId);

    const before = db.prepare('SELECT * FROM aircraft_hours WHERE aircraft_id = ?')
      .get(aircraftId) as AircraftHoursRow | undefined;
    if (!before) return undefined;

    const sets: string[] = [];
    const params: unknown[] = [];

    if (data.totalHours !== undefined) {
      sets.push('total_hours = ?');
      params.push(data.totalHours);
    }
    if (data.totalCycles !== undefined) {
      sets.push('total_cycles = ?');
      params.push(data.totalCycles);
    }

    if (sets.length === 0) return this.toAircraftHours(before);

    sets.push('updated_at = datetime(\'now\')');
    params.push(aircraftId);

    db.prepare(`UPDATE aircraft_hours SET ${sets.join(', ')} WHERE aircraft_id = ?`).run(...params);

    const after = db.prepare('SELECT * FROM aircraft_hours WHERE aircraft_id = ?')
      .get(aircraftId) as AircraftHoursRow;

    auditService.log({
      actorId,
      action: 'maintenance.adjust_hours',
      targetType: 'aircraft',
      targetId: aircraftId,
      before: { totalHours: before.total_hours, totalCycles: before.total_cycles },
      after: { totalHours: after.total_hours, totalCycles: after.total_cycles, reason: data.reason },
    });

    logger.info(TAG, `Hours adjusted for aircraft ${aircraftId}: ${data.reason}`);

    this.checkAndGroundAircraft(aircraftId);

    return this.toAircraftHours(after);
  }

  ensureAircraftHours(aircraftId: number): void {
    getDb().prepare(`
      INSERT OR IGNORE INTO aircraft_hours (aircraft_id, total_hours, total_cycles,
        hours_at_last_a, hours_at_last_b, hours_at_last_c, cycles_at_last_c, hours_at_last_d)
      VALUES (?, 0, 0, 0, 0, 0, 0, 0)
    `).run(aircraftId);
  }

  // ═══════════════════════════════════════════════════════════
  // Check Due Computation (Critical Business Logic)
  // ═══════════════════════════════════════════════════════════

  computeChecksDue(hours: AircraftHoursRow, checks: MaintenanceCheckRow[], fleetCreatedAt?: string): CheckDueStatus[] {
    const results: CheckDueStatus[] = [];
    const now = new Date();

    for (const check of checks) {
      const checkType = check.check_type as MaintenanceCheckType;
      let dueAtHours: number | null = null;
      let dueAtCycles: number | null = null;
      let dueAtDate: string | null = null;
      let remainingHours: number | null = null;
      let remainingCycles: number | null = null;
      let isOverdue = false;
      let isInOverflight = false;
      const overflightPct = check.overflight_pct;

      // Determine base hours/cycles at last check for each type
      switch (checkType) {
        case 'A': {
          if (check.interval_hours != null) {
            dueAtHours = hours.hours_at_last_a + check.interval_hours;
            remainingHours = dueAtHours - hours.total_hours;
          }
          // A checks: overflight tolerance applies (% of interval, not absolute hours)
          if (dueAtHours != null && remainingHours != null) {
            const overflightLimit = dueAtHours + check.interval_hours! * overflightPct;
            if (hours.total_hours > overflightLimit) {
              isOverdue = true;
            } else if (hours.total_hours > dueAtHours) {
              isInOverflight = true;
            }
          }
          break;
        }
        case 'B': {
          if (check.interval_hours != null) {
            dueAtHours = hours.hours_at_last_b + check.interval_hours;
            remainingHours = dueAtHours - hours.total_hours;
          }
          // B checks: overflight tolerance applies (% of interval, not absolute hours)
          if (dueAtHours != null && remainingHours != null) {
            const overflightLimit = dueAtHours + check.interval_hours! * overflightPct;
            if (hours.total_hours > overflightLimit) {
              isOverdue = true;
            } else if (hours.total_hours > dueAtHours) {
              isInOverflight = true;
            }
          }
          break;
        }
        case 'C': {
          if (check.interval_hours != null) {
            dueAtHours = hours.hours_at_last_c + check.interval_hours;
            remainingHours = dueAtHours - hours.total_hours;
          }
          if (check.interval_cycles != null) {
            dueAtCycles = hours.cycles_at_last_c + check.interval_cycles;
            remainingCycles = dueAtCycles - hours.total_cycles;
          }
          // C checks: no overflight tolerance — overdue immediately
          if (dueAtHours != null && hours.total_hours >= dueAtHours) {
            isOverdue = true;
          }
          if (dueAtCycles != null && hours.total_cycles >= dueAtCycles) {
            isOverdue = true;
          }
          // isInOverflight always false for C
          break;
        }
        case 'D': {
          // D checks use calendar-based intervals
          if (hours.last_d_check_date && check.interval_months != null) {
            const lastD = new Date(hours.last_d_check_date);
            const dueDate = new Date(lastD);
            dueDate.setMonth(dueDate.getMonth() + check.interval_months);
            dueAtDate = dueDate.toISOString().split('T')[0];

            if (now >= dueDate) {
              isOverdue = true;
            }
          } else if (!hours.last_d_check_date && check.interval_months != null) {
            // No D check on record — use fleet creation date as baseline
            const baseline = fleetCreatedAt ? new Date(fleetCreatedAt) : null;
            if (baseline) {
              const dueDate = new Date(baseline);
              dueDate.setMonth(dueDate.getMonth() + check.interval_months);
              dueAtDate = dueDate.toISOString().split('T')[0];
              if (now >= dueDate) {
                isOverdue = true;
              }
            } else {
              // No creation date available — mark overdue
              isOverdue = true;
              remainingHours = -1;
            }
          }
          // D checks can also have interval_hours
          if (check.interval_hours != null) {
            dueAtHours = hours.hours_at_last_d + check.interval_hours;
            remainingHours = dueAtHours - hours.total_hours;
            if (hours.total_hours >= dueAtHours) {
              isOverdue = true;
            }
          }
          // isInOverflight always false for D
          break;
        }
      }

      results.push({
        checkType,
        dueAtHours,
        dueAtCycles,
        dueAtDate,
        currentHours: hours.total_hours,
        currentCycles: hours.total_cycles,
        isOverdue,
        isInOverflight,
        remainingHours,
        remainingCycles,
        overflightPct,
      });
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════
  // Grounding Logic
  // ═══════════════════════════════════════════════════════════

  checkAndGroundAircraft(aircraftId: number): void {
    const db = getDb();

    // Get aircraft info
    const fleet = db.prepare('SELECT id, registration, icao_type, status, created_at FROM fleet WHERE id = ?')
      .get(aircraftId) as { id: number; registration: string; icao_type: string; status: string; created_at: string | null } | undefined;
    if (!fleet) return;

    // Check overdue maintenance checks
    const hours = db.prepare('SELECT * FROM aircraft_hours WHERE aircraft_id = ?')
      .get(aircraftId) as AircraftHoursRow | undefined;

    let shouldGround = false;
    const reasons: string[] = [];

    if (hours) {
      const checks = getChecksForType(fleet.icao_type);

      const checksDue = this.computeChecksDue(hours, checks, fleet.created_at ?? undefined);
      const overdueChecks = checksDue.filter(c => c.isOverdue);
      if (overdueChecks.length > 0) {
        shouldGround = true;
        reasons.push(`Overdue checks: ${overdueChecks.map(c => c.checkType).join(', ')}`);
      }
    }

    // Check open ADs past due
    const now = new Date().toISOString();
    const overdueADs = db.prepare(`
      SELECT COUNT(*) as count FROM airworthiness_directives
      WHERE aircraft_id = ? AND compliance_status IN ('open', 'recurring')
        AND (
          (next_due_date IS NOT NULL AND next_due_date < ?)
          OR (next_due_hours IS NOT NULL AND next_due_hours <= (
            SELECT total_hours FROM aircraft_hours WHERE aircraft_id = ?
          ))
        )
    `).get(aircraftId, now.split('T')[0], aircraftId) as { count: number };

    if (overdueADs.count > 0) {
      shouldGround = true;
      reasons.push(`${overdueADs.count} overdue AD(s)`);
    }

    // Check expired MELs
    const expiredMELs = db.prepare(`
      SELECT COUNT(*) as count FROM mel_deferrals
      WHERE aircraft_id = ? AND status = 'open' AND expiry_date < ?
    `).get(aircraftId, now.split('T')[0]) as { count: number };

    if (expiredMELs.count > 0) {
      shouldGround = true;
      reasons.push(`${expiredMELs.count} expired MEL deferral(s)`);
    }

    // Check for grounding discrepancies (status = 'grounded' OR open/in_review with severity = 'grounding')
    const groundedDiscrepancies = db.prepare(
      `SELECT COUNT(*) as c FROM discrepancies WHERE aircraft_id = ? AND status = 'grounded'`
    ).get(aircraftId) as { c: number };
    if (groundedDiscrepancies.c > 0) {
      shouldGround = true;
      reasons.push(`${groundedDiscrepancies.c} grounding discrepancy(ies)`);
    }

    const groundingSeverityDiscrepancies = db.prepare(
      `SELECT COUNT(*) as c FROM discrepancies WHERE aircraft_id = ? AND status IN ('open', 'in_review') AND severity = 'grounding'`
    ).get(aircraftId) as { c: number };
    if (groundingSeverityDiscrepancies.c > 0) {
      shouldGround = true;
      reasons.push(`${groundingSeverityDiscrepancies.c} open discrepancy(ies) with grounding severity`);
    }

    if (shouldGround && fleet.status !== 'maintenance') {
      db.prepare('UPDATE fleet SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run('maintenance', aircraftId);
      logger.warn(TAG, `Aircraft ${fleet.registration} grounded: ${reasons.join('; ')}`);
    }
  }

  returnToService(aircraftId: number, actorId: number): boolean {
    const db = getDb();

    const fleet = db.prepare('SELECT id, registration, icao_type, status, created_at FROM fleet WHERE id = ?')
      .get(aircraftId) as { id: number; registration: string; icao_type: string; status: string; created_at: string | null } | undefined;
    if (!fleet) return false;

    // Check for outstanding items
    const hours = db.prepare('SELECT * FROM aircraft_hours WHERE aircraft_id = ?')
      .get(aircraftId) as AircraftHoursRow | undefined;

    if (hours) {
      const checks = getChecksForType(fleet.icao_type);
      const checksDue = this.computeChecksDue(hours, checks, fleet.created_at ?? undefined);
      if (checksDue.some(c => c.isOverdue)) {
        logger.warn(TAG, `Cannot return ${fleet.registration} to service: overdue checks remain`);
        return false;
      }
    }

    const now = new Date().toISOString();
    const overdueADs = db.prepare(`
      SELECT COUNT(*) as count FROM airworthiness_directives
      WHERE aircraft_id = ? AND compliance_status IN ('open', 'recurring')
        AND (
          (next_due_date IS NOT NULL AND next_due_date < ?)
          OR (next_due_hours IS NOT NULL AND next_due_hours <= (
            SELECT total_hours FROM aircraft_hours WHERE aircraft_id = ?
          ))
        )
    `).get(aircraftId, now.split('T')[0], aircraftId) as { count: number };

    if (overdueADs.count > 0) {
      logger.warn(TAG, `Cannot return ${fleet.registration} to service: ${overdueADs.count} overdue AD(s)`);
      return false;
    }

    const expiredMELs = db.prepare(`
      SELECT COUNT(*) as count FROM mel_deferrals
      WHERE aircraft_id = ? AND status = 'open' AND expiry_date < ?
    `).get(aircraftId, now.split('T')[0]) as { count: number };

    if (expiredMELs.count > 0) {
      logger.warn(TAG, `Cannot return ${fleet.registration} to service: ${expiredMELs.count} expired MEL(s)`);
      return false;
    }

    // Check for in-maintenance discrepancies with incomplete work orders
    const inMaintenanceCount = db.prepare(`
      SELECT COUNT(*) as count FROM discrepancies d
      WHERE d.aircraft_id = ? AND d.status = 'in_maintenance'
      AND NOT EXISTS (
        SELECT 1 FROM work_orders wo
        WHERE wo.discrepancy_id = d.id AND wo.status IN ('completed', 'accepted')
      )
    `).get(aircraftId) as { count: number };

    if (inMaintenanceCount.count > 0) {
      logger.info(TAG, `Cannot RTS aircraft ${aircraftId}: ${inMaintenanceCount.count} in-maintenance discrepancies with incomplete work orders`);
      return false;
    }

    db.prepare('UPDATE fleet SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run('active', aircraftId);

    auditService.log({
      actorId,
      action: 'maintenance.return_to_service',
      targetType: 'aircraft',
      targetId: aircraftId,
      before: { status: fleet.status },
      after: { status: 'active' },
    });

    logger.info(TAG, `Aircraft ${fleet.registration} returned to service by actor ${actorId}`);
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // Maintenance Log CRUD
  // ═══════════════════════════════════════════════════════════

  findAllLog(
    filters: { aircraftId?: number; checkType?: string; status?: string; dateFrom?: string; dateTo?: string },
    page = 1,
    pageSize = 50,
  ): MaintenanceLogListResponse {
    const db = getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.aircraftId) {
      conditions.push('ml.aircraft_id = ?');
      params.push(filters.aircraftId);
    }
    if (filters.checkType) {
      conditions.push('ml.check_type = ?');
      params.push(filters.checkType);
    }
    if (filters.status) {
      conditions.push('ml.status = ?');
      params.push(filters.status);
    }
    if (filters.dateFrom) {
      conditions.push('ml.performed_at >= ?');
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      conditions.push('ml.performed_at <= ?');
      params.push(filters.dateTo);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { count: total } = db.prepare(
      `SELECT COUNT(*) as count FROM maintenance_log ml ${where}`,
    ).get(...params) as { count: number };

    const offset = (page - 1) * pageSize;
    const rows = db.prepare(`
      SELECT ml.*, f.registration
      FROM maintenance_log ml
      LEFT JOIN fleet f ON f.id = ml.aircraft_id
      ${where}
      ORDER BY ml.performed_at DESC, ml.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset) as MaintenanceLogJoinRow[];

    return { entries: rows.map(r => this.toLogEntry(r)), total };
  }

  getLogEntry(id: number): MaintenanceLogEntry | undefined {
    const db = getDb();
    const row = db.prepare(`
      SELECT ml.*, f.registration
      FROM maintenance_log ml
      LEFT JOIN fleet f ON f.id = ml.aircraft_id
      WHERE ml.id = ?
    `).get(id) as MaintenanceLogJoinRow | undefined;

    return row ? this.toLogEntry(row) : undefined;
  }

  createLog(data: CreateMaintenanceLogRequest, actorId: number): MaintenanceLogEntry {
    const db = getDb();
    const now = new Date().toISOString();
    const status = data.status ?? 'scheduled';

    const result = db.prepare(`
      INSERT INTO maintenance_log (
        aircraft_id, check_type, title, description, performed_by, performed_at,
        hours_at_check, cycles_at_check, cost, status, sfp_destination, sfp_expiry,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.aircraftId,
      data.checkType,
      data.title,
      data.description ?? null,
      data.performedBy ?? null,
      data.performedAt ?? null,
      data.hoursAtCheck ?? null,
      data.cyclesAtCheck ?? null,
      data.cost ?? null,
      status,
      data.sfpDestination ?? null,
      data.sfpExpiry ?? null,
      actorId,
      now,
      now,
    );

    const entry = this.getLogEntry(result.lastInsertRowid as number)!;

    auditService.log({
      actorId,
      action: 'maintenance.create_log',
      targetType: 'maintenance_log',
      targetId: entry.id,
      after: { checkType: entry.checkType, title: entry.title, aircraftId: entry.aircraftId },
    });

    logger.info(TAG, `Maintenance log created: ${entry.title} (${entry.checkType}) for aircraft ${entry.aircraftId}`);
    return entry;
  }

  updateLog(id: number, data: UpdateMaintenanceLogRequest, actorId: number): MaintenanceLogEntry | undefined {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM maintenance_log WHERE id = ?').get(id) as MaintenanceLogRow | undefined;
    if (!existing) return undefined;

    const sets: string[] = [];
    const params: unknown[] = [];

    if (data.checkType !== undefined) { sets.push('check_type = ?'); params.push(data.checkType); }
    if (data.title !== undefined) { sets.push('title = ?'); params.push(data.title); }
    if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description); }
    if (data.performedBy !== undefined) { sets.push('performed_by = ?'); params.push(data.performedBy); }
    if (data.performedAt !== undefined) { sets.push('performed_at = ?'); params.push(data.performedAt); }
    if (data.hoursAtCheck !== undefined) { sets.push('hours_at_check = ?'); params.push(data.hoursAtCheck); }
    if (data.cyclesAtCheck !== undefined) { sets.push('cycles_at_check = ?'); params.push(data.cyclesAtCheck); }
    if (data.cost !== undefined) { sets.push('cost = ?'); params.push(data.cost); }
    if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }
    if (data.sfpDestination !== undefined) { sets.push('sfp_destination = ?'); params.push(data.sfpDestination); }
    if (data.sfpExpiry !== undefined) { sets.push('sfp_expiry = ?'); params.push(data.sfpExpiry); }

    if (sets.length === 0) return this.getLogEntry(id);

    sets.push('updated_at = datetime(\'now\')');
    params.push(id);

    db.prepare(`UPDATE maintenance_log SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    const updated = this.getLogEntry(id)!;

    auditService.log({
      actorId,
      action: 'maintenance.update_log',
      targetType: 'maintenance_log',
      targetId: id,
      before: { checkType: existing.check_type, title: existing.title, status: existing.status },
      after: { checkType: updated.checkType, title: updated.title, status: updated.status },
    });

    return updated;
  }

  completeCheck(id: number, actorId: number): MaintenanceLogEntry | undefined {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM maintenance_log WHERE id = ?').get(id) as MaintenanceLogRow | undefined;
    if (!existing) return undefined;

    const now = new Date().toISOString();
    const aircraftId = existing.aircraft_id;

    const txn = db.transaction(() => {
      this.ensureAircraftHours(aircraftId);
      const hours = db.prepare('SELECT * FROM aircraft_hours WHERE aircraft_id = ?')
        .get(aircraftId) as AircraftHoursRow;

      // Mark log entry as completed
      db.prepare(`
        UPDATE maintenance_log
        SET status = 'completed',
            performed_at = COALESCE(performed_at, ?),
            hours_at_check = ?,
            cycles_at_check = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(now, hours.total_hours, hours.total_cycles, id);

      // Update aircraft_hours snapshot fields based on check_type
      const checkType = existing.check_type as MaintenanceCheckType;
      switch (checkType) {
        case 'A':
          db.prepare('UPDATE aircraft_hours SET hours_at_last_a = ?, updated_at = datetime(\'now\') WHERE aircraft_id = ?')
            .run(hours.total_hours, aircraftId);
          break;
        case 'B':
          db.prepare('UPDATE aircraft_hours SET hours_at_last_b = ?, updated_at = datetime(\'now\') WHERE aircraft_id = ?')
            .run(hours.total_hours, aircraftId);
          break;
        case 'C':
          db.prepare('UPDATE aircraft_hours SET hours_at_last_c = ?, cycles_at_last_c = ?, updated_at = datetime(\'now\') WHERE aircraft_id = ?')
            .run(hours.total_hours, hours.total_cycles, aircraftId);
          break;
        case 'D':
          db.prepare('UPDATE aircraft_hours SET last_d_check_date = ?, hours_at_last_d = ?, updated_at = datetime(\'now\') WHERE aircraft_id = ?')
            .run(now.split('T')[0], hours.total_hours, aircraftId);
          break;
      }

      auditService.log({
        actorId,
        action: 'maintenance.complete_check',
        targetType: 'maintenance_log',
        targetId: id,
        before: { status: existing.status },
        after: { status: 'completed', checkType, hoursAtCheck: hours.total_hours },
      });

      logger.info(TAG, `Check ${checkType} completed for aircraft ${aircraftId} at ${hours.total_hours}h`);

      // ── Maintenance reserve settlement ──────────────────────
      // Determine check cost
      let checkCost = existing.cost;
      if (checkCost == null) {
        const aircraft = db.prepare('SELECT icao_type FROM fleet WHERE id = ?').get(aircraftId) as { icao_type: string } | undefined;
        if (aircraft) {
          const checkRow = db.prepare(
            'SELECT default_cost FROM maintenance_checks WHERE icao_type = ? AND check_type = ?',
          ).get(aircraft.icao_type, checkType) as { default_cost: number } | undefined;
          checkCost = checkRow?.default_cost ?? 0;
        } else {
          checkCost = 0;
        }
      }

      if (checkCost > 0) {
        const costFactorRow = db.prepare("SELECT value FROM finance_rate_config WHERE key = 'maintenance_cost_factor'").get() as { value: string } | undefined;
        const costFactor = costFactorRow ? parseFloat(costFactorRow.value) : 1.0;
        const adjustedCost = checkCost * costFactor;

        const reserveBalance = hours.maintenance_reserve_balance ?? 0;
        const registration = (db.prepare('SELECT registration FROM fleet WHERE id = ?').get(aircraftId) as { registration: string } | undefined)?.registration ?? `aircraft#${aircraftId}`;

        if (reserveBalance >= adjustedCost) {
          // Reserve fully covers the check
          db.prepare('UPDATE aircraft_hours SET maintenance_reserve_balance = maintenance_reserve_balance - ? WHERE aircraft_id = ?')
            .run(adjustedCost, aircraftId);
          logger.info(TAG, `Maintenance check covered by reserve: $${adjustedCost.toFixed(2)} of $${reserveBalance.toFixed(2)} reserve used`);
        } else {
          // Reserve insufficient — drain it and record shortfall
          db.prepare('UPDATE aircraft_hours SET maintenance_reserve_balance = 0 WHERE aircraft_id = ?')
            .run(aircraftId);
          const shortfall = adjustedCost - reserveBalance;
          const financeService = new FinanceService();
          financeService.create({
            pilotId: null,
            type: 'expense',
            amount: shortfall,
            description: `Maintenance shortfall: ${checkType} check on ${registration} ($${shortfall.toFixed(2)} over reserve)`,
            category: 'maintenance_shortfall',
          }, actorId);
          logger.warn(TAG, `Maintenance reserve shortfall: $${shortfall.toFixed(2)} for ${checkType} check on ${registration}`);
        }

        // Persist cost on the log entry if it wasn't already set
        if (existing.cost == null) {
          db.prepare('UPDATE maintenance_log SET cost = ? WHERE id = ?').run(adjustedCost, id);
        }
      }

      // Attempt return to service
      this.returnToService(aircraftId, actorId);
    });

    txn();

    return this.getLogEntry(id);
  }

  deleteLog(id: number, actorId: number): boolean {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM maintenance_log WHERE id = ?').get(id) as MaintenanceLogRow | undefined;
    if (!existing) return false;

    db.prepare('DELETE FROM maintenance_log WHERE id = ?').run(id);

    auditService.log({
      actorId,
      action: 'maintenance.delete_log',
      targetType: 'maintenance_log',
      targetId: id,
      before: { checkType: existing.check_type, title: existing.title, aircraftId: existing.aircraft_id },
    });

    logger.info(TAG, `Maintenance log ${id} deleted`);
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // Check Schedules CRUD
  // ═══════════════════════════════════════════════════════════

  findAllCheckSchedules(): MaintenanceCheckSchedule[] {
    const db = getDb();
    const rows = db.prepare(
      'SELECT * FROM maintenance_checks ORDER BY icao_type, check_type',
    ).all() as MaintenanceCheckRow[];

    return rows.map(r => this.toCheckSchedule(r));
  }

  createCheckSchedule(data: CreateCheckScheduleRequest, actorId: number): MaintenanceCheckSchedule {
    const db = getDb();

    // Validate interval values are positive if provided
    if (data.intervalHours !== undefined && data.intervalHours !== null && data.intervalHours <= 0) {
      const error = new Error('intervalHours must be a positive number') as any;
      error.status = 400;
      throw error;
    }
    if (data.intervalCycles !== undefined && data.intervalCycles !== null && data.intervalCycles <= 0) {
      const error = new Error('intervalCycles must be a positive number') as any;
      error.status = 400;
      throw error;
    }
    if (data.intervalMonths !== undefined && data.intervalMonths !== null && data.intervalMonths <= 0) {
      const error = new Error('intervalMonths must be a positive number') as any;
      error.status = 400;
      throw error;
    }

    const result = db.prepare(`
      INSERT INTO maintenance_checks (
        icao_type, check_type, interval_hours, interval_cycles,
        interval_months, overflight_pct, estimated_duration_hours, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.icaoType,
      data.checkType,
      data.intervalHours ?? null,
      data.intervalCycles ?? null,
      data.intervalMonths ?? null,
      data.overflightPct ?? 0,
      data.estimatedDurationHours ?? null,
      data.description ?? null,
    );

    const id = result.lastInsertRowid as number;
    const row = db.prepare('SELECT * FROM maintenance_checks WHERE id = ?').get(id) as MaintenanceCheckRow;
    const schedule = this.toCheckSchedule(row);

    auditService.log({
      actorId,
      action: 'maintenance.create_check_schedule',
      targetType: 'maintenance_check',
      targetId: id,
      after: { icaoType: schedule.icaoType, checkType: schedule.checkType, intervalHours: schedule.intervalHours },
    });

    logger.info(TAG, `Check schedule created: ${schedule.icaoType} ${schedule.checkType}`);
    return schedule;
  }

  updateCheckSchedule(id: number, data: UpdateCheckScheduleRequest, actorId: number): MaintenanceCheckSchedule | undefined {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM maintenance_checks WHERE id = ?').get(id) as MaintenanceCheckRow | undefined;
    if (!existing) return undefined;

    // Validate interval values are positive if provided
    if (data.intervalHours !== undefined && data.intervalHours !== null && data.intervalHours <= 0) {
      const error = new Error('intervalHours must be a positive number') as any;
      error.status = 400;
      throw error;
    }
    if (data.intervalCycles !== undefined && data.intervalCycles !== null && data.intervalCycles <= 0) {
      const error = new Error('intervalCycles must be a positive number') as any;
      error.status = 400;
      throw error;
    }
    if (data.intervalMonths !== undefined && data.intervalMonths !== null && data.intervalMonths <= 0) {
      const error = new Error('intervalMonths must be a positive number') as any;
      error.status = 400;
      throw error;
    }

    const sets: string[] = [];
    const params: unknown[] = [];

    if (data.intervalHours !== undefined) { sets.push('interval_hours = ?'); params.push(data.intervalHours); }
    if (data.intervalCycles !== undefined) { sets.push('interval_cycles = ?'); params.push(data.intervalCycles); }
    if (data.intervalMonths !== undefined) { sets.push('interval_months = ?'); params.push(data.intervalMonths); }
    if (data.overflightPct !== undefined) { sets.push('overflight_pct = ?'); params.push(data.overflightPct); }
    if (data.estimatedDurationHours !== undefined) { sets.push('estimated_duration_hours = ?'); params.push(data.estimatedDurationHours); }
    if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description); }

    if (sets.length === 0) return this.toCheckSchedule(existing);

    params.push(id);
    db.prepare(`UPDATE maintenance_checks SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    const row = db.prepare('SELECT * FROM maintenance_checks WHERE id = ?').get(id) as MaintenanceCheckRow;
    const updated = this.toCheckSchedule(row);

    auditService.log({
      actorId,
      action: 'maintenance.update_check_schedule',
      targetType: 'maintenance_check',
      targetId: id,
      before: { intervalHours: existing.interval_hours, overflightPct: existing.overflight_pct },
      after: { intervalHours: updated.intervalHours, overflightPct: updated.overflightPct },
    });

    return updated;
  }

  deleteCheckSchedule(id: number, actorId: number): boolean {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM maintenance_checks WHERE id = ?').get(id) as MaintenanceCheckRow | undefined;
    if (!existing) return false;

    db.prepare('DELETE FROM maintenance_checks WHERE id = ?').run(id);

    auditService.log({
      actorId,
      action: 'maintenance.delete_check_schedule',
      targetType: 'maintenance_check',
      targetId: id,
      before: { icaoType: existing.icao_type, checkType: existing.check_type },
    });

    logger.info(TAG, `Check schedule ${id} deleted (${existing.icao_type} ${existing.check_type})`);
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // Airworthiness Directives CRUD
  // ═══════════════════════════════════════════════════════════

  findAllADs(
    filters: { aircraftId?: number; status?: string; needsReview?: boolean },
    page = 1,
    pageSize = 50,
  ): ADListResponse {
    const db = getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.aircraftId) {
      conditions.push('ad.aircraft_id = ?');
      params.push(filters.aircraftId);
    }
    if (filters.status) {
      conditions.push('ad.compliance_status = ?');
      params.push(filters.status);
    }
    if (filters.needsReview) {
      conditions.push('ad.needs_review = 1');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { count: total } = db.prepare(
      `SELECT COUNT(*) as count FROM airworthiness_directives ad ${where}`,
    ).get(...params) as { count: number };

    const offset = (page - 1) * pageSize;
    const rows = db.prepare(`
      SELECT ad.*, f.registration
      FROM airworthiness_directives ad
      LEFT JOIN fleet f ON f.id = ad.aircraft_id
      ${where}
      ORDER BY ad.id DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset) as ADJoinRow[];

    return { directives: rows.map(r => this.toAD(r)), total };
  }

  createAD(data: CreateADRequest, actorId: number): AirworthinessDirective {
    const db = getDb();
    const now = new Date().toISOString();
    const status = data.complianceStatus ?? 'open';

    const result = db.prepare(`
      INSERT INTO airworthiness_directives (
        aircraft_id, ad_number, title, description, compliance_status,
        compliance_date, compliance_method, recurring_interval_hours,
        next_due_hours, next_due_date, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.aircraftId,
      data.adNumber,
      data.title,
      data.description ?? null,
      status,
      data.complianceDate ?? null,
      data.complianceMethod ?? null,
      data.recurringIntervalHours ?? null,
      data.nextDueHours ?? null,
      data.nextDueDate ?? null,
      actorId,
      now,
      now,
    );

    const id = result.lastInsertRowid as number;
    const row = db.prepare(`
      SELECT ad.*, f.registration
      FROM airworthiness_directives ad
      LEFT JOIN fleet f ON f.id = ad.aircraft_id
      WHERE ad.id = ?
    `).get(id) as ADJoinRow;

    const ad = this.toAD(row);

    auditService.log({
      actorId,
      action: 'maintenance.create_ad',
      targetType: 'airworthiness_directive',
      targetId: id,
      after: { adNumber: ad.adNumber, title: ad.title, aircraftId: ad.aircraftId },
    });

    logger.info(TAG, `AD created: ${ad.adNumber} for aircraft ${ad.aircraftId}`);
    return ad;
  }

  updateAD(id: number, data: UpdateADRequest, actorId: number): AirworthinessDirective | undefined {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM airworthiness_directives WHERE id = ?')
      .get(id) as AirworthinessDirectiveRow | undefined;
    if (!existing) return undefined;

    const sets: string[] = [];
    const params: unknown[] = [];

    if (data.adNumber !== undefined) { sets.push('ad_number = ?'); params.push(data.adNumber); }
    if (data.title !== undefined) { sets.push('title = ?'); params.push(data.title); }
    if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description); }
    if (data.complianceStatus !== undefined) { sets.push('compliance_status = ?'); params.push(data.complianceStatus); }
    if (data.complianceDate !== undefined) { sets.push('compliance_date = ?'); params.push(data.complianceDate); }
    if (data.complianceMethod !== undefined) { sets.push('compliance_method = ?'); params.push(data.complianceMethod); }
    if (data.recurringIntervalHours !== undefined) { sets.push('recurring_interval_hours = ?'); params.push(data.recurringIntervalHours); }
    if (data.nextDueHours !== undefined) { sets.push('next_due_hours = ?'); params.push(data.nextDueHours); }
    if (data.nextDueDate !== undefined) { sets.push('next_due_date = ?'); params.push(data.nextDueDate); }

    if (sets.length === 0) {
      const row = db.prepare(`
        SELECT ad.*, f.registration FROM airworthiness_directives ad
        LEFT JOIN fleet f ON f.id = ad.aircraft_id WHERE ad.id = ?
      `).get(id) as ADJoinRow;
      return this.toAD(row);
    }

    sets.push('updated_at = datetime(\'now\')');
    params.push(id);

    db.prepare(`UPDATE airworthiness_directives SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    const row = db.prepare(`
      SELECT ad.*, f.registration FROM airworthiness_directives ad
      LEFT JOIN fleet f ON f.id = ad.aircraft_id WHERE ad.id = ?
    `).get(id) as ADJoinRow;
    const updated = this.toAD(row);

    auditService.log({
      actorId,
      action: 'maintenance.update_ad',
      targetType: 'airworthiness_directive',
      targetId: id,
      before: { complianceStatus: existing.compliance_status, title: existing.title },
      after: { complianceStatus: updated.complianceStatus, title: updated.title },
    });

    return updated;
  }

  deleteAD(id: number, actorId: number): boolean {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM airworthiness_directives WHERE id = ?')
      .get(id) as AirworthinessDirectiveRow | undefined;
    if (!existing) return false;

    // Warn in audit log if deleting an AD with open compliance status
    if (existing.compliance_status === 'open') {
      logger.warn(TAG, `Deleting AD ${id} (${existing.ad_number}) with open compliance status`);
    }

    db.prepare('DELETE FROM airworthiness_directives WHERE id = ?').run(id);

    auditService.log({
      actorId,
      action: 'maintenance.delete_ad',
      targetType: 'airworthiness_directive',
      targetId: id,
      before: {
        adNumber: existing.ad_number,
        title: existing.title,
        aircraftId: existing.aircraft_id,
        complianceStatus: existing.compliance_status,
        ...(existing.compliance_status === 'open' ? { warning: 'AD deleted with open compliance status' } : {}),
      },
    });

    logger.info(TAG, `AD ${id} deleted (${existing.ad_number})`);
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // MEL Deferrals CRUD
  // ═══════════════════════════════════════════════════════════

  findAllMEL(
    filters: { aircraftId?: number; status?: string; category?: string },
    page = 1,
    pageSize = 50,
  ): MELListResponse {
    const db = getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.aircraftId) {
      conditions.push('mel.aircraft_id = ?');
      params.push(filters.aircraftId);
    }
    if (filters.status) {
      conditions.push('mel.status = ?');
      params.push(filters.status);
    }
    if (filters.category) {
      conditions.push('mel.category = ?');
      params.push(filters.category);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { count: total } = db.prepare(
      `SELECT COUNT(*) as count FROM mel_deferrals mel ${where}`,
    ).get(...params) as { count: number };

    const offset = (page - 1) * pageSize;
    const rows = db.prepare(`
      SELECT mel.*, f.registration
      FROM mel_deferrals mel
      LEFT JOIN fleet f ON f.id = mel.aircraft_id
      ${where}
      ORDER BY mel.id DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset) as MELJoinRow[];

    return { deferrals: rows.map(r => this.toMEL(r)), total };
  }

  createMEL(data: CreateMELRequest, actorId: number): MELDeferral {
    const db = getDb();
    const now = new Date().toISOString();

    const result = db.prepare(`
      INSERT INTO mel_deferrals (
        aircraft_id, item_number, title, category, deferral_date,
        expiry_date, status, remarks, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
    `).run(
      data.aircraftId,
      data.itemNumber,
      data.title,
      data.category,
      data.deferralDate,
      data.expiryDate,
      data.remarks ?? null,
      actorId,
      now,
    );

    const id = result.lastInsertRowid as number;
    const row = db.prepare(`
      SELECT mel.*, f.registration FROM mel_deferrals mel
      LEFT JOIN fleet f ON f.id = mel.aircraft_id WHERE mel.id = ?
    `).get(id) as MELJoinRow;

    const mel = this.toMEL(row);

    auditService.log({
      actorId,
      action: 'maintenance.create_mel',
      targetType: 'mel_deferral',
      targetId: id,
      after: { itemNumber: mel.itemNumber, title: mel.title, category: mel.category, aircraftId: mel.aircraftId },
    });

    logger.info(TAG, `MEL deferral created: ${mel.itemNumber} for aircraft ${mel.aircraftId}`);
    return mel;
  }

  updateMEL(id: number, data: UpdateMELRequest, actorId: number): MELDeferral | undefined {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM mel_deferrals WHERE id = ?')
      .get(id) as MELDeferralRow | undefined;
    if (!existing) return undefined;

    const sets: string[] = [];
    const params: unknown[] = [];

    if (data.itemNumber !== undefined) { sets.push('item_number = ?'); params.push(data.itemNumber); }
    if (data.title !== undefined) { sets.push('title = ?'); params.push(data.title); }
    if (data.category !== undefined) { sets.push('category = ?'); params.push(data.category); }
    if (data.deferralDate !== undefined) { sets.push('deferral_date = ?'); params.push(data.deferralDate); }
    if (data.expiryDate !== undefined) { sets.push('expiry_date = ?'); params.push(data.expiryDate); }
    if (data.rectifiedDate !== undefined) { sets.push('rectified_date = ?'); params.push(data.rectifiedDate); }
    if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }
    if (data.remarks !== undefined) { sets.push('remarks = ?'); params.push(data.remarks); }

    if (sets.length === 0) {
      const row = db.prepare(`
        SELECT mel.*, f.registration FROM mel_deferrals mel
        LEFT JOIN fleet f ON f.id = mel.aircraft_id WHERE mel.id = ?
      `).get(id) as MELJoinRow;
      return this.toMEL(row);
    }

    params.push(id);
    db.prepare(`UPDATE mel_deferrals SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    const row = db.prepare(`
      SELECT mel.*, f.registration FROM mel_deferrals mel
      LEFT JOIN fleet f ON f.id = mel.aircraft_id WHERE mel.id = ?
    `).get(id) as MELJoinRow;
    const updated = this.toMEL(row);

    auditService.log({
      actorId,
      action: 'maintenance.update_mel',
      targetType: 'mel_deferral',
      targetId: id,
      before: { status: existing.status, category: existing.category },
      after: { status: updated.status, category: updated.category },
    });

    return updated;
  }

  deleteMEL(id: number, actorId: number): boolean {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM mel_deferrals WHERE id = ?')
      .get(id) as MELDeferralRow | undefined;
    if (!existing) return false;

    // Check for linked open discrepancies — prevent deletion if any exist
    const openDiscrepancies = db.prepare(
      `SELECT COUNT(*) as c FROM discrepancies WHERE mel_deferral_id = ? AND status IN ('open', 'in_review', 'deferred')`
    ).get(id) as { c: number };
    if (openDiscrepancies.c > 0) {
      const error = new Error('Cannot delete MEL with open discrepancies') as any;
      error.status = 400;
      throw error;
    }

    db.prepare('DELETE FROM mel_deferrals WHERE id = ?').run(id);

    auditService.log({
      actorId,
      action: 'maintenance.delete_mel',
      targetType: 'mel_deferral',
      targetId: id,
      before: { itemNumber: existing.item_number, title: existing.title, aircraftId: existing.aircraft_id },
    });

    logger.info(TAG, `MEL deferral ${id} deleted (${existing.item_number})`);
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // Components CRUD
  // ═══════════════════════════════════════════════════════════

  findAllComponents(
    filters: { aircraftId?: number; componentType?: string; status?: string },
  ): AircraftComponent[] {
    const db = getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.aircraftId) {
      conditions.push('ac.aircraft_id = ?');
      params.push(filters.aircraftId);
    }
    if (filters.componentType) {
      conditions.push('ac.component_type = ?');
      params.push(filters.componentType);
    }
    if (filters.status) {
      conditions.push('ac.status = ?');
      params.push(filters.status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = db.prepare(`
      SELECT ac.*, f.registration
      FROM aircraft_components ac
      LEFT JOIN fleet f ON f.id = ac.aircraft_id
      ${where}
      ORDER BY ac.aircraft_id, ac.component_type, ac.position
    `).all(...params) as ComponentJoinRow[];

    return rows.map(r => this.toComponent(r));
  }

  createComponent(data: CreateComponentRequest, actorId: number): AircraftComponent {
    const db = getDb();
    const now = new Date().toISOString();
    const status = data.status ?? 'installed';

    const result = db.prepare(`
      INSERT INTO aircraft_components (
        aircraft_id, component_type, position, serial_number, part_number,
        hours_since_new, cycles_since_new, hours_since_overhaul, cycles_since_overhaul,
        overhaul_interval_hours, installed_date, status, remarks, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.aircraftId,
      data.componentType,
      data.position ?? null,
      data.serialNumber ?? null,
      data.partNumber ?? null,
      data.hoursSinceNew ?? 0,
      data.cyclesSinceNew ?? 0,
      data.hoursSinceOverhaul ?? 0,
      data.cyclesSinceOverhaul ?? 0,
      data.overhaulIntervalHours ?? null,
      data.installedDate ?? null,
      status,
      data.remarks ?? null,
      now,
      now,
    );

    const id = result.lastInsertRowid as number;
    const row = db.prepare(`
      SELECT ac.*, f.registration FROM aircraft_components ac
      LEFT JOIN fleet f ON f.id = ac.aircraft_id WHERE ac.id = ?
    `).get(id) as ComponentJoinRow;

    const component = this.toComponent(row);

    auditService.log({
      actorId,
      action: 'maintenance.create_component',
      targetType: 'aircraft_component',
      targetId: id,
      after: { componentType: component.componentType, serialNumber: component.serialNumber, aircraftId: component.aircraftId },
    });

    logger.info(TAG, `Component created: ${component.componentType} for aircraft ${component.aircraftId}`);
    return component;
  }

  updateComponent(id: number, data: UpdateComponentRequest, actorId: number): AircraftComponent | undefined {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM aircraft_components WHERE id = ?')
      .get(id) as AircraftComponentRow | undefined;
    if (!existing) return undefined;

    const sets: string[] = [];
    const params: unknown[] = [];

    if (data.componentType !== undefined) { sets.push('component_type = ?'); params.push(data.componentType); }
    if (data.position !== undefined) { sets.push('position = ?'); params.push(data.position); }
    if (data.serialNumber !== undefined) { sets.push('serial_number = ?'); params.push(data.serialNumber); }
    if (data.partNumber !== undefined) { sets.push('part_number = ?'); params.push(data.partNumber); }
    if (data.hoursSinceNew !== undefined) { sets.push('hours_since_new = ?'); params.push(data.hoursSinceNew); }
    if (data.cyclesSinceNew !== undefined) { sets.push('cycles_since_new = ?'); params.push(data.cyclesSinceNew); }
    if (data.hoursSinceOverhaul !== undefined) { sets.push('hours_since_overhaul = ?'); params.push(data.hoursSinceOverhaul); }
    if (data.cyclesSinceOverhaul !== undefined) { sets.push('cycles_since_overhaul = ?'); params.push(data.cyclesSinceOverhaul); }
    if (data.overhaulIntervalHours !== undefined) { sets.push('overhaul_interval_hours = ?'); params.push(data.overhaulIntervalHours); }
    if (data.installedDate !== undefined) { sets.push('installed_date = ?'); params.push(data.installedDate); }
    if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }
    if (data.remarks !== undefined) { sets.push('remarks = ?'); params.push(data.remarks); }

    if (sets.length === 0) {
      const row = db.prepare(`
        SELECT ac.*, f.registration FROM aircraft_components ac
        LEFT JOIN fleet f ON f.id = ac.aircraft_id WHERE ac.id = ?
      `).get(id) as ComponentJoinRow;
      return this.toComponent(row);
    }

    sets.push('updated_at = datetime(\'now\')');
    params.push(id);

    db.prepare(`UPDATE aircraft_components SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    const row = db.prepare(`
      SELECT ac.*, f.registration FROM aircraft_components ac
      LEFT JOIN fleet f ON f.id = ac.aircraft_id WHERE ac.id = ?
    `).get(id) as ComponentJoinRow;
    const updated = this.toComponent(row);

    auditService.log({
      actorId,
      action: 'maintenance.update_component',
      targetType: 'aircraft_component',
      targetId: id,
      before: { status: existing.status, hoursSinceNew: existing.hours_since_new },
      after: { status: updated.status, hoursSinceNew: updated.hoursSinceNew },
    });

    return updated;
  }

  deleteComponent(id: number, actorId: number): boolean {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM aircraft_components WHERE id = ?')
      .get(id) as AircraftComponentRow | undefined;
    if (!existing) return false;

    db.prepare('DELETE FROM aircraft_components WHERE id = ?').run(id);

    auditService.log({
      actorId,
      action: 'maintenance.delete_component',
      targetType: 'aircraft_component',
      targetId: id,
      before: { componentType: existing.component_type, serialNumber: existing.serial_number, aircraftId: existing.aircraft_id },
    });

    logger.info(TAG, `Component ${id} deleted (${existing.component_type})`);
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // MEL Auto-Expire
  // ═══════════════════════════════════════════════════════════

  expireOverdueMELs(): number {
    const db = getDb();
    const now = new Date().toISOString().split('T')[0];
    const result = db.prepare(`
      UPDATE mel_deferrals SET status = 'expired', updated_at = datetime('now')
      WHERE status = 'open' AND expiry_date IS NOT NULL AND expiry_date < ?
    `).run(now);
    return result.changes;
  }

  // ═══════════════════════════════════════════════════════════
  // Component Overhaul Reset
  // ═══════════════════════════════════════════════════════════

  resetComponentOverhaul(componentId: number, actorId: number): AircraftComponent | undefined {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM aircraft_components WHERE id = ?')
      .get(componentId) as AircraftComponentRow | undefined;
    if (!existing) return undefined;

    db.prepare(`
      UPDATE aircraft_components
      SET hours_since_overhaul = 0,
          cycles_since_overhaul = 0,
          last_overhaul_date = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(componentId);

    auditService.log({
      actorId,
      action: 'maintenance.reset_component_overhaul',
      targetType: 'aircraft_component',
      targetId: componentId,
      before: {
        hoursSinceOverhaul: existing.hours_since_overhaul,
        cyclesSinceOverhaul: existing.cycles_since_overhaul,
      },
      after: { hoursSinceOverhaul: 0, cyclesSinceOverhaul: 0 },
    });

    logger.info(TAG, `Component #${componentId} overhaul reset (${existing.component_type})`);

    const row = db.prepare(`
      SELECT ac.*, f.registration FROM aircraft_components ac
      LEFT JOIN fleet f ON f.id = ac.aircraft_id WHERE ac.id = ?
    `).get(componentId) as ComponentJoinRow;
    return this.toComponent(row);
  }

  // ═══════════════════════════════════════════════════════════
  // PIREP Hook
  // ═══════════════════════════════════════════════════════════

  accumulateFlightHours(aircraftRegistration: string, flightTimeMin: number): void {
    const db = getDb();

    // Look up fleet.id by registration
    const fleet = db.prepare('SELECT id FROM fleet WHERE registration = ?')
      .get(aircraftRegistration) as { id: number } | undefined;
    if (!fleet) {
      logger.warn(TAG, `Cannot accumulate hours: aircraft "${aircraftRegistration}" not found in fleet`);
      return;
    }

    const aircraftId = fleet.id;
    const flightHours = flightTimeMin / 60;

    this.ensureAircraftHours(aircraftId);

    // Update hours and cycles
    db.prepare(`
      UPDATE aircraft_hours
      SET total_hours = total_hours + ?,
          total_cycles = total_cycles + 1,
          updated_at = datetime('now')
      WHERE aircraft_id = ?
    `).run(flightHours, aircraftId);

    // Update installed components
    db.prepare(`
      UPDATE aircraft_components
      SET hours_since_new = hours_since_new + ?,
          cycles_since_new = cycles_since_new + 1,
          hours_since_overhaul = hours_since_overhaul + ?,
          cycles_since_overhaul = cycles_since_overhaul + 1,
          updated_at = datetime('now')
      WHERE aircraft_id = ? AND status = 'installed'
    `).run(flightHours, flightHours, aircraftId);

    logger.info(TAG, `Accumulated ${flightHours.toFixed(2)}h / 1 cycle for ${aircraftRegistration}`);

    this.checkAndGroundAircraft(aircraftId);
  }

  // ═══════════════════════════════════════════════════════════
  // Private: Fleet Status Builder
  // ═══════════════════════════════════════════════════════════

  private buildFleetStatus(row: FleetMaintenanceStatusRow): FleetMaintenanceStatus {
    const db = getDb();
    const totalHours = row.total_hours ?? 0;
    const totalCycles = row.total_cycles ?? 0;

    // Build AircraftHoursRow for computeChecksDue
    const hoursRow: AircraftHoursRow = {
      aircraft_id: row.id,
      total_hours: totalHours,
      total_cycles: totalCycles,
      hours_at_last_a: row.hours_at_last_a ?? 0,
      hours_at_last_b: row.hours_at_last_b ?? 0,
      hours_at_last_c: row.hours_at_last_c ?? 0,
      cycles_at_last_c: row.cycles_at_last_c ?? 0,
      last_d_check_date: row.last_d_check_date,
      hours_at_last_d: row.hours_at_last_d ?? 0,
      maintenance_reserve_balance: row.maintenance_reserve_balance ?? 0,
      updated_at: '',
    };

    const checks = getChecksForType(row.icao_type);

    const checksDue = this.computeChecksDue(hoursRow, checks, row.created_at ?? undefined);

    // Build cost map from checks config
    const checkCostMap: Record<string, number> = {};
    const checkReserveRateMap: Record<string, number> = {};
    for (const c of checks) {
      checkCostMap[c.check_type] = c.default_cost ?? 0;
      checkReserveRateMap[c.check_type] = c.reserve_rate_per_hour ?? 0;
    }

    // Enrich checksDue with default_cost
    for (const cd of checksDue) {
      (cd as CheckDueStatus & { estimatedCost: number }).estimatedCost = checkCostMap[cd.checkType] ?? 0;
    }

    // Compute total reserve rate per flight hour
    const totalReserveRate = Object.values(checkReserveRateMap).reduce((sum, r) => sum + r, 0);
    const hasOverdueChecks = checksDue.some(c => c.isOverdue);

    // Check for overdue ADs
    const now = new Date().toISOString().split('T')[0];
    const overdueADs = db.prepare(`
      SELECT COUNT(*) as count FROM airworthiness_directives
      WHERE aircraft_id = ? AND compliance_status IN ('open', 'recurring')
        AND (
          (next_due_date IS NOT NULL AND next_due_date < ?)
          OR (next_due_hours IS NOT NULL AND next_due_hours <= ?)
        )
    `).get(row.id, now, totalHours) as { count: number };

    // Check for expired MELs
    const expiredMELs = db.prepare(`
      SELECT COUNT(*) as count FROM mel_deferrals
      WHERE aircraft_id = ? AND status = 'open' AND expiry_date < ?
    `).get(row.id, now) as { count: number };

    // Count open discrepancies
    const openDiscrep = db.prepare(`
      SELECT COUNT(*) as count FROM discrepancies
      WHERE aircraft_id = ? AND status IN ('open', 'deferred')
    `).get(row.id) as { count: number };

    // Count active MELs
    const activeMELCount = db.prepare(`
      SELECT COUNT(*) as count FROM mel_deferrals
      WHERE aircraft_id = ? AND status = 'open'
    `).get(row.id) as { count: number };

    // Determine next check due
    let nextCheckType: string | null = null;
    let nextCheckDueIn: number | null = null;

    for (const check of checksDue) {
      if (check.remainingHours != null) {
        if (nextCheckDueIn === null || check.remainingHours < nextCheckDueIn) {
          nextCheckDueIn = check.remainingHours;
          nextCheckType = check.checkType;
        }
      }
    }

    return {
      aircraftId: row.id,
      registration: row.registration,
      icaoType: row.icao_type,
      name: row.name,
      status: row.status,
      totalHours,
      totalCycles,
      checksDue,
      hasOverdueChecks,
      hasOverdueADs: overdueADs.count > 0,
      hasExpiredMEL: expiredMELs.count > 0,
      openDiscrepancies: openDiscrep.count,
      activeMELs: activeMELCount.count,
      nextCheckType,
      nextCheckDueIn,
      maintenanceReserveBalance: row.maintenance_reserve_balance ?? 0,
      reserveRatePerHour: totalReserveRate,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // Private: Row-to-DTO Converters
  // ═══════════════════════════════════════════════════════════

  private toAircraftHours(row: AircraftHoursRow): AircraftHours {
    return {
      aircraftId: row.aircraft_id,
      totalHours: row.total_hours,
      totalCycles: row.total_cycles,
      hoursAtLastA: row.hours_at_last_a,
      hoursAtLastB: row.hours_at_last_b,
      hoursAtLastC: row.hours_at_last_c,
      cyclesAtLastC: row.cycles_at_last_c,
      lastDCheckDate: row.last_d_check_date,
      hoursAtLastD: row.hours_at_last_d,
      updatedAt: row.updated_at,
    };
  }

  private toCheckSchedule(row: MaintenanceCheckRow): MaintenanceCheckSchedule {
    return {
      id: row.id,
      icaoType: row.icao_type,
      checkType: row.check_type as MaintenanceCheckType,
      intervalHours: row.interval_hours,
      intervalCycles: row.interval_cycles,
      intervalMonths: row.interval_months,
      overflightPct: row.overflight_pct,
      estimatedDurationHours: row.estimated_duration_hours,
      description: row.description,
    };
  }

  private toLogEntry(row: MaintenanceLogRow | MaintenanceLogJoinRow): MaintenanceLogEntry {
    const entry: MaintenanceLogEntry = {
      id: row.id,
      aircraftId: row.aircraft_id,
      checkType: row.check_type as MaintenanceLogType,
      title: row.title,
      description: row.description,
      performedBy: row.performed_by,
      performedAt: row.performed_at,
      hoursAtCheck: row.hours_at_check,
      cyclesAtCheck: row.cycles_at_check,
      cost: row.cost,
      status: row.status as MaintenanceLogStatus,
      sfpDestination: row.sfp_destination,
      sfpExpiry: row.sfp_expiry,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    if ('registration' in row && row.registration) {
      entry.aircraftRegistration = row.registration;
    }
    return entry;
  }

  private toAD(row: AirworthinessDirectiveRow | ADJoinRow): AirworthinessDirective {
    const ad: AirworthinessDirective = {
      id: row.id,
      aircraftId: row.aircraft_id,
      adNumber: row.ad_number,
      title: row.title,
      description: row.description,
      complianceStatus: row.compliance_status as ADComplianceStatus,
      complianceDate: row.compliance_date,
      complianceMethod: row.compliance_method,
      recurringIntervalHours: row.recurring_interval_hours,
      nextDueHours: row.next_due_hours,
      nextDueDate: row.next_due_date,
      source: row.source ?? null,
      federalRegisterUrl: row.federal_register_url ?? null,
      applicability: row.applicability ?? null,
      complianceSummary: row.compliance_summary ?? null,
      complianceNotes: row.compliance_notes ?? null,
      needsReview: !!row.needs_review,
      classificationReason: row.classification_reason ?? null,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    if ('registration' in row && row.registration) {
      ad.aircraftRegistration = row.registration;
    }
    return ad;
  }

  private toMEL(row: MELDeferralRow | MELJoinRow): MELDeferral {
    const mel: MELDeferral = {
      id: row.id,
      aircraftId: row.aircraft_id,
      itemNumber: row.item_number,
      title: row.title,
      category: row.category as MELCategory,
      deferralDate: row.deferral_date,
      expiryDate: row.expiry_date,
      rectifiedDate: row.rectified_date,
      status: row.status as MELStatus,
      remarks: row.remarks,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
    if ('registration' in row && row.registration) {
      mel.aircraftRegistration = row.registration;
    }
    return mel;
  }

  getAircraftTimeline(aircraftId: number, page = 1, pageSize = 50): { entries: any[]; total: number } {
    const db = getDb();
    const offset = (page - 1) * pageSize;

    const query = `
      SELECT 'discrepancy' as type, id, reported_at as date,
        ('Discrepancy: ATA ' || ata_chapter) as title, description, status, ata_chapter
      FROM discrepancies WHERE aircraft_id = ?
      UNION ALL
      SELECT 'mel_deferral' as type, id, deferral_date as date,
        ('MEL: ' || item_number || ' - ' || title) as title,
        COALESCE(remarks, '') as description, status, ata_chapter
      FROM mel_deferrals WHERE aircraft_id = ?
      UNION ALL
      SELECT 'maintenance' as type, id, COALESCE(performed_at, created_at) as date,
        title, COALESCE(description, '') as description, status, NULL as ata_chapter
      FROM maintenance_log WHERE aircraft_id = ?
      UNION ALL
      SELECT 'ad_compliance' as type, id, COALESCE(compliance_date, created_at) as date,
        (ad_number || ' - ' || title) as title,
        COALESCE(description, '') as description, compliance_status as status, NULL as ata_chapter
      FROM airworthiness_directives WHERE aircraft_id = ?
      ORDER BY date DESC
      LIMIT ? OFFSET ?
    `;

    const entries = db.prepare(query).all(aircraftId, aircraftId, aircraftId, aircraftId, pageSize, offset);

    const countQuery = `
      SELECT (
        (SELECT COUNT(*) FROM discrepancies WHERE aircraft_id = ?) +
        (SELECT COUNT(*) FROM mel_deferrals WHERE aircraft_id = ?) +
        (SELECT COUNT(*) FROM maintenance_log WHERE aircraft_id = ?) +
        (SELECT COUNT(*) FROM airworthiness_directives WHERE aircraft_id = ?)
      ) as total
    `;
    const { total } = db.prepare(countQuery).get(aircraftId, aircraftId, aircraftId, aircraftId) as { total: number };

    return { entries, total };
  }

  getMelStats(): { active: number; expiring48h: number; catAB: number; catCD: number; rectified30d: number } {
    const db = getDb();
    const active = (db.prepare(`SELECT COUNT(*) as c FROM mel_deferrals WHERE status = 'open'`).get() as { c: number }).c;
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
    const expiring48h = (db.prepare(`SELECT COUNT(*) as c FROM mel_deferrals WHERE status = 'open' AND expiry_date <= ?`).get(in48h) as { c: number }).c;
    const catAB = (db.prepare(`SELECT COUNT(*) as c FROM mel_deferrals WHERE status = 'open' AND category IN ('A', 'B')`).get() as { c: number }).c;
    const catCD = (db.prepare(`SELECT COUNT(*) as c FROM mel_deferrals WHERE status = 'open' AND category IN ('C', 'D')`).get() as { c: number }).c;
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const rectified30d = (db.prepare(`SELECT COUNT(*) as c FROM mel_deferrals WHERE status = 'rectified' AND rectified_date >= ?`).get(thirtyDaysAgo) as { c: number }).c;
    return { active, expiring48h, catAB, catCD, rectified30d };
  }

  private toComponent(row: AircraftComponentRow | ComponentJoinRow): AircraftComponent {
    const comp: AircraftComponent = {
      id: row.id,
      aircraftId: row.aircraft_id,
      componentType: row.component_type as ComponentType,
      position: row.position,
      serialNumber: row.serial_number,
      partNumber: row.part_number,
      hoursSinceNew: row.hours_since_new,
      cyclesSinceNew: row.cycles_since_new,
      hoursSinceOverhaul: row.hours_since_overhaul,
      cyclesSinceOverhaul: row.cycles_since_overhaul,
      overhaulIntervalHours: row.overhaul_interval_hours,
      lastOverhaulDate: row.last_overhaul_date,
      installedDate: row.installed_date,
      status: row.status as ComponentStatus,
      remarks: row.remarks,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    if ('registration' in row && row.registration) {
      comp.aircraftRegistration = row.registration;
    }
    return comp;
  }
}
