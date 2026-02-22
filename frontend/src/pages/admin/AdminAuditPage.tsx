import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  ScrollText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronExpand,
  Loader2,
  Filter,
  Calendar,
} from 'lucide-react';
import { api } from '../../lib/api';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import type { AuditLogEntry, AuditLogListResponse } from '@acars/shared';

// ─── Constants ──────────────────────────────────────────────────

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'user.create', label: 'user.create' },
  { value: 'user.update', label: 'user.update' },
  { value: 'user.suspend', label: 'user.suspend' },
  { value: 'schedule.create', label: 'schedule.create' },
  { value: 'schedule.update', label: 'schedule.update' },
  { value: 'pirep.review', label: 'pirep.review' },
  { value: 'finance.create', label: 'finance.create' },
  { value: 'settings.update', label: 'settings.update' },
];

const TARGET_TYPE_OPTIONS = [
  { value: '', label: 'All Targets' },
  { value: 'user', label: 'user' },
  { value: 'schedule', label: 'schedule' },
  { value: 'pirep', label: 'pirep' },
  { value: 'finance', label: 'finance' },
  { value: 'settings', label: 'settings' },
];

// ─── Helpers ────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
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
  }) + 'z';
}

function getActionBadgeClasses(action: string): string {
  if (action.includes('.create')) {
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-400/20';
  }
  if (action.includes('.update')) {
    return 'bg-blue-500/10 text-blue-400 border-blue-400/20';
  }
  if (action.includes('.delete') || action.includes('.suspend')) {
    return 'bg-red-500/10 text-red-400 border-red-400/20';
  }
  if (action.includes('.review')) {
    return 'bg-amber-500/10 text-amber-400 border-amber-400/20';
  }
  return 'bg-acars-muted/10 text-acars-muted border-acars-border';
}

function formatJson(obj: Record<string, unknown> | null): string {
  if (!obj) return '—';
  return JSON.stringify(obj, null, 2);
}

// ─── ActionBadge ────────────────────────────────────────────────

