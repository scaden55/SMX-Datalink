export type ExceedanceType =
  | 'HARD_LANDING'
  | 'OVERSPEED'
  | 'OVERWEIGHT_LANDING'
  | 'UNSTABLE_APPROACH'
  | 'TAILSTRIKE';

export type ExceedanceSeverity = 'warning' | 'critical';

/** Payload sent from Electron → backend via Socket.io */
export interface ExceedanceEvent {
  type: ExceedanceType;
  severity: ExceedanceSeverity;
  value: number;
  threshold: number;
  unit: string;       // fpm | kts | lbs | deg
  phase: string;      // flight phase at detection
  message: string;    // human-readable description
  detectedAt: string; // ISO 8601 UTC
}

/** Stored exceedance record (includes DB identity fields) */
export interface FlightExceedance extends ExceedanceEvent {
  id: number;
  bidId: number;
  logbookId: number | null;
  pilotId: number;
}
