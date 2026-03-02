import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Users,
  UserCircle,
  Shield,
  Headset,
  MagnifyingGlass,
  DotsThreeVertical,
  PencilSimple,
  Prohibit,
  ArrowCounterClockwise,
  Trash,
  Plus,
} from '@phosphor-icons/react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { PageShell } from '@/components/shared/PageShell';
import { DataTable } from '@/components/shared/DataTable';
import { DataTableColumnHeader } from '@/components/shared/DataTableColumnHeader';
import { DetailPanel } from '@/components/shared/DetailPanel';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function roleBadge(role: UserRole) {
  switch (role) {
    case 'admin':
      return (
        <Badge className="bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/20">
          Admin
        </Badge>
      );
    case 'dispatcher':
      return (
        <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/20">
          Dispatcher
        </Badge>
      );
    case 'pilot':
      return (
        <Badge variant="secondary">
          Pilot
        </Badge>
      );
  }
}

function statusBadge(status: UserStatus) {
  switch (status) {
    case 'active':
      return (
        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
          Active
        </Badge>
      );
    case 'suspended':
      return (
        <Badge className="bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/20">
          Suspended
        </Badge>
      );
    case 'deleted':
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Deleted
        </Badge>
      );
  }
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-right">{children}</span>
    </div>
  );
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

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUserProfile | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUserProfile | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Detail panel
  const [detailUser, setDetailUser] = useState<AdminUserProfile | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // ── Fetch ───────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get<AdminUserListResponse>('/api/admin/users?pageSize=100');
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

  // Keep detail panel in sync when users list refreshes
  useEffect(() => {
    if (detailUser) {
      const updated = users.find((u) => u.id === detailUser.id);
      if (updated) {
        setDetailUser(updated);
      } else {
        setDetailUser(null);
        setDetailOpen(false);
      }
    }
  }, [users]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Stats ──────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === 'active' && u.role === 'pilot').length;
    const admins = users.filter((u) => u.role === 'admin').length;
    const dispatchers = users.filter((u) => u.role === 'dispatcher').length;
    return { total, active, admins, dispatchers };
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

  function handleRowClick(user: AdminUserProfile) {
    if (detailUser?.id === user.id) {
      setDetailOpen(false);
      setDetailUser(null);
    } else {
      setDetailUser(user);
      setDetailOpen(true);
    }
  }

  // ── Column Definitions ─────────────────────────────────────

  const columns: ColumnDef<AdminUserProfile, unknown>[] = useMemo(
    () => [
      {
        accessorKey: 'callsign',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Callsign" />,
        cell: ({ row }) => (
          <span className="font-mono font-medium">{row.original.callsign}</span>
        ),
        size: 120,
      },
      {
        id: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
        accessorFn: (row) => `${row.firstName} ${row.lastName}`,
        cell: ({ row }) => (
          <span>
            {row.original.firstName} {row.original.lastName}
          </span>
        ),
      },
      {
        accessorKey: 'email',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.email}</span>
        ),
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }) => roleBadge(row.original.role),
        enableSorting: false,
        size: 110,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => statusBadge(row.original.status),
        enableSorting: false,
        size: 110,
      },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        size: 50,
        cell: ({ row }) => {
          const user = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DotsThreeVertical size={16} weight="bold" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditUser(user)}>
                  <PencilSimple size={14} /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {user.status === 'active' ? (
                  <DropdownMenuItem onClick={() => handleSuspend(user)}>
                    <Prohibit size={14} /> Suspend
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => handleReactivate(user)}>
                    <ArrowCounterClockwise size={14} /> Reactivate
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-400 focus:text-red-400"
                  onClick={() => setDeleteUser(user)}
                >
                  <Trash size={14} /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Render ─────────────────────────────────────────────────

  if (error && !loading) {
    return (
      <PageShell title="Users" subtitle="Manage pilots, dispatchers, and admins">
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <p>{error}</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Users"
      subtitle="Manage pilots, dispatchers, and admins"
      stats={[
        {
          label: 'Total Users',
          value: stats.total,
          icon: <Users size={13} weight="duotone" />,
          color: 'blue',
        },
        {
          label: 'Active Pilots',
          value: stats.active,
          icon: <UserCircle size={13} weight="duotone" />,
          color: 'emerald',
        },
        {
          label: 'Admins',
          value: stats.admins,
          icon: <Shield size={13} weight="duotone" />,
          color: 'red',
        },
        {
          label: 'Dispatchers',
          value: stats.dispatchers,
          icon: <Headset size={13} weight="duotone" />,
          color: 'cyan',
        },
      ]}
      actions={
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} weight="bold" /> Add User
        </Button>
      }
    >
      {/* Toolbar: search + filters */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative max-w-sm flex-1">
          <MagnifyingGlass
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="dispatcher">Dispatcher</SelectItem>
            <SelectItem value="pilot">Pilot</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Split view: table + detail */}
      <div className="flex flex-1 gap-0 overflow-hidden rounded-md border border-border/50">
        <div
          className={`${detailOpen ? 'w-[55%]' : 'w-full'} flex flex-col transition-all duration-200`}
        >
          <DataTable
            columns={columns}
            data={filteredUsers}
            onRowClick={handleRowClick}
            selectedRowId={detailUser?.id}
            loading={loading}
            emptyMessage="No users found"
            getRowId={(row) => String(row.id)}
          />
        </div>
        {detailOpen && detailUser && (
          <DetailPanel
            open={detailOpen}
            onClose={() => {
              setDetailOpen(false);
              setDetailUser(null);
            }}
            title={detailUser.callsign}
            subtitle={`${detailUser.firstName} ${detailUser.lastName}`}
            actions={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setEditUser(detailUser)}
                >
                  <PencilSimple size={12} /> Edit
                </Button>
                {detailUser.status === 'active' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleSuspend(detailUser)}
                  >
                    <Prohibit size={12} /> Suspend
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleReactivate(detailUser)}
                  >
                    <ArrowCounterClockwise size={12} /> Reactivate
                  </Button>
                )}
              </>
            }
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <DetailRow label="Email">{detailUser.email}</DetailRow>
                <DetailRow label="Role">{roleBadge(detailUser.role)}</DetailRow>
                <DetailRow label="Status">{statusBadge(detailUser.status)}</DetailRow>
                <DetailRow label="Rank">{detailUser.rank}</DetailRow>
                <DetailRow label="Total Hours">
                  <span className="font-mono">{detailUser.hoursTotal.toFixed(1)}h</span>
                </DetailRow>
                <DetailRow label="Last Login">
                  {detailUser.lastLogin ? formatDate(detailUser.lastLogin) : 'Never'}
                </DetailRow>
                <DetailRow label="Joined">{formatDate(detailUser.createdAt)}</DetailRow>
                {detailUser.simbriefUsername && (
                  <DetailRow label="SimBrief">{detailUser.simbriefUsername}</DetailRow>
                )}
              </div>
            </div>
          </DetailPanel>
        )}
      </div>

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
              <span className="font-semibold text-foreground">
                {deleteUser?.callsign}
              </span>
              ? This action cannot be undone and will remove all associated data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteUser(null)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
