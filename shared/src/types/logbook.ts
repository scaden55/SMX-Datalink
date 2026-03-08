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
  landingGForce: number | null;
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
  // VATSIM tracking
  vatsimConnected: boolean;
  vatsimCallsign: string | null;
  vatsimCid: number | null;
  // OOOI timestamps (null for pre-OOOI entries)
  oooiOut: string | null;
  oooiOff: string | null;
  oooiOn: string | null;
  oooiIn: string | null;
  blockTimeMin: number | null; // calculated: IN - OUT
  // Cargo manifest linkage
  cargoManifestId?: number;
  cargoWeightKg?: number;
  cargoUldCount?: number;
  cargoNotocRequired?: boolean;
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
  vatsimOnly?: boolean;
}
