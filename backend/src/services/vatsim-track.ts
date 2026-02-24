import { getDb } from '../db/index.js';
import type { VatsimPilot } from '@acars/shared';

// ── Throttle state per session ──────────────────────────────

interface LastInsert {
  at: number;
  lat: number;
  lon: number;
}

const lastInserts = new Map<string, LastInsert>();

const MIN_INTERVAL_MS = 10_000;  // 10s between inserts per session
const MIN_DISTANCE_DEG = 0.001;  // ~111m — skip if barely moved
const MIN_GROUNDSPEED = 30;      // kt — skip parked/taxiing aircraft
const RETENTION_MS = 24 * 60 * 60 * 1000; // 24h

// ── VatsimTrackService ──────────────────────────────────────

export class VatsimTrackService {
  private insertStmt = () =>
    getDb().prepare(
      `INSERT INTO vatsim_track (session_key, cid, callsign, lat, lon, altitude_ft, groundspeed, heading, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

  /**
   * Batch-record positions for all moving pilots from a single VATSIM poll.
   * Wraps all inserts in one transaction for performance (~2000 pilots → 1 fsync).
   * Per-session throttle: skips if <10s elapsed AND <0.001° moved.
   */
  recordSnapshot(pilots: VatsimPilot[]): number {
    const now = Date.now();
    const db = getDb();
    const stmt = this.insertStmt();
    let inserted = 0;

    const runBatch = db.transaction(() => {
      for (const p of pilots) {
        if (p.groundspeed < MIN_GROUNDSPEED) continue;

        const sessionKey = `${p.cid}:${p.logon_time}`;
        const last = lastInserts.get(sessionKey);

        if (last) {
          const elapsed = now - last.at;
          const moved =
            Math.abs(p.latitude - last.lat) > MIN_DISTANCE_DEG ||
            Math.abs(p.longitude - last.lon) > MIN_DISTANCE_DEG;

          if (elapsed < MIN_INTERVAL_MS && !moved) continue;
        }

        stmt.run(
          sessionKey,
          p.cid,
          p.callsign,
          p.latitude,
          p.longitude,
          Math.round(p.altitude),
          Math.round(p.groundspeed),
          Math.round(p.heading),
          now,
        );

        lastInserts.set(sessionKey, { at: now, lat: p.latitude, lon: p.longitude });
        inserted++;
      }
    });

    runBatch();
    return inserted;
  }

  /**
   * Fetch the full track for a pilot's most recent session.
   * Finds the latest session_key for the CID, then returns all points in order.
   */
  getTrackByCid(cid: number): { lat: number; lon: number; alt: number }[] {
    const db = getDb();

    // Find the latest session key for this CID
    const session = db
      .prepare(
        `SELECT session_key FROM vatsim_track
         WHERE cid = ? ORDER BY recorded_at DESC LIMIT 1`,
      )
      .get(cid) as { session_key: string } | undefined;

    if (!session) return [];

    const rows = db
      .prepare(
        `SELECT lat, lon, altitude_ft
         FROM vatsim_track
         WHERE session_key = ?
         ORDER BY recorded_at ASC`,
      )
      .all(session.session_key) as {
        lat: number;
        lon: number;
        altitude_ft: number;
      }[];

    return rows.map((r) => ({
      lat: r.lat,
      lon: r.lon,
      alt: r.altitude_ft,
    }));
  }

  /**
   * Delete rows older than 24h and prune stale throttle entries.
   */
  cleanup(): number {
    const cutoff = Date.now() - RETENTION_MS;

    const result = getDb()
      .prepare('DELETE FROM vatsim_track WHERE recorded_at < ?')
      .run(cutoff);

    // Prune stale throttle state (older than retention)
    for (const [key, entry] of lastInserts) {
      if (entry.at < cutoff) lastInserts.delete(key);
    }

    return result.changes;
  }
}
