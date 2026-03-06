import { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  Send,
  ChevronLeft,
  ChevronRight,
  Users,
  CircleUser,
  Shield,
  Search,
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { Surface, SectionHeader, StatusBadge } from '@/components/primitives';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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

// ── Types ───────────────────────────────────────────────────────

type NotificationType = 'info' | 'success' | 'warning' | 'error';
type TargetType = 'all' | 'user' | 'role';

interface AdminNotification {
  id: number;
  type: NotificationType;
  message: string;
  targetType: TargetType;
  targetId: string | null;
  createdBy: number | null;
  createdByCallsign: string | null;
  createdAt: string;
  recipientCount: number;
}

interface NotificationListResponse {
  notifications: AdminNotification[];
  total: number;
  page: number;
  pageSize: number;
}

interface UserSearchResult {
  id: number;
  callsign: string;
  firstName: string;
  lastName: string;
}

// ── Helpers ─────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function targetLabel(targetType: TargetType, targetId: string | null): string {
  switch (targetType) {
    case 'all':
      return 'All Pilots';
    case 'user':
      return `User #${targetId}`;
    case 'role':
      return `Role: ${targetId}`;
    default:
      return targetType;
  }
}

// ── Skeleton ────────────────────────────────────────────────────

function NotificationsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-[280px] rounded-md bg-[var(--surface-2)] animate-pulse" />
      <div className="h-[400px] rounded-md bg-[var(--surface-2)] animate-pulse" />
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────

