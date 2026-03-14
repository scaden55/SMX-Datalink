import { getDb } from '../db/index.js';
import { logger } from '../lib/logger.js';
import { AuditService } from './audit.js';
import { NotificationService } from './notification.js';
import type {
  Discrepancy,
  DiscrepancySeverity,
  DiscrepancyStatus,
  ResolutionType,
  CreateDiscrepancyRequest,
  ResolveDiscrepancyRequest,
  DeferDiscrepancyRequest,
  DiscrepancyListResponse,
  DiscrepancyStatsResponse,
} from '@acars/shared';
import type {
  DiscrepancyRow,
  DiscrepancyJoinRow,
  MelMasterRow,
} from '../types/db-rows.js';

const TAG = 'Discrepancy';
const auditService = new AuditService();
const notificationService = new NotificationService();

export class DiscrepancyService {

  // ═══════════════════════════════════════════════════════════
  // Create
  // ═══════════════════════════════════════════════════════════

  create(data: CreateDiscrepancyRequest, reportedBy: number): Discrepancy {
    const db = getDb();

    // Validate ATA chapter exists
    const ataChapter = db.prepare(
      'SELECT chapter, title FROM ata_chapters WHERE chapter = ?',
    ).get(data.ataChapter) as { chapter: string; title: string } | undefined;

    if (!ataChapter) {
      const error = new Error(`ATA chapter ${data.ataChapter} not found`) as any;
      error.status = 400;
      throw error;
    }

    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO discrepancies (
        aircraft_id, flight_number, reported_by, reported_at,
        ata_chapter, description, flight_phase, severity, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
    `).run(
      data.aircraftId,
      data.flightNumber ?? null,
      reportedBy,
      now,
      data.ataChapter,
      data.description,
      data.flightPhase ?? null,
      data.severity,
      now,
      now,
    );

    const id = result.lastInsertRowid as number;

    // Notify dispatchers and admins
    const adminsAndDispatchers = db.prepare(
      "SELECT id FROM users WHERE role IN ('admin', 'dispatcher')",
    ).all() as { id: number }[];

    for (const user of adminsAndDispatchers) {
      notificationService.send({
        userId: user.id,
        message: `New discrepancy reported on ATA ${data.ataChapter} — ${data.description.substring(0, 80)}`,
        type: 'warning',
        link: `/admin/maintenance/discrepancies/${id}`,
      });
    }

    auditService.log({
      actorId: reportedBy,
      action: 'discrepancy.create',
      targetType: 'discrepancy',
      targetId: id,
      after: { ...data },
    });

    logger.info(TAG, `Discrepancy #${id} created`, { aircraftId: data.aircraftId, ataChapter: data.ataChapter });

    return this.findById(id)!;
  }

  // ═══════════════════════════════════════════════════════════
  // Find All
  // ═══════════════════════════════════════════════════════════

  findAll(filters: {
    status?: string;
    search?: string;
    aircraftId?: number;
    page?: number;
    pageSize?: number;
  } = {}): DiscrepancyListResponse {
    const db = getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.status) {
      conditions.push('d.status = ?');
      params.push(filters.status);
    }
    if (filters.aircraftId) {
      conditions.push('d.aircraft_id = ?');
      params.push(filters.aircraftId);
    }
    if (filters.search) {
      conditions.push('(d.description LIKE ? OR d.ata_chapter LIKE ? OR f.registration LIKE ?)');
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    const offset = (page - 1) * pageSize;

    const { count: total } = db.prepare(
      `SELECT COUNT(*) as count FROM discrepancies d
       LEFT JOIN fleet f ON f.id = d.aircraft_id
       ${where}`,
    ).get(...params) as { count: number };

    const rows = db.prepare(`
      SELECT d.*,
        f.registration,
        u_rep.first_name || ' ' || u_rep.last_name AS reporter_name,
        u_res.first_name || ' ' || u_res.last_name AS resolver_name,
        ata.title AS ata_title
      FROM discrepancies d
      LEFT JOIN fleet f ON f.id = d.aircraft_id
      LEFT JOIN users u_rep ON u_rep.id = d.reported_by
      LEFT JOIN users u_res ON u_res.id = d.resolved_by
      LEFT JOIN ata_chapters ata ON ata.chapter = d.ata_chapter
      ${where}
      ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset) as DiscrepancyJoinRow[];

    return {
      discrepancies: rows.map(this.toDiscrepancy),
      total,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // Find By ID
  // ═══════════════════════════════════════════════════════════

  findById(id: number): Discrepancy | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT d.*,
        f.registration,
        u_rep.first_name || ' ' || u_rep.last_name AS reporter_name,
        u_res.first_name || ' ' || u_res.last_name AS resolver_name,
        ata.title AS ata_title
      FROM discrepancies d
      LEFT JOIN fleet f ON f.id = d.aircraft_id
      LEFT JOIN users u_rep ON u_rep.id = d.reported_by
      LEFT JOIN users u_res ON u_res.id = d.resolved_by
      LEFT JOIN ata_chapters ata ON ata.chapter = d.ata_chapter
      WHERE d.id = ?
    `).get(id) as DiscrepancyJoinRow | undefined;

    return row ? this.toDiscrepancy(row) : null;
  }

  // ═══════════════════════════════════════════════════════════
  // Find By User
  // ═══════════════════════════════════════════════════════════

  findByUser(userId: number): DiscrepancyListResponse {
    const db = getDb();

    const { count: total } = db.prepare(
      'SELECT COUNT(*) as count FROM discrepancies WHERE reported_by = ?',
    ).get(userId) as { count: number };

    const rows = db.prepare(`
      SELECT d.*,
        f.registration,
        u_rep.first_name || ' ' || u_rep.last_name AS reporter_name,
        u_res.first_name || ' ' || u_res.last_name AS resolver_name,
        ata.title AS ata_title
      FROM discrepancies d
      LEFT JOIN fleet f ON f.id = d.aircraft_id
      LEFT JOIN users u_rep ON u_rep.id = d.reported_by
      LEFT JOIN users u_res ON u_res.id = d.resolved_by
      LEFT JOIN ata_chapters ata ON ata.chapter = d.ata_chapter
      WHERE d.reported_by = ?
      ORDER BY d.created_at DESC
    `).all(userId) as DiscrepancyJoinRow[];

    return {
      discrepancies: rows.map(this.toDiscrepancy),
      total,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // Update
  // ═══════════════════════════════════════════════════════════

  update(id: number, data: { status?: string; correctiveAction?: string }, userId: number): Discrepancy | null {
    const db = getDb();
    const existing = this.findById(id);
    if (!existing) return null;

    const sets: string[] = [];
    const params: unknown[] = [];

    if (data.status !== undefined) {
      sets.push('status = ?');
      params.push(data.status);
    }
    if (data.correctiveAction !== undefined) {
      sets.push('corrective_action = ?');
      params.push(data.correctiveAction);
    }

    if (sets.length === 0) return existing;

    sets.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    db.prepare(`UPDATE discrepancies SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    auditService.log({
      actorId: userId,
      action: 'discrepancy.update',
      targetType: 'discrepancy',
      targetId: id,
      before: { status: existing.status, correctiveAction: existing.correctiveAction },
      after: data,
    });

    logger.info(TAG, `Discrepancy #${id} updated`, data);

    return this.findById(id);
  }

  // ═══════════════════════════════════════════════════════════
  // Resolve
  // ═══════════════════════════════════════════════════════════

  resolve(id: number, data: ResolveDiscrepancyRequest, userId: number): Discrepancy {
    const db = getDb();
    const existing = this.findById(id);
    if (!existing) {
      const error = new Error(`Discrepancy #${id} not found`) as any;
      error.status = 404;
      throw error;
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE discrepancies SET
        status = 'resolved',
        resolution_type = 'corrected',
        corrective_action = ?,
        resolved_by = ?,
        resolved_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(data.correctiveAction, userId, now, now, id);

    // Optionally create maintenance log entry
    if (data.createMaintenanceLog) {
      db.prepare(`
        INSERT INTO maintenance_log (
          aircraft_id, check_type, title, description,
          performed_by, performed_at, status, discrepancy_id,
          created_by, created_at, updated_at
        ) VALUES (?, 'UNSCHEDULED', ?, ?, ?, ?, 'completed', ?, ?, ?, ?)
      `).run(
        existing.aircraftId,
        `Corrective action — ATA ${existing.ataChapter}`,
        data.correctiveAction,
        userId,
        now,
        id,
        userId,
        now,
        now,
      );
    }

    // Notify reporting pilot
    if (existing.reportedBy !== userId) {
      notificationService.send({
        userId: existing.reportedBy,
        message: `Your discrepancy on ATA ${existing.ataChapter} has been resolved`,
        type: 'success',
        link: `/maintenance/discrepancies/${id}`,
      });
    }

    auditService.log({
      actorId: userId,
      action: 'discrepancy.resolve',
      targetType: 'discrepancy',
      targetId: id,
      before: { status: existing.status },
      after: { status: 'resolved', resolutionType: 'corrected', correctiveAction: data.correctiveAction },
    });

    logger.info(TAG, `Discrepancy #${id} resolved`, { userId });

    return this.findById(id)!;
  }

  // ═══════════════════════════════════════════════════════════
  // Defer (MEL)
  // ═══════════════════════════════════════════════════════════

  defer(id: number, data: DeferDiscrepancyRequest, userId: number): Discrepancy {
    const db = getDb();

    // Fetch existing discrepancy
    const existing = this.findById(id);
    if (!existing) {
      const error = new Error(`Discrepancy #${id} not found`) as any;
      error.status = 404;
      throw error;
    }

    // Get aircraft icao_type
    const aircraft = db.prepare(
      'SELECT id, icao_type FROM fleet WHERE id = ?',
    ).get(existing.aircraftId) as { id: number; icao_type: string } | undefined;

    if (!aircraft) {
      const error = new Error(`Aircraft #${existing.aircraftId} not found`) as any;
      error.status = 404;
      throw error;
    }

    // Validate MEL master item
    const melMaster = db.prepare(
      'SELECT * FROM mel_master_list WHERE id = ? AND icao_type = ? AND is_active = 1',
    ).get(data.melMasterId, aircraft.icao_type) as MelMasterRow | undefined;

    if (!melMaster) {
      const error = new Error(
        `MEL master item #${data.melMasterId} not found or not applicable for aircraft type ${aircraft.icao_type}`,
      ) as any;
      error.status = 400;
      throw error;
    }

    // Compute expiry date based on category
    const today = new Date();
    let daysToAdd: number;
    switch (melMaster.category) {
      case 'A':
        daysToAdd = melMaster.repair_interval_days ?? 1;
        break;
      case 'B':
        daysToAdd = 3;
        break;
      case 'C':
        daysToAdd = 10;
        break;
      case 'D':
        daysToAdd = 120;
        break;
      default:
        daysToAdd = 3;
    }
    const expiryDate = new Date(today);
    expiryDate.setDate(expiryDate.getDate() + daysToAdd);
    const deferralDateStr = today.toISOString().split('T')[0];
    const expiryDateStr = expiryDate.toISOString().split('T')[0];
    const now = new Date().toISOString();

    // Insert MEL deferral
    const deferralResult = db.prepare(`
      INSERT INTO mel_deferrals (
        aircraft_id, item_number, title, category,
        deferral_date, expiry_date, status, remarks,
        discrepancy_id, mel_master_id, ata_chapter,
        placard_info, operations_procedure, maintenance_procedure,
        authorized_by, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      existing.aircraftId,
      melMaster.item_number,
      melMaster.title,
      melMaster.category,
      deferralDateStr,
      expiryDateStr,
      data.remarks ?? melMaster.remarks,
      id,
      data.melMasterId,
      melMaster.ata_chapter,
      data.placardInfo ?? null,
      data.operationsProcedure ?? melMaster.operations_procedure,
      data.maintenanceProcedure ?? melMaster.maintenance_procedure,
      userId,
      userId,
      now,
      now,
    );

    const deferralId = deferralResult.lastInsertRowid as number;

    // Update discrepancy
    db.prepare(`
      UPDATE discrepancies SET
        status = 'deferred',
        resolution_type = 'deferred_mel',
        mel_deferral_id = ?,
        resolved_by = ?,
        resolved_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(deferralId, userId, now, now, id);

    // Clear mel_ack_at on active_bids for this aircraft type
    db.prepare(`
      UPDATE active_bids SET mel_ack_at = NULL
      WHERE schedule_id IN (
        SELECT sf.id FROM scheduled_flights sf
        WHERE sf.aircraft_type = (SELECT icao_type FROM fleet WHERE id = ?)
      )
    `).run(existing.aircraftId);

    // Notify reporting pilot
    if (existing.reportedBy !== userId) {
      notificationService.send({
        userId: existing.reportedBy,
        message: `Your discrepancy on ATA ${existing.ataChapter} has been deferred under MEL Cat ${melMaster.category}`,
        type: 'info',
        link: `/maintenance/discrepancies/${id}`,
      });
    }

    auditService.log({
      actorId: userId,
      action: 'discrepancy.defer',
      targetType: 'discrepancy',
      targetId: id,
      after: {
        status: 'deferred',
        melDeferralId: deferralId,
        melMasterId: data.melMasterId,
        category: melMaster.category,
        expiryDate: expiryDateStr,
      },
    });

    logger.info(TAG, `Discrepancy #${id} deferred under MEL Cat ${melMaster.category}`, {
      deferralId,
      expiryDate: expiryDateStr,
    });

    return this.findById(id)!;
  }

  // ═══════════════════════════════════════════════════════════
  // Ground
  // ═══════════════════════════════════════════════════════════

  ground(id: number, userId: number): Discrepancy {
    const db = getDb();
    const existing = this.findById(id);
    if (!existing) {
      const error = new Error(`Discrepancy #${id} not found`) as any;
      error.status = 404;
      throw error;
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE discrepancies SET
        status = 'grounded',
        resolution_type = 'grounded',
        resolved_by = ?,
        resolved_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(userId, now, now, id);

    // Ground the aircraft
    db.prepare(
      "UPDATE fleet SET status = 'maintenance' WHERE id = ?",
    ).run(existing.aircraftId);

    // Notify reporting pilot
    if (existing.reportedBy !== userId) {
      notificationService.send({
        userId: existing.reportedBy,
        message: `Aircraft grounded due to discrepancy on ATA ${existing.ataChapter}`,
        type: 'error',
        link: `/maintenance/discrepancies/${id}`,
      });
    }

    auditService.log({
      actorId: userId,
      action: 'discrepancy.ground',
      targetType: 'discrepancy',
      targetId: id,
      after: { status: 'grounded', aircraftId: existing.aircraftId },
    });

    logger.info(TAG, `Discrepancy #${id} — aircraft #${existing.aircraftId} grounded`, { userId });

    return this.findById(id)!;
  }

  // ═══════════════════════════════════════════════════════════
  // Stats
  // ═══════════════════════════════════════════════════════════

  getStats(): DiscrepancyStatsResponse {
    const db = getDb();

    const { count: open } = db.prepare(
      "SELECT COUNT(*) as count FROM discrepancies WHERE status = 'open'",
    ).get() as { count: number };

    const { count: inReview } = db.prepare(
      "SELECT COUNT(*) as count FROM discrepancies WHERE status = 'in_review'",
    ).get() as { count: number };

    const { count: deferred } = db.prepare(
      "SELECT COUNT(*) as count FROM discrepancies WHERE status = 'deferred'",
    ).get() as { count: number };

    const { count: resolved30d } = db.prepare(
      "SELECT COUNT(*) as count FROM discrepancies WHERE status = 'resolved' AND resolved_at >= datetime('now', '-30 days')",
    ).get() as { count: number };

    return { open, inReview, deferred, resolved30d };
  }

  // ═══════════════════════════════════════════════════════════
  // Helper
  // ═══════════════════════════════════════════════════════════

  private toDiscrepancy(row: DiscrepancyJoinRow): Discrepancy {
    return {
      id: row.id,
      aircraftId: row.aircraft_id,
      aircraftRegistration: row.registration,
      flightNumber: row.flight_number,
      logbookEntryId: row.logbook_entry_id,
      reportedBy: row.reported_by,
      reportedByName: row.reporter_name,
      reportedAt: row.reported_at,
      ataChapter: row.ata_chapter,
      ataChapterTitle: row.ata_title,
      description: row.description,
      flightPhase: row.flight_phase,
      severity: row.severity as DiscrepancySeverity,
      status: row.status as DiscrepancyStatus,
      resolvedBy: row.resolved_by,
      resolvedByName: row.resolver_name ?? undefined,
      resolvedAt: row.resolved_at,
      resolutionType: row.resolution_type as ResolutionType | null,
      correctiveAction: row.corrective_action,
      melDeferralId: row.mel_deferral_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
