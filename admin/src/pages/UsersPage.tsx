import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/widgets/StatCard';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

// ── Skeleton ────────────────────────────────────────────────────

function UsersPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[110px] rounded-md" />
        ))}
      </div>
      <Skeleton className="h-10 w-full rounded-md" />
      <Skeleton className="h-[400px] rounded-md" />
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

  // ── Render ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">Users</h1>
        <UsersPageSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">Users</h1>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Users</h1>

      <div className="space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Users"
            value={stats.total}
            icon={<Users size={22} weight="duotone" />}
          />
          <StatCard
            title="Active Pilots"
            value={stats.active}
            icon={<UserCircle size={22} weight="duotone" />}
          />
          <StatCard
            title="Admins"
            value={stats.admins}
            icon={<Shield size={22} weight="duotone" />}
          />
          <StatCard
            title="Dispatchers"
            value={stats.dispatchers}
            icon={<Headset size={22} weight="duotone" />}
          />
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-3">
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
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} weight="bold" />
            Add User
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Callsign</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-[110px]">Role</TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-mono font-medium">
                      {user.callsign}
                    </TableCell>
                    <TableCell>
                      {user.firstName} {user.lastName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell>{roleBadge(user.role)}</TableCell>
                    <TableCell>{statusBadge(user.status)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <DotsThreeVertical size={16} weight="bold" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditUser(user)}>
                            <PencilSimple size={14} />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {user.status === 'active' ? (
                            <DropdownMenuItem onClick={() => handleSuspend(user)}>
                              <Prohibit size={14} />
                              Suspend
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleReactivate(user)}>
                              <ArrowCounterClockwise size={14} />
                              Reactivate
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-400 focus:text-red-400"
                            onClick={() => setDeleteUser(user)}
                          >
                            <Trash size={14} />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
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
        onOpenChange={(open) => { if (!open) setEditUser(null); }}
        onUpdated={fetchUsers}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteUser} onOpenChange={(open) => { if (!open) setDeleteUser(null); }}>
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
    </div>
  );
}
