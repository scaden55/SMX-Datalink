// ── Admin Panel Types ────────────────────────────────────────────

import type { UserRole, UserStatus } from './auth.js';
import type { LogbookStatus } from './logbook.js';

// Re-export UserStatus for backwards compatibility
export type { UserStatus } from './auth.js';

// ── User Management ─────────────────────────────────────────────

export interface AdminUserProfile {
  id: number;
  email: string;
  callsign: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  rank: string;
  hoursTotal: number;
  status: UserStatus;
  lastLogin: string | null;
  forcePasswordReset: boolean;
  simbriefUsername: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  callsign?: string;
  role?: UserRole;
  rank?: string;
  status?: UserStatus;
  forcePasswordReset?: boolean;
  password?: string;
}

export interface AdminUserListResponse {
  users: AdminUserProfile[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminUserFilters {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
}

// ── Audit Log ───────────────────────────────────────────────────

export interface AuditLogEntry {
  id: number;
  actorId: number | null;
  actorCallsign: string | null;
  actorName: string | null;
  action: string;
  targetType: string;
  targetId: number | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditLogListResponse {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditLogFilters {
  actorId?: number;
  action?: string;
  targetType?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ── VA Settings ─────────────────────────────────────────────────

export interface VaSetting {
  key: string;
  value: string;
  updatedBy: number | null;
  updatedAt: string;
}

export interface VaSettingsResponse {
  settings: VaSetting[];
}

export interface UpdateSettingsRequest {
  settings: { key: string; value: string }[];
}

// ── Finances ────────────────────────────────────────────────────

export type FinanceType = 'pay' | 'bonus' | 'deduction' | 'expense' | 'income';

export interface FinanceEntry {
  id: number;
  pilotId: number;
  pilotCallsign: string;
  pilotName: string;
  pirepId: number | null;
  type: FinanceType;
  amount: number;
  description: string | null;
  createdBy: number | null;
  creatorCallsign: string | null;
  createdAt: string;
}

export interface FinanceListResponse {
  entries: FinanceEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateFinanceRequest {
  pilotId: number;
  type: FinanceType;
  amount: number;
  description?: string;
}

export interface FinanceFilters {
  pilotId?: number;
  type?: FinanceType;
  dateFrom?: string;
  dateTo?: string;
}

export interface PilotBalance {
  pilotId: number;
  callsign: string;
  pilotName: string;
  balance: number;
  totalPay: number;
  totalBonuses: number;
  totalDeductions: number;
}

export interface FinanceSummary {
  totalPay: number;
  totalBonuses: number;
  totalDeductions: number;
  totalExpenses: number;
  totalIncome: number;
  netTotal: number;
}

// ── Notifications ───────────────────────────────────────────────

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: number;
  userId: number;
  message: string;
  type: NotificationType;
  read: boolean;
  link: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  unreadCount: number;
}

// ── PIREP Review ────────────────────────────────────────────────

export interface PirepReviewRequest {
  status: 'approved' | 'rejected';
  notes?: string;
}

export interface BulkPirepReviewRequest {
  ids: number[];
  status: 'approved' | 'rejected';
  notes?: string;
}

// ── Schedule Admin ──────────────────────────────────────────────

export interface CreateScheduleRequest {
  flightNumber: string;
  depIcao: string;
  arrIcao: string;
  aircraftType: string;
  depTime: string;
  arrTime: string;
  distanceNm: number;
  flightTimeMin: number;
  daysOfWeek: string;
  isActive?: boolean;
}

export interface UpdateScheduleRequest {
  flightNumber?: string;
  depIcao?: string;
  arrIcao?: string;
  aircraftType?: string;
  depTime?: string;
  arrTime?: string;
  distanceNm?: number;
  flightTimeMin?: number;
  daysOfWeek?: string;
  isActive?: boolean;
}

// ── Admin Dashboard ─────────────────────────────────────────────

export interface AdminDashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalFlights: number;
  pendingPireps: number;
  totalRevenue: number;
  totalFleetAircraft: number;
  activeRoutes: number;
}