export function NotificationsPage() {
  // Compose form state
  const [composeType, setComposeType] = useState<NotificationType>('info');
  const [composeMessage, setComposeMessage] = useState('');
  const [composeTarget, setComposeTarget] = useState<TargetType>('all');
  const [composeRole, setComposeRole] = useState('pilot');
  const [composeUserId, setComposeUserId] = useState<number | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // History state
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);

  // ── Fetch History ─────────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      const res = await api.get<NotificationListResponse>(
        `/api/admin/notifications?${params.toString()}`
      );
      setNotifications(res.notifications);
      setTotal(res.total);
      setError(null);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load notifications';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ── User Search ───────────────────────────────────────────────

  useEffect(() => {
    if (composeTarget !== 'user' || userSearch.length < 2) {
      setUserResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setUserSearchLoading(true);
      try {
        const res = await api.get<{ users: UserSearchResult[] }>(
          `/api/admin/users?pageSize=10&search=${encodeURIComponent(userSearch)}`
        );
        setUserResults(res.users);
      } catch {
        setUserResults([]);
      } finally {
        setUserSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [userSearch, composeTarget]);

  // ── Send ──────────────────────────────────────────────────────

  async function handleSend() {
    if (!composeMessage.trim()) {
      toast.warning('Please enter a message');
      return;
    }

    if (composeTarget === 'user' && !composeUserId) {
      toast.warning('Please select a user');
      return;
    }

    setSending(true);
    try {
      let targetId: string | number | null = null;
      if (composeTarget === 'user') targetId = composeUserId;
      if (composeTarget === 'role') targetId = composeRole;

      await api.post('/api/admin/notifications', {
        type: composeType,
        message: composeMessage.trim(),
        targetType: composeTarget,
        targetId,
      });

      toast.success('Notification sent successfully');
      setComposeMessage('');
      setComposeUserId(null);
      setUserSearch('');
      setPage(1);
      fetchNotifications();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to send notification');
    } finally {
      setSending(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-6">Notifications</h1>
        <NotificationsPageSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-6">Notifications</h1>

      <div className="space-y-6">
        {/* ── Compose Section ─────────────────────────────────── */}
        <Surface elevation={1}>
          <SectionHeader
            title="Compose Notification"
            action={
              <span className="flex items-center gap-1 text-[var(--text-tertiary)]">
                <Send size={14} />
                Send to pilots, dispatchers, or specific users
              </span>
            }
          />
          <div className="space-y-4">
            {/* Type selector */}
            <div className="space-y-2">
              <Label className="text-[var(--text-secondary)]">Type</Label>
              <div className="flex gap-2">
                {(['info', 'success', 'warning', 'error'] as NotificationType[]).map((t) => (
                  <Button
                    key={t}
                    variant={composeType === t ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setComposeType(t)}
                    className={
                      composeType === t
                        ? t === 'info'
                          ? 'bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/80'
                          : t === 'success'
                            ? 'bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald)]/80'
                            : t === 'warning'
                              ? 'bg-[var(--accent-amber)] hover:bg-[var(--accent-amber)]/80'
                              : 'bg-[var(--accent-red)] hover:bg-[var(--accent-red)]/80'
                        : 'border-[var(--border-secondary)] text-[var(--text-secondary)]'
                    }
                  >
                    {t === 'info' && <Info size={14} />}
                    {t === 'success' && <CheckCircle2 size={14} />}
                    {t === 'warning' && <AlertTriangle size={14} />}
                    {t === 'error' && <AlertCircle size={14} />}
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="notif-message" className="text-[var(--text-secondary)]">Message</Label>
              <Textarea
                id="notif-message"
                placeholder="Type your notification message..."
                value={composeMessage}
                onChange={(e) => setComposeMessage(e.target.value)}
                rows={3}
                className="resize-none bg-[var(--surface-3)] border-[var(--border-secondary)] text-[var(--text-primary)]"
              />
            </div>

            {/* Target */}
            <div className="space-y-2">
              <Label className="text-[var(--text-secondary)]">Target</Label>
              <div className="flex items-center gap-3">
                <Select
                  value={composeTarget}
                  onValueChange={(v) => {
                    setComposeTarget(v as TargetType);
                    setComposeUserId(null);
                    setUserSearch('');
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <span className="flex items-center gap-2">
                        <Users size={14} />
                        All Pilots
                      </span>
                    </SelectItem>
                    <SelectItem value="user">
                      <span className="flex items-center gap-2">
                        <CircleUser size={14} />
                        Specific User
                      </span>
                    </SelectItem>
                    <SelectItem value="role">
                      <span className="flex items-center gap-2">
                        <Shield size={14} />
                        By Role
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* Role sub-selector */}
                {composeTarget === 'role' && (
                  <Select value={composeRole} onValueChange={setComposeRole}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pilot">Pilot</SelectItem>
                      <SelectItem value="dispatcher">Dispatcher</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {/* User search */}
                {composeTarget === 'user' && (
                  <div className="relative flex-1 max-w-sm">
                    <Search
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
                    />
                    <Input
                      placeholder="Search by callsign or name..."
                      value={userSearch}
                      onChange={(e) => {
                        setUserSearch(e.target.value);
                        setComposeUserId(null);
                      }}
                      className="pl-9 bg-[var(--surface-3)] border-[var(--border-secondary)] text-[var(--text-primary)]"
                    />
                    {/* Dropdown results */}
                    {userSearch.length >= 2 && !composeUserId && (
                      <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border border-[var(--border-primary)] bg-[var(--surface-3)] shadow-md max-h-48 overflow-auto">
                        {userSearchLoading ? (
                          <div className="px-3 py-2 text-sm text-[var(--text-tertiary)]">
                            Searching...
                          </div>
                        ) : userResults.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-[var(--text-tertiary)]">
                            No users found
                          </div>
                        ) : (
                          userResults.map((u) => (
                            <button
                              key={u.id}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--surface-2)] text-left"
                              onClick={() => {
                                setComposeUserId(u.id);
                                setUserSearch(`${u.callsign} - ${u.firstName} ${u.lastName}`);
                                setUserResults([]);
                              }}
                            >
                              <CircleUser size={16} className="text-[var(--text-tertiary)]" />
                              <span className="font-mono font-medium text-[var(--text-primary)]">{u.callsign}</span>
                              <span className="text-[var(--text-tertiary)]">
                                {u.firstName} {u.lastName}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Send button */}
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSend}
                disabled={sending || !composeMessage.trim()}
                className="bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/80"
              >
                <Send size={16} />
                {sending ? 'Sending...' : 'Send Notification'}
              </Button>
            </div>
          </div>
        </Surface>

        {/* ── History Section ─────────────────────────────────── */}
        <Surface elevation={1}>
          <SectionHeader
            title="Notification History"
            count={total}
            action={
              <span className="flex items-center gap-1 text-[var(--text-tertiary)]">
                <Bell size={14} />
                Previously sent notifications
              </span>
            }
          />
          <div className="space-y-4">
            {error ? (
              <div className="flex items-center justify-center py-10 text-[var(--text-tertiary)]">
                <p>{error}</p>
              </div>
            ) : (
              <>
                <div className="rounded-md border border-[var(--border-primary)]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-[var(--border-primary)] hover:bg-transparent">
                        <TableHead className="w-[160px] text-[var(--text-tertiary)]">Date</TableHead>
                        <TableHead className="w-[100px] text-[var(--text-tertiary)]">Type</TableHead>
                        <TableHead className="text-[var(--text-tertiary)]">Message</TableHead>
                        <TableHead className="w-[130px] text-[var(--text-tertiary)]">Target</TableHead>
                        <TableHead className="w-[120px] text-[var(--text-tertiary)]">Sent By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notifications.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-center py-10 text-[var(--text-tertiary)]"
                          >
                            No notifications sent yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        notifications.map((notif) => (
                          <TableRow key={notif.id} className="border-b border-[var(--border-primary)] hover:bg-[var(--surface-3)]">
                            <TableCell className="font-mono text-xs text-[var(--text-tertiary)]">
                              {formatDate(notif.createdAt)}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={notif.type} />
                            </TableCell>
                            <TableCell className="max-w-[400px] truncate text-[var(--text-primary)]">
                              {notif.message}
                            </TableCell>
                            <TableCell className="text-sm text-[var(--text-secondary)]">
                              {targetLabel(notif.targetType, notif.targetId)}
                            </TableCell>
                            <TableCell className="font-mono text-sm text-[var(--text-secondary)]">
                              {notif.createdByCallsign ?? 'System'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-2">
                    <p className="text-sm text-[var(--text-tertiary)]">
                      Showing {(page - 1) * pageSize + 1}-
                      {Math.min(page * pageSize, total)} of {total}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 border-[var(--border-secondary)]"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        <ChevronLeft size={14} />
                      </Button>
                      <span className="text-sm text-[var(--text-tertiary)]">
                        Page {page} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 border-[var(--border-secondary)]"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        <ChevronRight size={14} />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Surface>
      </div>
    </div>
  );
}