function ActionBadge({ action }: { action: string }) {
  const classes = getActionBadgeClasses(action);
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${classes}`}
    >
      {action}
    </span>
  );
}

// ─── JSON Display ───────────────────────────────────────────────

function JsonBlock({ label, data }: { label: string; data: Record<string, unknown> | null }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] uppercase tracking-wider font-medium text-acars-muted mb-1.5">
        {label}
      </p>
      <pre className="bg-acars-bg rounded p-3 text-[11px] font-mono text-acars-muted overflow-x-auto whitespace-pre-wrap break-words">
        {data ? formatJson(data) : <span className="italic text-acars-muted/50">No data</span>}
      </pre>
    </div>
  );
}

// ─── AdminAuditPage ─────────────────────────────────────────────

export function AdminAuditPage() {
  // Data
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Expanded rows
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (actionFilter) params.set('action', actionFilter);
      if (targetTypeFilter) params.set('targetType', targetTypeFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const data = await api.get<AuditLogListResponse>(`/api/admin/audit?${params}`);
      setEntries(data.entries);
      setTotal(data.total);
    } catch (err: any) {
      setError(err?.message || 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, actionFilter, targetTypeFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function toggleExpand(id: number) {
    setExpandedId(prev => (prev === id ? null : id));
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex-none px-6 pt-6 pb-4">
        <AdminPageHeader
          icon={ScrollText}
          title="Audit Log"
          subtitle="Track all administrative actions"
        />
      </div>

      {/* ── Filters ────────────────────────────────────────────── */}
      <div className="flex-none px-6 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Action filter */}
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-acars-muted pointer-events-none" />
            <select
              value={actionFilter}
              onChange={e => { setActionFilter(e.target.value); setPage(1); }}
              className="select-field h-8 pl-7"
            >
              {ACTION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Target type filter */}
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-acars-muted pointer-events-none" />
            <select
              value={targetTypeFilter}
              onChange={e => { setTargetTypeFilter(e.target.value); setPage(1); }}
              className="select-field h-8 pl-7"
            >
              {TARGET_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Date from */}
          <div className="relative">
            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-acars-muted pointer-events-none" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              placeholder="From"
              className="input-field text-xs h-8 pl-7 pr-3 cursor-pointer [color-scheme:dark]"
            />
          </div>

          <span className="text-acars-muted text-xs">to</span>

          {/* Date to */}
          <div className="relative">
            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-acars-muted pointer-events-none" />
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1); }}
              placeholder="To"
              className="input-field text-xs h-8 pl-7 pr-3 cursor-pointer [color-scheme:dark]"
            />
          </div>

          {/* Clear filters */}
          {(actionFilter || targetTypeFilter || dateFrom || dateTo) && (
            <button
              onClick={() => {
                setActionFilter('');
                setTargetTypeFilter('');
                setDateFrom('');
                setDateTo('');
                setPage(1);
              }}
              className="btn-secondary btn-sm h-8"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64 text-sm text-red-400">
            {error}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <ScrollText className="w-10 h-10 text-acars-muted/30" />
            <p className="text-sm text-acars-muted">No audit log entries found</p>
          </div>
        ) : (
          <div className="panel overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-acars-bg border-b border-acars-border">
                <tr>
                  <th className="w-8 px-3 py-2.5" />
                  <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider font-medium text-acars-muted">
                    Timestamp
                  </th>
                  <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider font-medium text-acars-muted">
                    Actor
                  </th>
                  <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider font-medium text-acars-muted">
                    Action
                  </th>
                  <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider font-medium text-acars-muted">
                    Target Type
                  </th>
                  <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider font-medium text-acars-muted">
                    Target ID
                  </th>
                  <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider font-medium text-acars-muted">
                    IP Address
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => {
                  const isExpanded = expandedId === entry.id;
                  const hasDetails = entry.beforeData !== null || entry.afterData !== null;
                  return (
                    <Fragment key={entry.id}>
                      <tr
                        onClick={() => hasDetails && toggleExpand(entry.id)}
                        className={`border-b border-acars-border transition-colors ${
                          hasDetails
                            ? 'hover:bg-acars-hover cursor-pointer'
                            : ''
                        } ${isExpanded ? 'bg-acars-hover' : ''}`}
                      >
                        <td className="px-3 py-2.5 text-center">
                          {hasDetails && (
                            isExpanded
                              ? <ChevronDown className="w-3.5 h-3.5 text-acars-muted inline-block" />
                              : <ChevronExpand className="w-3.5 h-3.5 text-acars-muted inline-block" />
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-acars-text font-mono text-[11px]">
                            {formatTimestamp(entry.createdAt)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {entry.actorCallsign ? (
                            <div>
                              <span className="text-acars-text font-mono font-semibold">
                                {entry.actorCallsign}
                              </span>
                              {entry.actorName && (
                                <span className="text-acars-muted ml-1.5">
                                  ({entry.actorName})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-acars-muted italic">System</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <ActionBadge action={entry.action} />
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-acars-text">{entry.targetType}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-acars-text font-mono">
                            {entry.targetId ?? '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-acars-muted font-mono text-[11px]">
                            {entry.ipAddress ?? '—'}
                          </span>
                        </td>
                      </tr>
                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr className="bg-acars-panel">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="flex flex-col md:flex-row gap-4">
                              <JsonBlock label="Before" data={entry.beforeData} />
                              <JsonBlock label="After" data={entry.afterData} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ─────────────────────────────────────────── */}
      {total > pageSize && (
        <div className="flex-none border-t border-acars-border bg-acars-bg/50 px-6 py-2 flex items-center justify-between">
          <span className="text-xs text-acars-muted">
            Showing {(page - 1) * pageSize + 1}&ndash;{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-7 w-7 rounded border border-acars-border bg-acars-panel text-acars-muted hover:text-acars-text disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs text-acars-text px-2 font-mono">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="h-7 w-7 rounded border border-acars-border bg-acars-panel text-acars-muted hover:text-acars-text disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
