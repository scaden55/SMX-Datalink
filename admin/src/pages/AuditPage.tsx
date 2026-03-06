import { useCallback, useEffect, useState } from 'react';
import {
  History,
  Search,
  Calendar,
  ChevronDown,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { StatusBadge } from '@/components/primitives';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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

interface AuditLogEntry {
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

interface AuditLogListResponse {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

// ── Constants ───────────────────────────────────────────────────

const ACTION_OPTIONS = [
  { value: 'all', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'filed', label: 'Filed' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'toggle', label: 'Toggle' },
  { value: 'clone', label: 'Clone' },
  { value: 'impersonate', label: 'Impersonate' },
];

const TARGET_TYPE_OPTIONS = [
  { value: 'all', label: 'All Targets' },
  { value: 'user', label: 'User' },
  { value: 'schedule', label: 'Schedule' },
  { value: 'pirep', label: 'PIREP' },
  { value: 'airport', label: 'Airport' },
  { value: 'finance', label: 'Finance' },
  { value: 'settings', label: 'Settings' },
  { value: 'aircraft', label: 'Aircraft' },
  { value: 'maintenance_log', label: 'Maintenance Log' },
  { value: 'maintenance_check', label: 'Maintenance Check' },
  { value: 'airworthiness_directive', label: 'AD' },
  { value: 'mel_deferral', label: 'MEL Deferral' },
  { value: 'aircraft_component', label: 'Component' },
];

// ── Helpers ─────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ' ' + d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/** Extract the verb from a dotted action like "user.create" -> "create" */
function extractVerb(action: string): string {
  const parts = action.split('.');
  return parts[parts.length - 1];
}

/** Map an action verb to a StatusBadge status key */
function actionToStatus(action: string): string {
  const verb = extractVerb(action);

  if (['create', 'filed', 'clone'].includes(verb)) return 'create';
  if (['update', 'toggle', 'toggleHub', 'adjust_hours', 'return_to_service', 'complete_check'].includes(verb)) return 'update';
  if (['delete'].includes(verb)) return 'delete';
  if (['approved'].includes(verb)) return 'approved';
  if (['rejected'].includes(verb)) return 'rejected';
  if (['impersonate'].includes(verb)) return 'impersonate';
  if (['login'].includes(verb)) return 'login';

  return 'info'; // fallback
}

function JsonViewer({ label, data }: { label: string; data: Record<string, unknown> | null }) {
  if (!data) return null;

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">{label}</p>
      <pre className="rounded-md bg-[var(--surface-0)] border border-[var(--border-primary)] p-3 text-xs font-mono text-[var(--text-secondary)] overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap break-words">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

// ── Skeleton ────────────────────────────────────────────────────

function AuditPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-full rounded-md bg-[var(--surface-2)] animate-pulse" />
      <div className="h-[500px] rounded-md bg-[var(--surface-2)] animate-pulse" />
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────

export function AuditPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Filters
  const [actorSearch, setActorSearch] = useState('');
  const [actorSearchDebounced, setActorSearchDebounced] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // ── Debounce actor search ────────────────────────────────────

  useEffect(() => {
    const timer = setTimeout(() => {
      setActorSearchDebounced(actorSearch);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [actorSearch]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [actionFilter, targetTypeFilter, dateFrom, dateTo]);

  // ── Fetch ────────────────────────────────────────────────────

  const fetchEntries = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('pageSize', pageSize.toString());

      // The backend filters by actorId (number), not search string.
      // We pass actorId only if user typed a numeric ID directly.
      // For callsign-based searching we'll filter client-side after fetch.
      if (actorSearchDebounced && /^\d+$/.test(actorSearchDebounced)) {
        params.set('actorId', actorSearchDebounced);
      }
      if (actionFilter !== 'all') {
        // The backend filters action by exact match; action values are like "user.create".
        // We match on the verb portion — pass as-is, backend does exact match on the full action string.
        // Since the backend does exact match and our dropdown uses verbs, we need partial matching.
        // The backend does `a.action = ?` so we send the full value. But verbs like "create" won't
        // match "user.create". We'll handle this with client-side post-filter instead.
        // Actually, let's just not send the action filter to backend if it's a verb fragment.
        // We'll filter client-side for flexibility.
      }
      if (targetTypeFilter !== 'all') {
        params.set('targetType', targetTypeFilter);
      }
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) {
        // Add time component to include the full end date
        params.set('dateTo', dateTo + 'T23:59:59');
      }

      const res = await api.get<AuditLogListResponse>(`/api/admin/audit?${params.toString()}`);

      // Client-side filter for action verb and actor callsign search
      let filtered = res.entries;

      if (actionFilter !== 'all') {
        filtered = filtered.filter((e) => extractVerb(e.action) === actionFilter);
      }

      if (actorSearchDebounced && !/^\d+$/.test(actorSearchDebounced)) {
        const q = actorSearchDebounced.toLowerCase();
        filtered = filtered.filter((e) =>
          (e.actorCallsign && e.actorCallsign.toLowerCase().includes(q)) ||
          (e.actorName && e.actorName.toLowerCase().includes(q))
        );
      }

      setEntries(filtered);
      setTotal(res.total);
      setError(null);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load audit log';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [page, actorSearchDebounced, actionFilter, targetTypeFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // ── Expand/Collapse ──────────────────────────────────────────

  function toggleExpand(id: number) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Clear Filters ────────────────────────────────────────────

  function clearFilters() {
    setActorSearch('');
    setActionFilter('all');
    setTargetTypeFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }

  const hasActiveFilters = actorSearch || actionFilter !== 'all' || targetTypeFilter !== 'all' || dateFrom || dateTo;

  // ── Pagination ───────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // ── Render ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-6">Audit Log</h1>
        <AuditPageSkeleton />
      </div>
    );
  }

  if (error && entries.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-6">Audit Log</h1>
        <div className="flex items-center justify-center py-20 text-[var(--text-tertiary)]">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <History size={28} className="text-[var(--text-tertiary)]" />
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Audit Log</h1>
      </div>

      <div className="space-y-6">
        {/* Toolbar / Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="relative max-w-xs flex-1 min-w-[200px]">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
            />
            <Input
              placeholder="Search by callsign or name..."
              value={actorSearch}
              onChange={(e) => setActorSearch(e.target.value)}
              className="pl-9 bg-[var(--surface-3)] border-[var(--border-secondary)] text-[var(--text-primary)]"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={targetTypeFilter} onValueChange={setTargetTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Target Type" />
            </SelectTrigger>
            <SelectContent>
              {TARGET_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-[var(--text-tertiary)] shrink-0" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[140px] bg-[var(--surface-3)] border-[var(--border-secondary)] text-[var(--text-primary)]"
              placeholder="From"
            />
            <span className="text-[var(--text-tertiary)] text-sm">-</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[140px] bg-[var(--surface-3)] border-[var(--border-secondary)] text-[var(--text-primary)]"
              placeholder="To"
            />
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-[var(--text-secondary)]">
              <Filter size={14} />
              Clear Filters
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-md border border-[var(--border-primary)]">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[var(--border-primary)] hover:bg-transparent">
                <TableHead className="w-[40px] text-[var(--text-tertiary)]" />
                <TableHead className="w-[170px] text-[var(--text-tertiary)]">Date / Time</TableHead>
                <TableHead className="w-[120px] text-[var(--text-tertiary)]">Actor</TableHead>
                <TableHead className="w-[180px] text-[var(--text-tertiary)]">Action</TableHead>
                <TableHead className="w-[150px] text-[var(--text-tertiary)]">Target Type</TableHead>
                <TableHead className="w-[90px] text-[var(--text-tertiary)]">Target ID</TableHead>
                <TableHead className="w-[110px] text-[var(--text-tertiary)]">IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16 text-[var(--text-tertiary)]">
                    <div className="flex flex-col items-center gap-2">
                      <History size={32} className="opacity-40" />
                      <p>No audit log entries found</p>
                      {hasActiveFilters && (
                        <p className="text-xs">Try adjusting your filters</p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => {
                  const isExpanded = expandedRows.has(entry.id);
                  const hasDetails = entry.beforeData !== null || entry.afterData !== null;

                  return (
                    <ExpandableRow
                      key={entry.id}
                      entry={entry}
                      isExpanded={isExpanded}
                      hasDetails={hasDetails}
                      onToggle={() => toggleExpand(entry.id)}
                    />
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--text-tertiary)]">
              Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, total)} of {total} entries
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="border-[var(--border-secondary)]"
              >
                Previous
              </Button>
              <div className="flex items-center gap-1 text-sm text-[var(--text-tertiary)]">
                Page {page} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="border-[var(--border-secondary)]"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Expandable Row ─────────────────────────────────────────────

function ExpandableRow({
  entry,
  isExpanded,
  hasDetails,
  onToggle,
}: {
  entry: AuditLogEntry;
  isExpanded: boolean;
  hasDetails: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow
        className={hasDetails ? 'cursor-pointer hover:bg-[var(--surface-3)] border-b border-[var(--border-primary)]' : 'border-b border-[var(--border-primary)]'}
        onClick={hasDetails ? onToggle : undefined}
      >
        <TableCell className="px-2">
          {hasDetails && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
              {isExpanded
                ? <ChevronDown size={14} />
                : <ChevronRight size={14} />
              }
            </Button>
          )}
        </TableCell>
        <TableCell className="font-mono text-xs text-[var(--text-tertiary)]">
          {formatDateTime(entry.createdAt)}
        </TableCell>
        <TableCell>
          {entry.actorCallsign ? (
            <span className="font-mono font-medium text-sm text-[var(--text-primary)]">{entry.actorCallsign}</span>
          ) : (
            <span className="text-[var(--text-tertiary)] text-sm italic">System</span>
          )}
        </TableCell>
        <TableCell>
          <StatusBadge status={actionToStatus(entry.action)} label={entry.action} />
        </TableCell>
        <TableCell>
          <StatusBadge status="info" label={entry.targetType} className="bg-[var(--surface-3)] text-[var(--text-tertiary)] ring-[var(--border-secondary)]" />
        </TableCell>
        <TableCell className="font-mono text-sm text-[var(--text-tertiary)]">
          {entry.targetId ?? '-'}
        </TableCell>
        <TableCell className="font-mono text-xs text-[var(--text-tertiary)]">
          {entry.ipAddress ?? '-'}
        </TableCell>
      </TableRow>
      {isExpanded && hasDetails && (
        <TableRow className="bg-[var(--surface-1)] hover:bg-[var(--surface-1)] border-b border-[var(--border-primary)]">
          <TableCell colSpan={7} className="p-0">
            <div className="px-6 py-4 space-y-3 border-l-2 border-[var(--accent-blue-ring)] ml-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <JsonViewer label="Before" data={entry.beforeData} />
                <JsonViewer label="After" data={entry.afterData} />
              </div>
              {entry.actorName && (
                <p className="text-xs text-[var(--text-tertiary)]">
                  Actor: {entry.actorName} {entry.actorCallsign && `(${entry.actorCallsign})`}
                </p>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
