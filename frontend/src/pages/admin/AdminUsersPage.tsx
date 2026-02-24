import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Pencil,
  UserX,
  UserCheck,
  Eye,
  Trash2,
  X,
  Loader2,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { AdminTable, type ColumnDef } from '../../components/admin/AdminTable';
import { StatusBadge } from '../../components/admin/StatusBadge';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { useAdminStore } from '../../stores/adminStore';
import type {
  UserRole,
  AdminUserProfile,
  AdminUserListResponse,
  CreateUserRequest,
  UpdateUserRequest,
  UserStatus,
} from '@acars/shared';

// ── Status badge configs ────────────────────────────────────────

const ROLE_BADGE_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  admin:      { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-500' },
  dispatcher: { bg: 'bg-blue-500/10',  text: 'text-blue-400',  dot: 'bg-blue-500' },
  pilot:      { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500' },
};

const STATUS_BADGE_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  active:    { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  suspended: { bg: 'bg-red-500/10',   text: 'text-red-400',   dot: 'bg-red-500' },
  deleted:   { bg: 'bg-gray-500/10',    text: 'text-gray-400',    dot: 'bg-gray-400' },
};

// ── Constants ───────────────────────────────────────────────────

const PAGE_SIZE = 25;

const INPUT_CLS = 'input-field text-xs';

const SELECT_CLS = 'select-field';

// ── Helpers ─────────────────────────────────────────────────────

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) +
    'z'
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let pw = '';
  for (let i = 0; i < 14; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)];
  }
  return pw;
}

// ── Form types ──────────────────────────────────────────────────

interface UserFormData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  callsign: string;
  role: UserRole;
  rank: string;
}

const EMPTY_FORM: UserFormData = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  callsign: '',
  role: 'pilot',
  rank: '',
};

// ── Confirm action types ────────────────────────────────────────

type ConfirmActionType = 'suspend' | 'reactivate' | 'delete' | 'impersonate';

interface ConfirmState {
  type: ConfirmActionType;
  user: AdminUserProfile;
}

// ── UserFormModal ───────────────────────────────────────────────

