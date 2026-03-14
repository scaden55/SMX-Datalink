import { getDb } from '../db/index.js';
import { logger } from '../lib/logger.js';
import { AuditService } from './audit.js';
import type { MelMasterRow, MelMasterJoinRow } from '../types/db-rows.js';
import type { MelMasterItem, CreateMelMasterRequest, UpdateMelMasterRequest } from '@acars/shared';

const TAG = 'MelMasterService';
const audit = new AuditService();

export class MelMasterService {

  private toMelMasterItem(row: MelMasterJoinRow): MelMasterItem {
    return {
      id: row.id,
      icaoType: row.icao_type,
      ataChapter: row.ata_chapter,
      ataChapterTitle: row.ata_title,
      itemNumber: row.item_number,
      title: row.title,
      description: row.description,
      category: row.category as MelMasterItem['category'],
      repairIntervalDays: row.repair_interval_days,
      remarks: row.remarks,
      operationsProcedure: row.operations_procedure,
      maintenanceProcedure: row.maintenance_procedure,
      isActive: row.is_active === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  findAll(icaoType?: string): MelMasterItem[] {
    const db = getDb();
    let sql = `
      SELECT m.*, COALESCE(a.title, '') AS ata_title
      FROM mel_master m
      LEFT JOIN ata_chapters a ON a.chapter = m.ata_chapter
      WHERE m.is_active = 1
    `;
    const params: unknown[] = [];

    if (icaoType) {
      sql += ' AND m.icao_type = ?';
      params.push(icaoType);
    }

    sql += ' ORDER BY m.icao_type, m.ata_chapter, m.item_number';

    const rows = db.prepare(sql).all(...params) as MelMasterJoinRow[];
    return rows.map((r) => this.toMelMasterItem(r));
  }

  findById(id: number): MelMasterItem | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT m.*, COALESCE(a.title, '') AS ata_title
      FROM mel_master m
      LEFT JOIN ata_chapters a ON a.chapter = m.ata_chapter
      WHERE m.id = ?
    `).get(id) as MelMasterJoinRow | undefined;

    return row ? this.toMelMasterItem(row) : null;
  }

  findByTypeAndChapter(icaoType: string, ataChapter: string): MelMasterItem[] {
    const db = getDb();
    const rows = db.prepare(`
      SELECT m.*, COALESCE(a.title, '') AS ata_title
      FROM mel_master m
      LEFT JOIN ata_chapters a ON a.chapter = m.ata_chapter
      WHERE m.icao_type = ? AND m.ata_chapter = ? AND m.is_active = 1
      ORDER BY m.item_number
    `).all(icaoType, ataChapter) as MelMasterJoinRow[];

    return rows.map((r) => this.toMelMasterItem(r));
  }

  create(data: CreateMelMasterRequest, userId: number): MelMasterItem {
    const db = getDb();
    const now = new Date().toISOString();

    const result = db.prepare(`
      INSERT INTO mel_master (
        icao_type, ata_chapter, item_number, title, description,
        category, repair_interval_days, remarks,
        operations_procedure, maintenance_procedure,
        is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      data.icaoType,
      data.ataChapter,
      data.itemNumber,
      data.title,
      data.description ?? null,
      data.category,
      data.repairIntervalDays ?? null,
      data.remarks ?? null,
      data.operationsProcedure ?? null,
      data.maintenanceProcedure ?? null,
      now,
      now,
    );

    const id = result.lastInsertRowid as number;
    logger.info(TAG, 'Created MEL master item', { id, icaoType: data.icaoType, ataChapter: data.ataChapter });

    audit.log({
      actorId: userId,
      action: 'mel_master.create',
      targetType: 'mel_master',
      targetId: id,
      after: data as unknown as Record<string, unknown>,
    });

    return this.findById(id)!;
  }

  update(id: number, data: UpdateMelMasterRequest, userId: number): MelMasterItem | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const db = getDb();
    const fieldMap: Record<string, string> = {
      ataChapter: 'ata_chapter',
      itemNumber: 'item_number',
      title: 'title',
      description: 'description',
      category: 'category',
      repairIntervalDays: 'repair_interval_days',
      remarks: 'remarks',
      operationsProcedure: 'operations_procedure',
      maintenanceProcedure: 'maintenance_procedure',
      isActive: 'is_active',
    };

    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const [key, column] of Object.entries(fieldMap)) {
      const value = (data as Record<string, unknown>)[key];
      if (value !== undefined) {
        setClauses.push(`${column} = ?`);
        if (key === 'isActive') {
          values.push(value ? 1 : 0);
        } else {
          values.push(value ?? null);
        }
      }
    }

    if (setClauses.length === 0) return existing;

    setClauses.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    db.prepare(`UPDATE mel_master SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);

    logger.info(TAG, 'Updated MEL master item', { id });

    audit.log({
      actorId: userId,
      action: 'mel_master.update',
      targetType: 'mel_master',
      targetId: id,
      before: data as unknown as Record<string, unknown>,
    });

    return this.findById(id);
  }

  deactivate(id: number, userId: number): boolean {
    const existing = this.findById(id);
    if (!existing) return false;

    const db = getDb();
    db.prepare('UPDATE mel_master SET is_active = 0, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), id);

    logger.info(TAG, 'Deactivated MEL master item', { id });

    audit.log({
      actorId: userId,
      action: 'mel_master.deactivate',
      targetType: 'mel_master',
      targetId: id,
    });

    return true;
  }
}
