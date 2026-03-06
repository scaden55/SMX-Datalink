import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Users,
  Search,
  MoreVertical,
  Pencil,
  Ban,
  RotateCcw,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import {
  pageVariants,
  staggerContainer,
  staggerItem,
  fadeUp,
  tableContainer,
  tableRow,
  cardHover,
} from '@/lib/motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CreateUserDialog } from '@/components/dialogs/CreateUserDialog';
import { EditUserDialog } from '@/components/dialogs/EditUserDialog';

// ── Types ───────────────────────────────────────────────────────

type UserRole = 'admin' | 'dispatcher' | 'pilot';
type UserStatus = 'active' | 'suspended' | 'deleted';

interface AdminUserProfile {
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

interface AdminUserListResponse {
  users: AdminUserProfile[];
  total: number;
  page: number;
  pageSize: number;
}

// ── Helpers ─────────────────────────────────────────────────────

function roleBadge(role: UserRole) {
  switch (role) {
    case 'admin':
      return { bg: 'var(--accent-red-bg)', color: 'var(--accent-red)', label: 'Admin' };
    case 'dispatcher':
      return { bg: 'var(--accent-blue-bg)', color: 'var(--accent-blue-bright)', label: 'Dispatcher' };
    case 'pilot':
      return { bg: 'var(--accent-emerald-bg)', color: 'var(--accent-emerald)', label: 'Pilot' };
    default:
      return { bg: 'var(--surface-3)', color: 'var(--text-tertiary)', label: role };
  }
}

function avatarBg(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'var(--accent-red)';
    case 'dispatcher':
      return 'var(--accent-blue)';
    case 'pilot':
      return 'var(--accent-emerald)';
    default:
      return 'var(--text-tertiary)';
  }
}

function initials(firstName: string, lastName: string): string {
  return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
}

// ── Page ────────────────────────────────────────────────────────