function UserFormModal({
  open,
  mode,
  initial,
  loading,
  error,
  onSubmit,
  onClose,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  initial: UserFormData;
  loading: boolean;
  error: string;
  onSubmit: (data: UserFormData) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<UserFormData>(initial);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setForm(initial);
    setCopied(false);
  }, [initial, open]);

  if (!open) return null;

  const update = (patch: Partial<UserFormData>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleGenerate = () => {
    update({ password: generatePassword() });
    setCopied(false);
  };

  const handleCopyPassword = async () => {
    if (!form.password) return;
    try {
      await navigator.clipboard.writeText(form.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may not be available
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={loading ? undefined : onClose} />
      <div className="relative w-full max-w-lg mx-4 rounded-md border border-acars-border bg-acars-panel shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-acars-border">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-blue-500/10">
              {mode === 'create' ? (
                <Plus className="w-4 h-4 text-blue-400" />
              ) : (
                <Pencil className="w-4 h-4 text-blue-400" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-acars-text">
                {mode === 'create' ? 'Create New User' : 'Edit User'}
              </h3>
              <p className="text-[10px] text-acars-muted">
                {mode === 'create' ? 'Add a new pilot or staff account' : 'Update account details'}
              </p>
            </div>
          </div>
          <button onClick={onClose} disabled={loading} className="text-acars-muted hover:text-acars-text p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-md border border-red-400/30 bg-red-500/5 text-[11px] text-red-400">
              {error}
            </div>
          )}

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-acars-muted mb-1.5">
                First Name
              </label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => update({ firstName: e.target.value })}
                className={INPUT_CLS}
                placeholder="John"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-acars-muted mb-1.5">
                Last Name
              </label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => update({ lastName: e.target.value })}
                className={INPUT_CLS}
                placeholder="Doe"
                required
              />
            </div>
          </div>

          {/* Callsign (edit only) */}
          {mode === 'edit' && (
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-acars-muted mb-1.5">Callsign</label>
              <input
                type="text"
                value={form.callsign}
                onChange={(e) => update({ callsign: e.target.value.toUpperCase() })}
                className={`${INPUT_CLS} font-mono`}
                placeholder="SMA-001"
              />
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-acars-muted mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update({ email: e.target.value })}
              className={INPUT_CLS}
              placeholder="pilot@smavirtual.com"
              required={mode === 'create'}
              disabled={mode === 'edit'}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-acars-muted mb-1.5">
              Password{' '}
              {mode === 'edit' && (
                <span className="normal-case text-acars-muted/60">(leave blank to keep unchanged)</span>
              )}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.password}
                onChange={(e) => update({ password: e.target.value })}
                className={`${INPUT_CLS} font-mono`}
                placeholder={mode === 'edit' ? 'Leave blank to keep current' : 'Enter password'}
                required={mode === 'create'}
              />
              <button
                type="button"
                onClick={handleGenerate}
                title="Generate random password"
                className="btn-secondary btn-sm shrink-0 px-2.5 py-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleCopyPassword}
                title="Copy password"
                disabled={!form.password}
                className="btn-secondary btn-sm shrink-0 px-2.5 py-2 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Role and Rank */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-acars-muted mb-1.5">Role</label>
              <select
                value={form.role}
                onChange={(e) => update({ role: e.target.value as UserRole })}
                className={`${SELECT_CLS} w-full`}
              >
                <option value="pilot">Pilot</option>
                <option value="dispatcher">Dispatcher</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-acars-muted mb-1.5">
                Rank <span className="text-acars-muted/40 normal-case">(optional)</span>
              </label>
              <input
                type="text"
                value={form.rank}
                onChange={(e) => update({ rank: e.target.value })}
                className={INPUT_CLS}
                placeholder="First Officer"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-secondary btn-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-500/80 rounded-md transition-colors disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3 h-3 animate-spin" />}
              {mode === 'create' ? 'Create User' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── AdminUsersPage ──────────────────────────────────────────────

export function AdminUsersPage() {
  // ── Data state ──────────────────────────────────────────────
  const [users, setUsers] = useState<AdminUserProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Filter state ────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');

  // ── Stats state (fetched independently from filters) ────────
  const [statCounts, setStatCounts] = useState({
    total: 0,
    active: 0,
    suspended: 0,
    admins: 0,
  });

  // ── Modal state ─────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalInitial, setModalInitial] = useState<UserFormData>(EMPTY_FORM);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  // ── Confirm dialog state ────────────────────────────────────
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // ── Admin store ─────────────────────────────────────────────
  const startImpersonation = useAdminStore((s) => s.startImpersonation);

  // ── Search debounce ─────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ── Fetch users ─────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (roleFilter) params.set('role', roleFilter);
      if (statusFilter) params.set('status', statusFilter);

      const data = await api.get<AdminUserListResponse>(`/api/admin/users?${params}`);
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ── Fetch global stats ──────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const [allRes, activeRes, suspendedRes, adminRes] = await Promise.all([
        api.get<AdminUserListResponse>('/api/admin/users?pageSize=1'),
        api.get<AdminUserListResponse>('/api/admin/users?status=active&pageSize=1'),
        api.get<AdminUserListResponse>('/api/admin/users?status=suspended&pageSize=1'),
        api.get<AdminUserListResponse>('/api/admin/users?role=admin&pageSize=1'),
      ]);
      setStatCounts({
        total: allRes.total,
        active: activeRes.total,
        suspended: suspendedRes.total,
        admins: adminRes.total,
      });
    } catch {
      // Stats are non-critical; degrade gracefully
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // ── Refresh both data and stats ─────────────────────────────
  const refreshAll = useCallback(() => {
    fetchUsers();
    fetchStats();
  }, [fetchUsers, fetchStats]);

  // ── CRUD: Create ────────────────────────────────────────────
  const openCreateModal = () => {
    setModalMode('create');
    setModalInitial(EMPTY_FORM);
    setEditingUserId(null);
    setModalError('');
    setModalOpen(true);
  };

  // ── CRUD: Edit ──────────────────────────────────────────────
  const openEditModal = (user: AdminUserProfile) => {
    setModalMode('edit');
    setModalInitial({
      email: user.email,
      password: '',
      firstName: user.firstName,
      lastName: user.lastName,
      callsign: user.callsign,
      role: user.role,
      rank: user.rank ?? '',
    });
    setEditingUserId(user.id);
    setModalError('');
    setModalOpen(true);
  };

  const handleFormSubmit = async (data: UserFormData) => {
    setModalLoading(true);
    setModalError('');
    try {
      if (modalMode === 'create') {
        const body: CreateUserRequest = {
          email: data.email.trim(),
          password: data.password,
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          role: data.role,
          rank: data.rank.trim() || undefined,
        };
        await api.post<AdminUserProfile>('/api/admin/users', body);
      } else if (editingUserId) {
        const body: UpdateUserRequest = {
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          callsign: data.callsign.trim() || undefined,
          role: data.role,
          rank: data.rank.trim() || undefined,
        };
        if (data.password) {
          body.password = data.password;
        }
        await api.patch<AdminUserProfile>(`/api/admin/users/${editingUserId}`, body);
      }
      setModalOpen(false);
      refreshAll();
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Operation failed');
    } finally {
      setModalLoading(false);
    }
  };

  // ── Confirm actions ─────────────────────────────────────────
  const handleConfirm = async () => {
    if (!confirmState) return;
    setConfirmLoading(true);
    try {
      switch (confirmState.type) {
        case 'suspend':
          await api.post(`/api/admin/users/${confirmState.user.id}/suspend`);
          break;
        case 'reactivate':
          await api.post(`/api/admin/users/${confirmState.user.id}/reactivate`);
          break;
        case 'delete':
          await api.delete(`/api/admin/users/${confirmState.user.id}`);
          break;
        case 'impersonate':
          await startImpersonation(confirmState.user.id);
          // Page will redirect after impersonation
          return;
      }
      setConfirmState(null);
      refreshAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed');
      setConfirmState(null);
    } finally {
      setConfirmLoading(false);
    }
  };

  const confirmDialogProps = useMemo(() => {
    if (!confirmState) return null;
    const { firstName, lastName, callsign } = confirmState.user;
    const name = `${firstName} ${lastName}`;

    switch (confirmState.type) {
      case 'suspend':
        return {
          title: 'Suspend User',
          message: `Are you sure you want to suspend ${name} (${callsign})? They will be unable to log in or file PIREPs.`,
          variant: 'warning' as const,
          confirmLabel: 'Suspend User',
        };
      case 'reactivate':
        return {
          title: 'Reactivate User',
          message: `Reactivate ${name} (${callsign})? They will regain full access to their account.`,
          variant: 'default' as const,
          confirmLabel: 'Reactivate',
        };
      case 'delete':
        return {
          title: 'Delete User',
          message: `Permanently delete ${name} (${callsign})? This will remove all their data including login credentials, logbook entries, and flight records. This action cannot be undone.`,
          variant: 'danger' as const,
          confirmLabel: 'Delete User',
        };
      case 'impersonate':
        return {
          title: 'Impersonate User',
          message: `You will be logged in as ${name} (${callsign}). You can return to your admin account from the admin bar.`,
          variant: 'default' as const,
          confirmLabel: 'Impersonate',
        };
    }
  }, [confirmState]);

  // ── Table columns ───────────────────────────────────────────
  const columns: ColumnDef<AdminUserProfile>[] = useMemo(
    () => [
      {
        key: 'callsign',
        header: 'Callsign',
        sortable: true,
        width: '100px',
        render: (row) => <span className="font-mono font-semibold text-blue-400">{row.callsign}</span>,
      },
      {
        key: 'name',
        header: 'Name',
        sortable: true,
        render: (row) => (
          <div className="flex flex-col">
            <span className="text-acars-text font-medium">
              {row.firstName} {row.lastName}
            </span>
            {row.rank && <span className="text-[10px] text-acars-muted">{row.rank}</span>}
          </div>
        ),
      },
      {
        key: 'email',
        header: 'Email',
        sortable: true,
        render: (row) => <span className="text-acars-muted">{row.email}</span>,
      },
      {
        key: 'role',
        header: 'Role',
        sortable: true,
        width: '120px',
        render: (row) => <StatusBadge status={row.role} config={ROLE_BADGE_CONFIG} />,
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        width: '110px',
        render: (row) => <StatusBadge status={row.status} config={STATUS_BADGE_CONFIG} />,
      },
      {
        key: 'lastLogin',
        header: 'Last Login',
        sortable: true,
        width: '140px',
        render: (row) => <span className="text-acars-muted text-[11px]">{formatDateTime(row.lastLogin)}</span>,
      },
      {
        key: 'hours',
        header: 'Hours',
        sortable: true,
        width: '80px',
        render: (row) => <span className="font-mono text-acars-text">{row.hoursTotal.toFixed(1)}h</span>,
      },
      {
        key: 'createdAt',
        header: 'Joined',
        sortable: true,
        width: '110px',
        render: (row) => <span className="text-acars-muted text-[11px]">{formatDate(row.createdAt)}</span>,
      },
      {
        key: 'actions',
        header: 'Actions',
        width: '160px',
        render: (row) => (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => openEditModal(row)}
              title="Edit user"
              className="p-1.5 rounded text-acars-muted hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>

            {row.status === 'active' ? (
              <button
                onClick={() => setConfirmState({ type: 'suspend', user: row })}
                title="Suspend user"
                className="p-1.5 rounded text-acars-muted hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
              >
                <UserX className="w-3.5 h-3.5" />
              </button>
            ) : row.status === 'suspended' ? (
              <button
                onClick={() => setConfirmState({ type: 'reactivate', user: row })}
                title="Reactivate user"
                className="p-1.5 rounded text-acars-muted hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5" />
              </button>
            ) : null}

            {row.status !== 'deleted' && (
              <button
                onClick={() => setConfirmState({ type: 'impersonate', user: row })}
                title="Impersonate user"
                className="p-1.5 rounded text-acars-muted hover:text-acars-text hover:bg-acars-hover transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            )}

            {row.status !== 'deleted' && (
              <button
                onClick={() => setConfirmState({ type: 'delete', user: row })}
                title="Delete user"
                className="p-1.5 rounded text-acars-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ),
      },
    ],
    [],
  );

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5 max-w-[1440px]">
      {/* ── Header + Stats ───────────────────────────────── */}
      <AdminPageHeader
        icon={Users}
        title="User Management"
        subtitle="Manage pilot accounts, roles, and status"
        stats={[
          { label: 'Total Users', value: statCounts.total, color: 'text-acars-text' },
          { label: 'Active', value: statCounts.active, color: 'text-emerald-400' },
          { label: 'Suspended', value: statCounts.suspended, color: 'text-red-400' },
          { label: 'Admins', value: statCounts.admins, color: 'text-amber-400' },
        ]}
        actions={
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-500/80 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Create User
          </button>
        }
      />

      {/* ── Error banner ─────────────────────────────────── */}
      {error && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-md border border-red-400/30 bg-red-500/5 text-xs text-red-400">
          <span>{error}</span>
          <button onClick={() => setError('')} className="p-0.5 hover:text-white transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Filter bar ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-acars-muted pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search callsign, name, email..."
            className={`${INPUT_CLS} pl-9 font-mono`}
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value as UserRole | '');
            setPage(1);
          }}
          className={SELECT_CLS}
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="dispatcher">Dispatcher</option>
          <option value="pilot">Pilot</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as UserStatus | '');
            setPage(1);
          }}
          className={SELECT_CLS}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* ── Users table ──────────────────────────────────── */}
      <AdminTable<AdminUserProfile>
        columns={columns}
        data={users}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        loading={loading}
        getRowId={(row) => row.id}
        emptyMessage="No users found matching your filters."
      />

      {/* ── Create / Edit Modal ──────────────────────────── */}
      <UserFormModal
        open={modalOpen}
        mode={modalMode}
        initial={modalInitial}
        loading={modalLoading}
        error={modalError}
        onSubmit={handleFormSubmit}
        onClose={() => setModalOpen(false)}
      />

      {/* ── Confirm Dialog ───────────────────────────────── */}
      {confirmDialogProps && (
        <ConfirmDialog
          open={!!confirmState}
          title={confirmDialogProps.title}
          message={confirmDialogProps.message}
          variant={confirmDialogProps.variant}
          confirmLabel={confirmDialogProps.confirmLabel}
          loading={confirmLoading}
          onConfirm={handleConfirm}
          onCancel={() => !confirmLoading && setConfirmState(null)}
        />
      )}
    </div>
  );
}
