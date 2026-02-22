// ─── Telemetry Track Types ────────────────────────────────────

/** Single point in a pilot's telemetry track */
export interface TrackPoint {
  lat: number;
  lon: number;
  altitudeFt: number;
  heading: number;
  speedKts: number;
  vsFpm: number;
  recordedAt: number; // Unix timestamp ms
}

/** Full track for a flight (bid) */
export interface PilotTrack {
  bidId: number;
  pilotId: number;
  points: TrackPoint[];
}
