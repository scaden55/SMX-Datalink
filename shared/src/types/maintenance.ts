// ─── Type Unions ───────────────────────────────────────────

export type MaintenanceCheckType = 'A' | 'B' | 'C' | 'D';
export type MaintenanceLogType = 'A' | 'B' | 'C' | 'D' | 'LINE' | 'UNSCHEDULED' | 'AD' | 'MEL' | 'SFP';
export type MaintenanceLogStatus = 'scheduled' | 'in_progress' | 'completed' | 'deferred';
export type ADComplianceStatus = 'open' | 'complied' | 'recurring' | 'not_applicable';
export type MELCategory = 'A' | 'B' | 'C' | 'D';
export type MELStatus = 'open' | 'rectified' | 'expired';
export type ComponentType = 'ENGINE' | 'APU' | 'LANDING_GEAR' | 'PROP' | 'AVIONICS' | 'OTHER';
export type ComponentStatus = 'installed' | 'removed' | 'in_shop' | 'scrapped';

// ─── Core Interfaces ──────────────────────────────────────

export interface AircraftHours {
  aircraftId: number;
  totalHours: number;
  totalCycles: number;
  hoursAtLastA: number;
  hoursAtLastB: number;
  hoursAtLastC: number;
  cyclesAtLastC: number;
  lastDCheckDate: string | null;
  hoursAtLastD: number;
  updatedAt: string;
}

export interface MaintenanceCheckSchedule {
  id: number;
  icaoType: string;
  checkType: MaintenanceCheckType;
  intervalHours: number | null;
  intervalCycles: number | null;
  intervalMonths: number | null;
  overflightPct: number;
  estimatedDurationHours: number | null;
  description: string | null;
}

