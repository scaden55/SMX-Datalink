import { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  PaperPlaneTilt,
  CaretLeft,
  CaretRight,
  Users,
  UserCircle,
  Shield,
  MagnifyingGlass,
  Info,
  CheckCircle,
  Warning,
  WarningCircle,
} from '@phosphor-icons/react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

function typeBadge(type: NotificationType) {
  switch (type) {
    case 'info':
      return (
        <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/20">
          <Info size={12} weight="bold" className="mr-1" />
          Info
        </Badge>
      );
    case 'success':
      return (
        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
          <CheckCircle size={12} weight="bold" className="mr-1" />
          Success
        </Badge>
      );
    case 'warning':
      return (
        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/20">
          <Warning size={12} weight="bold" className="mr-1" />
          Warning
        </Badge>
      );
    case 'error':
      return (
        <Badge className="bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/20">
          <WarningCircle size={12} weight="bold" className="mr-1" />
          Error
        </Badge>
      );
  }
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
      <Skeleton className="h-[280px] rounded-md" />
      <Skeleton className="h-[400px] rounded-md" />
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
        <h1 className="text-2xl font-semibold mb-6">Notifications</h1>
        <NotificationsPageSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Notifications</h1>

      <div className="space-y-6">
        {/* ── Compose Section ─────────────────────────────────── */}
        <Card className="rounded-md border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PaperPlaneTilt size={20} weight="duotone" />
              Compose Notification
            </CardTitle>
            <CardDescription>
              Send a notification to pilots, dispatchers, or specific users
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Type selector */}
            <div className="space-y-2">
              <Label>Type</Label>
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
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : t === 'success'
                            ? 'bg-emerald-600 hover:bg-emerald-700'
                            : t === 'warning'
                              ? 'bg-amber-600 hover:bg-amber-700'
                              : 'bg-red-600 hover:bg-red-700'
                        : ''
                    }
                  >
                    {t === 'info' && <Info size={14} weight="bold" />}
                    {t === 'success' && <CheckCircle size={14} weight="bold" />}
                    {t === 'warning' && <Warning size={14} weight="bold" />}
                    {t === 'error' && <WarningCircle size={14} weight="bold" />}
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="notif-message">Message</Label>
              <Textarea
                id="notif-message"
                placeholder="Type your notification message..."
                value={composeMessage}
                onChange={(e) => setComposeMessage(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Target */}
            <div className="space-y-2">
              <Label>Target</Label>
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
                        <UserCircle size={14} />
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
                    <MagnifyingGlass
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      placeholder="Search by callsign or name..."
                      value={userSearch}
                      onChange={(e) => {
                        setUserSearch(e.target.value);
                        setComposeUserId(null);
                      }}
                      className="pl-9"
                    />
                    {/* Dropdown results */}
                    {userSearch.length >= 2 && !composeUserId && (
                      <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover shadow-md max-h-48 overflow-auto">
                        {userSearchLoading ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">
                            Searching...
                          </div>
                        ) : userResults.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">
                            No users found
                          </div>
                        ) : (
                          userResults.map((u) => (
                            <button
                              key={u.id}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50 text-left"
                              onClick={() => {
                                setComposeUserId(u.id);
                                setUserSearch(`${u.callsign} - ${u.firstName} ${u.lastName}`);
                                setUserResults([]);
                              }}
                            >
                              <UserCircle size={16} className="text-muted-foreground" />
                              <span className="font-mono font-medium">{u.callsign}</span>
                              <span className="text-muted-foreground">
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
              >
                <PaperPlaneTilt size={16} weight="bold" />
                {sending ? 'Sending...' : 'Send Notification'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── History Section ─────────────────────────────────── */}
        <Card className="rounded-md border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell size={20} weight="duotone" />
              Notification History
            </CardTitle>
            <CardDescription>
              Previously sent notifications ({total} total)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <p>{error}</p>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[160px]">Date</TableHead>
                        <TableHead className="w-[100px]">Type</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead className="w-[130px]">Target</TableHead>
                        <TableHead className="w-[120px]">Sent By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notifications.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-center py-10 text-muted-foreground"
                          >
                            No notifications sent yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        notifications.map((notif) => (
                          <TableRow key={notif.id}>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {formatDate(notif.createdAt)}
                            </TableCell>
                            <TableCell>{typeBadge(notif.type)}</TableCell>
                            <TableCell className="max-w-[400px] truncate">
                              {notif.message}
                            </TableCell>
                            <TableCell className="text-sm">
                              {targetLabel(notif.targetType, notif.targetId)}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
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
                    <p className="text-sm text-muted-foreground">
                      Showing {(page - 1) * pageSize + 1}-
                      {Math.min(page * pageSize, total)} of {total}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        <CaretLeft size={14} />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {page} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        <CaretRight size={14} />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
