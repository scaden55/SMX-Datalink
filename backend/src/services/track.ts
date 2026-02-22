import { getDb } from '../db/index.js';
import type { TrackPoint } from '@acars/shared';

// ── Throttle state per pilot ─────────────────────────────────

interface LastInsert {
  at: number;
  lat: number;
  lon: number;
}

const lastInserts = new Map<number, LastInsert>();

const MIN_INTERVAL_MS = 3000;   // At least 3 seconds between inserts
const MIN_DISTANCE_DEG = 0.001; // ~111 meters — skip if not moved

// ── Track Service ────────────────────────────────────────────

export class TrackService {
  private insertStmt = () =>
    getDb().prepare(
      `INSERT INTO telemetry_track (pilot_id, bid_id, lat, lon, altitude_ft, heading, speed_kts, vs_fpm, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

  /**
   * Append a track point with throttling.
   * Only inserts if 3s elapsed OR aircraft moved > 0.001 deg.
   */
  record(
    pilotId: number,
    bidId: number,
    lat: number,
    lon: number,
    altitudeFt: number,
    heading: number,
    speedKts: number,
    vsFpm: number,
  ): boolean {
    const now = Date.now();
    const last = lastInserts.get(pilotId);

    if (last) {
      const elapsed = now - last.at;
      const moved =
        Math.abs(lat - last.lat) > MIN_DISTANCE_DEG ||
        Math.abs(lon - last.lon) > MIN_DISTANCE_DEG;

      if (elapsed < MIN_INTERVAL_MS && !moved) {
        return false; // throttled
      }
    }

    this.insertStmt().run(
      pilotId, bidId, lat, lon,
      Math.round(altitudeFt),
      Math.round(heading),
      Math.round(speedKts),
      Math.round(vsFpm),
      now,
    );

    lastInserts.set(pilotId, { at: now, lat, lon });
    return true;
  }

  /** Fetch all track points for a bid, ordered chronologically */
  getTrack(bidId: number): TrackPoint[] {
    const rows = getDb()
      .prepare(
        `SELECT lat, lon, altitude_ft, heading, speed_kts, vs_fpm, recorded_at
         FROM telemetry_track WHERE bid_id = ? ORDER BY recorded_at ASC`,
      )
      .all(bidId) as {
        lat: number;
        lon: number;
        altitude_ft: number;
        heading: number | null;
        speed_kts: number | null;
        vs_fpm: number | null;
        recorded_at: number;
      }[];

    return rows.map((r) => ({
      lat: r.lat,
      lon: r.lon,
      altitudeFt: r.altitude_ft,
      heading: r.heading ?? 0,
      speedKts: r.speed_kts ?? 0,
      vsFpm: r.vs_fpm ?? 0,
      recordedAt: r.recorded_at,
    }));
  }

  /** Delete track rows older than 30 days */
  cleanup(): number {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const result = getDb()
      .prepare('DELETE FROM telemetry_track WHERE recorded_at < ?')
      .run(cutoff);
    return result.changes;
  }
}
