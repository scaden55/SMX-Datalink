// ─── Type Unions ───────────────────────────────────────────

export type DiscrepancySeverity = 'grounding' | 'non_grounding';
export type DiscrepancyStatus = 'open' | 'in_review' | 'deferred' | 'resolved' | 'grounded';
export type ResolutionType = 'corrected' | 'deferred_mel' | 'grounded';
export type TimelineEntryType = 'discrepancy' | 'mel_deferral' | 'maintenance' | 'ad_compliance';

// ─── Core Interfaces ──────────────────────────────────────

export interface ATAChapter {
  chapter: string;
  title: string;
  description: string | null;
}

export interface Discrepancy {
  id: number;
  aircraftId: number;
  aircraftRegistration?: string;
  flightNumber: string | null;
  logbookEntryId: number | null;
  reportedBy: number;
  reportedByName?: string;
  reportedAt: string;
  ataChapter: string;
  ataChapterTitle?: string;
  description: string;
  flightPhase: string | null;
  severity: DiscrepancySeverity;
  status: DiscrepancyStatus;
  resolvedBy: number | null;
  resolvedByName?: string;
  resolvedAt: string | null;
  resolutionType: ResolutionType | null;
  correctiveAction: string | null;
  melDeferralId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MelMasterItem {
  id: number;
  icaoType: string;
  ataChapter: string;
  ataChapterTitle?: string;
  itemNumber: string;
  title: string;
  description: string | null;
  category: 'A' | 'B' | 'C' | 'D';
  repairIntervalDays: number | null;
  remarks: string | null;
  operationsProcedure: string | null;
  maintenanceProcedure: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEntry {
  type: TimelineEntryType;
  id: number;
  date: string;
  title: string;
  description: string;
  status: string;
  ataChapter?: string;
  metadata?: Record<string, unknown>;
}

// ─── Request Types ────────────────────────────────────────

export interface CreateDiscrepancyRequest {
  aircraftId: number;
  flightNumber?: string;
  ataChapter: string;
  description: string;
  flightPhase?: string;
  severity: DiscrepancySeverity;
}

export interface ResolveDiscrepancyRequest {
  correctiveAction: string;
  createMaintenanceLog?: boolean;
}

export interface DeferDiscrepancyRequest {
  melMasterId: number;
  placardInfo?: string;
  remarks?: string;
  operationsProcedure?: string;
  maintenanceProcedure?: string;
}

export interface CreateMelMasterRequest {
  icaoType: string;
  ataChapter: string;
  itemNumber: string;
  title: string;
  description?: string;
  category: 'A' | 'B' | 'C' | 'D';
  repairIntervalDays?: number;
  remarks?: string;
  operationsProcedure?: string;
  maintenanceProcedure?: string;
}

export interface UpdateMelMasterRequest {
  ataChapter?: string;
  itemNumber?: string;
  title?: string;
  description?: string;
  category?: 'A' | 'B' | 'C' | 'D';
  repairIntervalDays?: number;
  remarks?: string;
  operationsProcedure?: string;
  maintenanceProcedure?: string;
  isActive?: boolean;
}

// ─── Response Types ───────────────────────────────────────

export interface DiscrepancyListResponse {
  discrepancies: Discrepancy[];
  total: number;
}

export interface DiscrepancyStatsResponse {
  open: number;
  inReview: number;
  deferred: number;
  resolved30d: number;
}

export interface MelStatsResponse {
  active: number;
  expiring48h: number;
  catAB: number;
  catCD: number;
  rectified30d: number;
}

export interface TimelineResponse {
  entries: TimelineEntry[];
  total: number;
}

export interface MelBriefingResponse {
  aircraftId: number;
  registration: string;
  activeMels: Array<{
    id: number;
    itemNumber: string;
    title: string;
    category: string;
    ataChapter: string;
    ataChapterTitle: string;
    deferralDate: string;
    expiryDate: string;
    placardInfo: string | null;
    operationsProcedure: string | null;
    remarks: string | null;
  }>;
}
