import { getDb } from '../db/index.js';
import type { ExceedanceRow } from '../types/db-rows.js';
import type { ExceedanceEvent, FlightExceedance } from '@acars/shared';
import { logger } from '../lib/logger.js';

function rowToExceedance(row: ExceedanceRow): FlightExceedance {
  return {
    id: row.id,
    bidId: row.bid_id,
    logbookId: row.logbook_id,
    pilotId: row.pilot_id,
    type: row.type as FlightExceedance['type'],
    severity: row.severity as FlightExceedance['severity'],
    value: row.value,
    threshold: row.threshold,
    unit: row.unit,
    phase: row.phase,
    message: row.message,
    detectedAt: row.detected_at,
  };
}

export class ExceedanceService {
  /** Insert a detected exceedance event. */
  insert(bidId: number, pilotId: number, event: ExceedanceEvent): FlightExceedance {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO flight_exceedances (bid_id, pilot_id, type, severity, value, threshold, unit, phase, message, detected_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      bidId, pilotId,
      event.type, event.severity,
      event.value, event.threshold, event.unit,
      event.phase, event.message, event.detectedAt,
    );
    logger.info('Exceedance', `Recorded ${event.type} for bid ${bidId}`, { severity: event.severity, value: event.value });
    return {
      id: result.lastInsertRowid as number,
      bidId,
      logbookId: null,
      pilotId,
      ...event,
    };
  }

  /** Link exceedances to a logbook entry after PIREP submission. */
  linkToLogbook(bidId: number, logbookId: number): void {
    const db = getDb();
    db.prepare('UPDATE flight_exceedances SET logbook_id = ? WHERE bid_id = ?').run(logbookId, bidId);
  }

  /** Get exceedances for a logbook entry. */
  findByLogbookId(logbookId: number): FlightExceedance[] {
    const db = getDb();
    const rows = db.prepare(
      'SELECT * FROM flight_exceedances WHERE logbook_id = ? ORDER BY detected_at',
    ).all(logbookId) as ExceedanceRow[];
    return rows.map(rowToExceedance);
  }

  /** Get exceedances for an active bid. */
  findByBidId(bidId: number): FlightExceedance[] {
    const db = getDb();
    const rows = db.prepare(
      'SELECT * FROM flight_exceedances WHERE bid_id = ? ORDER BY detected_at',
    ).all(bidId) as ExceedanceRow[];
    return rows.map(rowToExceedance);
  }
}
