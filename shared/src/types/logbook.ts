// ── Logbook / PIREP types ────────────────────────────────────────

export type LogbookStatus = 'pending' | 'approved' | 'completed' | 'diverted' | 'rejected' | 'cancelled';

export interface LogbookEntry {
  id: number;
  userId: number;
  flightNumber: string;
  depIcao: string;
  arrIcao: string;
  aircraftType: string;
  aircraftRegistration: string | null;
  scheduledDep: string | null;
  scheduledArr: string | null;
  actualDep: string;
  actualArr: string;
  flightTimeMin: number;
  distanceNm: number;
  fuelUsedLbs: number | null;
  fuelPlannedLbs: number | null;
  route: string | null;
  cruiseAltitude: string | null;
  paxCount: number;
  cargoLbs: number;
  landingRateFpm: number | null;
  score: number | null;
  status: LogbookStatus;
  remarks: string | null;
  createdAt: string;
  // Reviewer fields (always present in DB rows, null when not reviewed)
  reviewerId: number | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  reviewerCallsign: string | null;
  reviewerName: string | null;
  // Joined fields (from list queries)
  pilotCallsign?: string;
  pilotName?: string;
  depName?: string;
  arrName?: string;
}

export interface LogbookListResponse {
  entries: LogbookEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LogbookFilters {
  userId?: number;
  depIcao?: string;
  arrIcao?: string;
  aircraftType?: string;
  status?: LogbookStatus;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}