export function UsersPage() {
  const [users, setUsers] = useState<AdminUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUserProfile | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUserProfile | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Fetch ───────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get<AdminUserListResponse>('/api/admin/users?pageSize=500');
      setUsers(res.users);
      setError(null);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load users';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ── Filtered list ──────────────────────────────────────────

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const match =
          u.callsign.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.firstName.toLowerCase().includes(q) ||
          u.lastName.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [users, roleFilter, statusFilter, search]);

  // ── Pagination ────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, page, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter]);

  // ── Stats ──────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = users.length;
    const pilots = users.filter((u) => u.role === 'pilot').length;
    const admins = users.filter((u) => u.role === 'admin').length;
    const dispatchers = users.filter((u) => u.role === 'dispatcher').length;
    return { total, pilots, admins, dispatchers };
  }, [users]);

  // ── Actions ────────────────────────────────────────────────

  async function handleSuspend(user: AdminUserProfile) {
    try {
      await api.post(`/api/admin/users/${user.id}/suspend`);
      toast.success(`${user.callsign} suspended`);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to suspend user');
    }
  }

  async function handleReactivate(user: AdminUserProfile) {
    try {
      await api.post(`/api/admin/users/${user.id}/reactivate`);
      toast.success(`${user.callsign} reactivated`);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to reactivate user');
    }
  }

  async function handleDelete() {
    if (!deleteUser) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/admin/users/${deleteUser.id}`);
      toast.success(`${deleteUser.callsign} deleted`);
      setDeleteUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete user');
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────

  if (error && !loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex flex-col" style={{ padding: '16px 24px', gap: 16 }}>
          <div className="flex items-center" style={{ gap: 12 }}>
            <Users size={20} style={{ color: 'var(--accent-blue)' }} />
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Users</span>
          </div>
        </div>
        <div className="flex items-center justify-center flex-1" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <motion.div className="flex flex-col h-full" variants={pageVariants} initial="hidden" animate="visible">
      {/* Header */}
      <motion.div className="flex flex-col" style={{ padding: '16px 24px', gap: 16 }} variants={fadeUp}>
        {/* Title row */}
        <div className="flex items-center" style={{ gap: 12 }}>
          <Users size={20} style={{ color: 'var(--accent-blue)' }} />
          <div className="flex flex-col" style={{ gap: 2 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Users</span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Manage pilots, dispatchers, and administrators</span>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center btn-glow"
            style={{
              gap: 6,
              padding: '8px 16px',
              borderRadius: 6,
              backgroundColor: 'var(--accent-blue)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Plus size={14} />
            Add User
          </button>
        </div>

        {/* Stat cards */}
        <motion.div className="flex" style={{ gap: 12 }} variants={staggerContainer} initial="hidden" animate="visible">
          <motion.div className="flex-1" variants={staggerItem}>
            <StatCard label="Total Users" value={stats.total} />
          </motion.div>
          <motion.div className="flex-1" variants={staggerItem}>
            <StatCard label="Pilots" value={stats.pilots} />
          </motion.div>
          <motion.div className="flex-1" variants={staggerItem}>
            <StatCard label="Dispatchers" value={stats.dispatchers} color="var(--accent-blue-bright)" />
          </motion.div>
          <motion.div className="flex-1" variants={staggerItem}>
            <StatCard label="Admins" value={stats.admins} color="var(--accent-amber)" />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Filter Bar */}
      <div
        className="flex items-center"
        style={{
          padding: '12px 24px',
          gap: 10,
          borderBottom: '1px solid var(--border-primary)',
        }}
      >
        {/* Search */}
        <div
          className="flex items-center"
          style={{
            gap: 8,
            padding: '8px 12px',
            borderRadius: 6,
            backgroundColor: 'var(--input-bg)',
            border: '1px solid var(--input-border)',
            width: 220,
          }}
        >
          <Search size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none flex-1 input-glow"
            style={{ fontSize: 12, color: 'var(--text-primary)' }}
          />
        </div>

        {/* Role filter */}
        <SelectDropdown
          value={roleFilter}
          onChange={setRoleFilter}
          options={[
            { value: 'all', label: 'All Roles' },
            { value: 'admin', label: 'Admin' },
            { value: 'dispatcher', label: 'Dispatcher' },
            { value: 'pilot', label: 'Pilot' },
          ]}
        />

        {/* Status filter */}
        <SelectDropdown
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All Status' },
            { value: 'active', label: 'Active' },
            { value: 'suspended', label: 'Suspended' },
          ]}
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Loading users...
          </div>
        ) : paginatedUsers.length === 0 ? (
          <div className="flex items-center justify-center h-full" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            No users found
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                {['NAME', 'EMAIL', 'CALLSIGN', 'ROLE', 'HOURS', 'FLIGHTS', 'STATUS', ''].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '8px 16px',
                      textAlign: 'left',
                      fontSize: 10,
                      fontWeight: 600,
                      color: 'var(--text-quaternary)',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase' as const,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <motion.tbody variants={tableContainer} initial="hidden" animate="visible">
              {paginatedUsers.map((user) => {
                const role = roleBadge(user.role);
                const isActive = user.status === 'active';

                return (
                  <motion.tr
                    key={user.id}
                    variants={tableRow}
                    style={{ borderBottom: '1px solid var(--border-primary)' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-2)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    {/* Avatar + Name */}
                    <td style={{ padding: '10px 16px' }}>
                      <div className="flex items-center" style={{ gap: 10 }}>
                        <div
                          className="flex items-center justify-center"
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            backgroundColor: avatarBg(user.role),
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#fff',
                            flexShrink: 0,
                          }}
                        >
                          {initials(user.firstName, user.lastName)}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {user.firstName} {user.lastName}
                        </span>
                      </div>
                    </td>

                    {/* Email */}
                    <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--text-secondary)' }}>
                      {user.email}
                    </td>

                    {/* Callsign */}
                    <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {user.callsign}
                    </td>

                    {/* Role badge */}
                    <td style={{ padding: '10px 16px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 3,
                          fontSize: 10,
                          fontWeight: 600,
                          backgroundColor: role.bg,
                          color: role.color,
                        }}
                      >
                        {role.label}
                      </span>
                    </td>

                    {/* Hours */}
                    <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {user.hoursTotal.toFixed(1)}
                    </td>

                    {/* Flights placeholder — not in the data model, show dash */}
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                      —
                    </td>

                    {/* Status badge */}
                    <td style={{ padding: '10px 16px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 3,
                          fontSize: 10,
                          fontWeight: 600,
                          backgroundColor: isActive ? 'var(--accent-emerald-bg)' : 'var(--surface-3)',
                          color: isActive ? 'var(--accent-emerald)' : 'var(--text-tertiary)',
                        }}
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '10px 16px' }}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="flex items-center justify-center"
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 4,
                              border: 'none',
                              backgroundColor: 'transparent',
                              color: 'var(--text-tertiary)',
                              cursor: 'pointer',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical size={14} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditUser(user)}>
                            <Pencil size={14} /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {user.status === 'active' ? (
                            <DropdownMenuItem onClick={() => handleSuspend(user)}>
                              <Ban size={14} /> Suspend
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleReactivate(user)}>
                              <RotateCcw size={14} /> Reactivate
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-[var(--accent-red)] focus:text-[var(--accent-red)]"
                            onClick={() => setDeleteUser(user)}
                          >
                            <Trash2 size={14} /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </motion.tr>
                );
              })}
            </motion.tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && filteredUsers.length > pageSize && (
        <div
          className="flex items-center justify-between"
          style={{
            padding: '10px 24px',
            borderTop: '1px solid var(--border-primary)',
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredUsers.length)} of {filteredUsers.length}
          </span>
          <div className="flex items-center" style={{ gap: 4 }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="flex items-center justify-center"
              style={{
                width: 28,
                height: 28,
                borderRadius: 4,
                border: '1px solid var(--border-primary)',
                backgroundColor: 'transparent',
                color: page <= 1 ? 'var(--text-quaternary)' : 'var(--text-secondary)',
                cursor: page <= 1 ? 'default' : 'pointer',
                opacity: page <= 1 ? 0.5 : 1,
              }}
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className="flex items-center justify-center"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 4,
                  border: p === page ? '1px solid var(--accent-blue)' : '1px solid transparent',
                  backgroundColor: p === page ? 'var(--accent-blue-bg)' : 'transparent',
                  color: p === page ? 'var(--accent-blue-bright)' : 'var(--text-tertiary)',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {p}
              </button>
            ))}
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="flex items-center justify-center"
              style={{
                width: 28,
                height: 28,
                borderRadius: 4,
                border: '1px solid var(--border-primary)',
                backgroundColor: 'transparent',
                color: page >= totalPages ? 'var(--text-quaternary)' : 'var(--text-secondary)',
                cursor: page >= totalPages ? 'default' : 'pointer',
                opacity: page >= totalPages ? 0.5 : 1,
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Create User Dialog */}
      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={fetchUsers}
      />

      {/* Edit User Dialog */}
      <EditUserDialog
        user={editUser}
        open={!!editUser}
        onOpenChange={(open) => {
          if (!open) setEditUser(null);
        }}
        onUpdated={fetchUsers}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteUser}
        onOpenChange={(open) => {
          if (!open) setDeleteUser(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{' '}
              <span className="font-semibold text-[var(--text-primary)]">
                {deleteUser?.callsign}
              </span>
              ? This action cannot be undone and will remove all associated data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setDeleteUser(null)}
              disabled={deleteLoading}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid var(--border-primary)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteLoading}
              className="btn-glow"
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: 'var(--accent-red)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                opacity: deleteLoading ? 0.6 : 1,
              }}
            >
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ── Stat Card ────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div
      className="flex flex-col flex-1"
      style={{
        padding: '12px 16px',
        gap: 4,
        borderRadius: 6,
        backgroundColor: 'var(--surface-2)',
        border: '1px solid var(--border-primary)',
      }}
    >
      <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, color: color ?? 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

// ── Select Dropdown ──────────────────────────────────────────────

function SelectDropdown({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '8px 12px',
        borderRadius: 6,
        backgroundColor: 'var(--input-bg)',
        border: '1px solid var(--input-border)',
        color: 'var(--text-primary)',
        fontSize: 12,
        outline: 'none',
        cursor: 'pointer',
        appearance: 'auto',
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