export interface MaintenanceLogEntry {
  id: number;
  aircraftId: number;
  aircraftRegistration?: string; // joined from fleet
  checkType: MaintenanceLogType;
  title: string;
  description: string | null;
  performedBy: string | null;
  performedAt: string | null;
  hoursAtCheck: number | null;
  cyclesAtCheck: number | null;
  cost: number | null;
  status: MaintenanceLogStatus;
  sfpDestination: string | null;
  sfpExpiry: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AirworthinessDirective {
  id: number;
  aircraftId: number;
  aircraftRegistration?: string; // joined from fleet
  adNumber: string;
  title: string;
  description: string | null;
  complianceStatus: ADComplianceStatus;
  complianceDate: string | null;
  complianceMethod: string | null;
  recurringIntervalHours: number | null;
  nextDueHours: number | null;
  nextDueDate: string | null;
  source: string | null;
  federalRegisterUrl: string | null;
  applicability: string | null;
  complianceSummary: string | null;
  complianceNotes: string | null;
  needsReview: boolean;
  classificationReason: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MELDeferral {
  id: number;
  aircraftId: number;
  aircraftRegistration?: string; // joined from fleet
  itemNumber: string;
  title: string;
  category: MELCategory;
  deferralDate: string;
  expiryDate: string;
  rectifiedDate: string | null;
  status: MELStatus;
  remarks: string | null;
  createdBy: number | null;
  createdAt: string;
  discrepancyId?: number | null;
  melMasterId?: number | null;
  ataChapter?: string | null;
  placardInfo?: string | null;
  operationsProcedure?: string | null;
  maintenanceProcedure?: string | null;
  authorizedBy?: number | null;
}

export interface AircraftComponent {
  id: number;
  aircraftId: number;
  aircraftRegistration?: string; // joined from fleet
  componentType: ComponentType;
  position: string | null;
  serialNumber: string | null;
  partNumber: string | null;
  hoursSinceNew: number;
  cyclesSinceNew: number;
  hoursSinceOverhaul: number;
  cyclesSinceOverhaul: number;
  overhaulIntervalHours: number | null;
  lastOverhaulDate: string | null;
  installedDate: string | null;
  status: ComponentStatus;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Fleet Status (joined view) ──────────────────────────

export interface CheckDueStatus {
  checkType: MaintenanceCheckType;
  dueAtHours: number | null;
  dueAtCycles: number | null;
  dueAtDate: string | null;
  currentHours: number;
  currentCycles: number;
  isOverdue: boolean;
  isInOverflight: boolean;
  remainingHours: number | null;
  remainingCycles: number | null;
  overflightPct: number;
  estimatedCost?: number;
}

export interface FleetMaintenanceStatus {
  aircraftId: number;
  registration: string;
  icaoType: string;
  name: string;
  status: string; // fleet status: 'active' | 'maintenance' | 'stored' | 'retired'
  totalHours: number;
  totalCycles: number;
  checksDue: CheckDueStatus[];
  hasOverdueChecks: boolean;
  hasOverdueADs: boolean;
  hasExpiredMEL: boolean;
  openDiscrepancies: number;
  activeMELs: number;
  nextCheckType: string | null;
  nextCheckDueIn: number | null; // remaining hours to next check
  maintenanceReserveBalance?: number;
  reserveRatePerHour?: number;
}

// ─── Request Types ────────────────────────────────────────

export interface CreateMaintenanceLogRequest {
  aircraftId: number;
  checkType: MaintenanceLogType;
  title: string;
  description?: string;
  performedBy?: string;
  performedAt?: string;
  hoursAtCheck?: number;
  cyclesAtCheck?: number;
  cost?: number;
  status?: MaintenanceLogStatus;
  sfpDestination?: string;
  sfpExpiry?: string;
}

export interface UpdateMaintenanceLogRequest {
  checkType?: MaintenanceLogType;
  title?: string;
  description?: string;
  performedBy?: string;
  performedAt?: string;
  hoursAtCheck?: number;
  cyclesAtCheck?: number;
  cost?: number;
  status?: MaintenanceLogStatus;
  sfpDestination?: string;
  sfpExpiry?: string;
}

export interface CreateCheckScheduleRequest {
  icaoType: string;
  checkType: MaintenanceCheckType;
  intervalHours?: number;
  intervalCycles?: number;
  intervalMonths?: number;
  overflightPct?: number;
  estimatedDurationHours?: number;
  description?: string;
}

export interface UpdateCheckScheduleRequest {
  intervalHours?: number;
  intervalCycles?: number;
  intervalMonths?: number;
  overflightPct?: number;
  estimatedDurationHours?: number;
  description?: string;
}

export interface CreateADRequest {
  aircraftId: number;
  adNumber: string;
  title: string;
  description?: string;
  complianceStatus?: ADComplianceStatus;
  complianceDate?: string;
  complianceMethod?: string;
  recurringIntervalHours?: number;
  nextDueHours?: number;
  nextDueDate?: string;
}

export interface UpdateADRequest {
  adNumber?: string;
  title?: string;
  description?: string;
  complianceStatus?: ADComplianceStatus;
  complianceDate?: string;
  complianceMethod?: string;
  recurringIntervalHours?: number;
  nextDueHours?: number;
  nextDueDate?: string;
}

export interface CreateMELRequest {
  aircraftId: number;
  itemNumber: string;
  title: string;
  category: MELCategory;
  deferralDate: string;
  expiryDate: string;
  remarks?: string;
}

export interface UpdateMELRequest {
  itemNumber?: string;
  title?: string;
  category?: MELCategory;
  deferralDate?: string;
  expiryDate?: string;
  rectifiedDate?: string;
  status?: MELStatus;
  remarks?: string;
}

export interface CreateComponentRequest {
  aircraftId: number;
  componentType: ComponentType;
  position?: string;
  serialNumber?: string;
  partNumber?: string;
  hoursSinceNew?: number;
  cyclesSinceNew?: number;
  hoursSinceOverhaul?: number;
  cyclesSinceOverhaul?: number;
  overhaulIntervalHours?: number;
  installedDate?: string;
  status?: ComponentStatus;
  remarks?: string;
}

export interface UpdateComponentRequest {
  componentType?: ComponentType;
  position?: string;
  serialNumber?: string;
  partNumber?: string;
  hoursSinceNew?: number;
  cyclesSinceNew?: number;
  hoursSinceOverhaul?: number;
  cyclesSinceOverhaul?: number;
  overhaulIntervalHours?: number;
  installedDate?: string;
  status?: ComponentStatus;
  remarks?: string;
}

export interface AdjustHoursRequest {
  totalHours?: number;
  totalCycles?: number;
  reason: string;
}

// ─── Response Types ───────────────────────────────────────

export interface MaintenanceLogListResponse {
  entries: MaintenanceLogEntry[];
  total: number;
}

export interface ADListResponse {
  directives: AirworthinessDirective[];
  total: number;
}

export interface MELListResponse {
  deferrals: MELDeferral[];
  total: number;
}
