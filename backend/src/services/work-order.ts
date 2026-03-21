// backend/src/services/work-order.ts
import { getDb } from '../db/index.js';
import { logger } from '../lib/logger.js';
import { MaintenanceService } from './maintenance.js';
import { NotificationService } from './notification.js';
import { SettingsService } from './settings.js';
import type { Server as SocketServer } from 'socket.io';

const TAG = 'WorkOrder';

// Pool of realistic technician names
const TECHNICIAN_NAMES = [
  'J. Martinez', 'R. Chen', 'K. Williams', 'D. Petrov', 'S. Nakamura',
  'A. Johnson', 'M. Schmidt', 'L. Fernandez', 'T. Okonkwo', 'P. Sullivan',
  'B. Kowalski', 'H. Yamamoto', 'C. Rivera', 'N. Andersen', 'E. Okafor',
];

function randomTechnician(): string {
  return TECHNICIAN_NAMES[Math.floor(Math.random() * TECHNICIAN_NAMES.length)];
}

function randomCertNumber(): string {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

function generateCorrectiveAction(ataTitle: string, description: string): string {
  const descShort = description.length > 80 ? description.slice(0, 80) + '...' : description;
  return `Inspected and corrected per ATA ${ataTitle}. ${descShort} — corrective action performed, system functional check satisfactory. Aircraft serviceable.`;
}

export class WorkOrderService {
  private interval: ReturnType<typeof setInterval> | null = null;
  private readonly io: SocketServer;
  private readonly maintenance = new MaintenanceService();
  private readonly notifications = new NotificationService();
  private readonly settings = new SettingsService();

  constructor(io: SocketServer) {
    this.io = io;
  }

  start(): void {
    this.sweep();
    this.interval = setInterval(() => this.sweep(), 5 * 60 * 1000);
    this.interval.unref();
    logger.info(TAG, 'Work order timer started (every 5 min)');
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /** Create a work order for a discrepancy. Grounds the aircraft. */
  create(params: {
    aircraftId: number;
    discrepancyId: number;
    ataChapter: string;
    severity: string;
    createdBy: number;
  }): { id: number; estimatedHours: number; estimatedCost: number } {
    const db = getDb();

    // Guard: check for active flights
    const activeBid = db.prepare(`
      SELECT id FROM active_bids
      WHERE aircraft_id = ? AND flight_plan_phase IN ('active', 'airborne')
      LIMIT 1
    `).get(params.aircraftId) as { id: number } | undefined;

    if (activeBid) {
      throw new Error('Cannot submit for maintenance — aircraft has an active flight');
    }

    // Lookup repair estimate by ATA prefix (first 2 digits), fallback to '00'
    const ataPrefix = params.ataChapter.slice(0, 2);
    const estimate = db.prepare(`
      SELECT * FROM repair_estimates WHERE ata_chapter_prefix = ?
    `).get(ataPrefix) as any;
    const fallback = db.prepare(`
      SELECT * FROM repair_estimates WHERE ata_chapter_prefix = '00'
    `).get() as any;
    const est = estimate || fallback;

    const hours = params.severity === 'grounding' ? est.grounding_hours : est.non_grounding_hours;
    const cost = params.severity === 'grounding' ? est.grounding_cost : est.non_grounding_cost;

    // Get aircraft station
    const aircraft = db.prepare(`
      SELECT COALESCE(location_icao, base_icao) as station FROM fleet WHERE id = ?
    `).get(params.aircraftId) as { station: string } | undefined;

    const result = db.prepare(`
      INSERT INTO work_orders (aircraft_id, discrepancy_id, ata_chapter, severity, station, estimated_hours, estimated_cost, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.aircraftId, params.discrepancyId, params.ataChapter,
      params.severity, aircraft?.station ?? null, hours, cost, params.createdBy
    );

    // Ground aircraft
    db.prepare(`UPDATE fleet SET status = 'maintenance' WHERE id = ?`).run(params.aircraftId);

    // Update discrepancy status
    db.prepare(`UPDATE discrepancies SET status = 'in_maintenance', updated_at = datetime('now') WHERE id = ?`).run(params.discrepancyId);

    logger.info(TAG, `Work order ${result.lastInsertRowid} created for aircraft ${params.aircraftId}, est ${hours}h / $${cost}`);

    return { id: Number(result.lastInsertRowid), estimatedHours: hours, estimatedCost: cost };
  }

  /** Accept a completed work order — resolve discrepancy + attempt return to service */
  accept(workOrderId: number, actorId: number): { accepted: boolean; returnedToService: boolean } {
    const db = getDb();

    const wo = db.prepare(`SELECT * FROM work_orders WHERE id = ?`).get(workOrderId) as any;
    if (!wo) throw new Error('Work order not found');
    if (wo.status !== 'completed') throw new Error('Work order not yet completed');

    // Accept the work order
    db.prepare(`UPDATE work_orders SET status = 'accepted', updated_at = datetime('now') WHERE id = ?`).run(workOrderId);

    // Resolve the discrepancy
    db.prepare(`
      UPDATE discrepancies SET status = 'resolved', resolved_by = ?, resolved_at = datetime('now'),
        resolution_type = 'maintenance', corrective_action = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(actorId, wo.corrective_action, wo.discrepancy_id);

    // Create maintenance log entry
    db.prepare(`
      INSERT INTO maintenance_log (aircraft_id, check_type, title, description, performed_by, performed_at, cost, status, discrepancy_id, created_by, created_at, updated_at)
      VALUES (?, 'UNSCHEDULED', ?, ?, ?, datetime('now'), ?, 'completed', ?, ?, datetime('now'), datetime('now'))
    `).run(
      wo.aircraft_id,
      `Work Order #${workOrderId} — ATA ${wo.ata_chapter}`,
      wo.corrective_action,
      wo.technician_name,
      wo.actual_cost,
      wo.discrepancy_id,
      actorId
    );

    // Attempt return to service (may fail if other grounding items exist)
    const rts = this.maintenance.returnToService(wo.aircraft_id, actorId);

    return { accepted: true, returnedToService: rts };
  }

  /** Periodic sweep — check for completed work orders */
  private sweep(): void {
    const db = getDb();
    const speed = parseInt(this.settings.get('maintenance_timer_speed') || '1', 10) || 1;

    const active = db.prepare(`
      SELECT wo.*, d.description as discrep_description,
             ac.title as ata_title, f.registration
      FROM work_orders wo
      JOIN discrepancies d ON d.id = wo.discrepancy_id
      LEFT JOIN ata_chapters ac ON ac.chapter = wo.ata_chapter
      JOIN fleet f ON f.id = wo.aircraft_id
      WHERE wo.status = 'in_progress'
    `).all() as any[];

    if (active.length === 0) return;

    const now = Date.now();

    for (const wo of active) {
      const startedMs = new Date(wo.started_at + 'Z').getTime();
      const elapsedRealSeconds = (now - startedMs) / 1000;
      const elapsedSimHours = (elapsedRealSeconds / 3600) * speed;

      if (elapsedSimHours >= wo.estimated_hours) {
        const technician = randomTechnician();
        const authority = `FAA A&P Certificate #${randomCertNumber()}`;
        const correctiveAction = generateCorrectiveAction(wo.ata_title || wo.ata_chapter, wo.discrep_description);
        const costVariance = 1 + (Math.random() * 0.2 - 0.1); // ±10%
        const actualCost = Math.round(wo.estimated_cost * costVariance * 100) / 100;

        db.prepare(`
          UPDATE work_orders SET status = 'completed', completed_at = datetime('now'),
            technician_name = ?, corrective_action = ?, authority = ?, actual_cost = ?,
            updated_at = datetime('now')
          WHERE id = ?
        `).run(technician, correctiveAction, authority, actualCost, wo.id);

        // Notify all admin/dispatcher users
        const admins = db.prepare(`SELECT id FROM users WHERE role IN ('admin', 'dispatcher')`).all() as { id: number }[];
        for (const user of admins) {
          this.notifications.send({
            userId: user.id,
            message: `Work Order Complete — ${wo.registration}: ${wo.ata_title || wo.ata_chapter} repair completed. Review return-to-service record.`,
            type: 'info',
          });
        }

        // Emit Socket.io event
        this.io.emit('work_order:completed', {
          workOrderId: wo.id,
          aircraftId: wo.aircraft_id,
          registration: wo.registration,
        });

        logger.info(TAG, `Work order ${wo.id} completed for ${wo.registration} (${elapsedSimHours.toFixed(1)}h sim / ${wo.estimated_hours}h est)`);
      }
    }
  }
}
