import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Search,
  RotateCcw,
  Loader2,
  Plane,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Clock,
  Fuel,
  Ruler,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Ban,
  Filter,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import type { LogbookEntry, LogbookListResponse, LogbookStatus } from '@acars/shared';

// ─── Helpers ────────────────────────────────────────────────────

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) + 'z';
}

function formatDateTime(iso: string): string {
  return `${formatDate(iso)} ${formatTime(iso)}`;
}

function landingRateColor(fpm: number | null): string {
  if (fpm == null) return 'text-acars-muted';
  const abs = Math.abs(fpm);
  if (abs <= 150) return 'text-acars-green';
  if (abs <= 250) return 'text-acars-amber';
  return 'text-acars-red';
}

function scoreColor(score: number | null): string {
  if (score == null) return 'text-acars-muted';
  if (score >= 90) return 'text-acars-green';
  if (score >= 75) return 'text-acars-amber';
  return 'text-acars-red';
}

const STATUS_CONFIG: Record<LogbookStatus, { label: string; icon: typeof CheckCircle2; bg: string; text: string; border: string }> = {
  pending:   { label: 'Pending',   icon: Clock,         bg: 'bg-acars-blue/10',  text: 'text-acars-blue',  border: 'border-acars-blue/20' },
  approved:  { label: 'Approved',  icon: CheckCircle2,  bg: 'bg-acars-green/10', text: 'text-acars-green', border: 'border-acars-green/20' },
  completed: { label: 'Completed', icon: CheckCircle2,  bg: 'bg-acars-green/10', text: 'text-acars-green', border: 'border-acars-green/20' },
  diverted:  { label: 'Diverted',  icon: AlertTriangle, bg: 'bg-acars-amber/10', text: 'text-acars-amber', border: 'border-acars-amber/20' },
  rejected:  { label: 'Rejected',  icon: XCircle,       bg: 'bg-acars-red/10',   text: 'text-acars-red',   border: 'border-acars-red/20' },
  cancelled: { label: 'Cancelled', icon: Ban,           bg: 'bg-acars-muted/10', text: 'text-acars-muted', border: 'border-acars-border' },
};

function StatusBadge({ status }: { status: LogbookStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.approved;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

type SortField = 'date' | 'flight' | 'route' | 'aircraft' | 'duration' | 'landing' | 'score';
type SortDir = 'asc' | 'desc';

// ─── LogbookPage ────────────────────────────────────────────────

export function LogbookPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);

  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LogbookStatus | ''>('');

  // Sort
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (user) params.set('userId', String(user.id));

      const data = await api.get<LogbookListResponse>(`/api/logbook?${params}`);
      setEntries(data.entries);
      setTotal(data.total);
    } catch (err: any) {
      setError(err?.message || 'Failed to load logbook');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter, user]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Client-side sort (current page)
  const sorted = [...entries].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    switch (sortField) {
      case 'date': return dir * (new Date(a.actualDep).getTime() - new Date(b.actualDep).getTime());
      case 'flight': return dir * a.flightNumber.localeCompare(b.flightNumber);
      case 'route': return dir * `${a.depIcao}${a.arrIcao}`.localeCompare(`${b.depIcao}${b.arrIcao}`);
      case 'aircraft': return dir * a.aircraftType.localeCompare(b.aircraftType);
      case 'duration': return dir * (a.flightTimeMin - b.flightTimeMin);
      case 'landing': return dir * ((a.landingRateFpm ?? 0) - (b.landingRateFpm ?? 0));
      case 'score': return dir * ((a.score ?? 0) - (b.score ?? 0));
      default: return 0;
    }
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'date' ? 'desc' : 'asc');
    }
  }

  function SortHeader({ field, label, className = '' }: { field: SortField; label: string; className?: string }) {
    const active = sortField === field;
    return (
      <button
        onClick={() => toggleSort(field)}
        className={`flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium hover:text-acars-text transition-colors ${active ? 'text-acars-green' : 'text-acars-muted'} ${className}`}
      >
        {label}
        <ArrowUpDown className={`w-3 h-3 ${active ? 'text-acars-green' : 'text-acars-muted/50'}`} />
      </button>
    );
  }

  // ── Stats summary ────────────────────────────────────────────

  const totalFlights = total;
  const totalHours = entries.reduce((sum, e) => sum + e.flightTimeMin, 0);
  const totalDist = entries.reduce((sum, e) => sum + e.distanceNm, 0);
  const avgScore = entries.length > 0
    ? Math.round(entries.filter(e => e.score != null).reduce((sum, e) => sum + (e.score ?? 0), 0) / (entries.filter(e => e.score != null).length || 1))
    : 0;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex-none border-b border-acars-border bg-acars-bg/50 px-5 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-acars-amber/10 border border-acars-amber/20">
              <BookOpen className="w-5 h-5 text-acars-amber" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-acars-text">Pilot Logbook</h1>
              <p className="text-xs text-acars-muted">Flight history, PIREPs, and performance records</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setPage(1); fetchEntries(); }}
              className="h-8 w-8 rounded-md border border-acars-border bg-acars-panel text-acars-muted hover:text-acars-text flex items-center justify-center transition-colors"
              title="Refresh"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex gap-6 mb-3">
          <div className="flex items-center gap-2 text-xs">
            <Plane className="w-3.5 h-3.5 text-acars-blue" />
            <span className="text-acars-muted">Flights</span>
            <span className="text-acars-text font-semibold">{totalFlights}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Clock className="w-3.5 h-3.5 text-acars-green" />
            <span className="text-acars-muted">Hours (page)</span>
            <span className="text-acars-text font-semibold">{formatDuration(totalHours)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Ruler className="w-3.5 h-3.5 text-acars-amber" />
            <span className="text-acars-muted">Distance (page)</span>
            <span className="text-acars-text font-semibold">{totalDist.toLocaleString()} nm</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-acars-green" />
            <span className="text-acars-muted">Avg Score</span>
            <span className={`font-semibold ${scoreColor(avgScore)}`}>{avgScore || '—'}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-acars-muted pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search flight, ICAO, registration..."
              className="w-full h-8 pl-8 pr-3 rounded-md border border-acars-border bg-acars-panel text-xs text-acars-text placeholder:text-acars-muted/50 outline-none focus:border-acars-green transition-colors font-mono"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-acars-muted pointer-events-none" />
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value as LogbookStatus | ''); setPage(1); }}
              className="h-8 pl-7 pr-6 rounded-md border border-acars-border bg-acars-panel text-xs text-acars-text outline-none focus:border-acars-green transition-colors appearance-none cursor-pointer"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="diverted">Diverted</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 text-acars-amber animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64 text-sm text-acars-red">{error}</div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <BookOpen className="w-10 h-10 text-acars-muted/30" />
            <p className="text-sm text-acars-muted">No logbook entries found</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-acars-bg border-b border-acars-border">
              <tr>
                <th className="text-left px-4 py-2.5"><SortHeader field="date" label="Date" /></th>
                <th className="text-left px-3 py-2.5"><SortHeader field="flight" label="Flight" /></th>
                <th className="text-left px-3 py-2.5"><SortHeader field="route" label="Route" /></th>
                <th className="text-left px-3 py-2.5"><SortHeader field="aircraft" label="Aircraft" /></th>
                <th className="text-left px-3 py-2.5"><SortHeader field="duration" label="Duration" /></th>
                <th className="text-right px-3 py-2.5"><SortHeader field="landing" label="Landing" className="justify-end" /></th>
                <th className="text-right px-3 py-2.5"><SortHeader field="score" label="Score" className="justify-end" /></th>
                <th className="text-center px-3 py-2.5 text-[10px] uppercase tracking-wider font-medium text-acars-muted">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(entry => (
                <tr
                  key={entry.id}
                  onClick={() => navigate(`/logbook/${entry.id}`)}
                  className="border-b border-acars-border/50 hover:bg-[#1c2333] cursor-pointer transition-colors group"
                  title="Click to view details"
                >
                  <td className="px-4 py-2.5">
                    <div className="text-acars-text font-medium">{formatDate(entry.actualDep)}</div>
                    <div className="text-acars-muted text-[10px]">{formatTime(entry.actualDep)}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-acars-text font-mono font-semibold">{entry.flightNumber}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-acars-text font-mono font-semibold">{entry.depIcao}</span>
                      <ArrowRight className="w-3 h-3 text-acars-muted/50" />
                      <span className="text-acars-text font-mono font-semibold">{entry.arrIcao}</span>
                    </div>
                    <div className="text-acars-muted text-[10px]">{entry.distanceNm.toLocaleString()} nm</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-acars-text font-medium">{entry.aircraftType}</div>
                    {entry.aircraftRegistration && (
                      <div className="text-acars-muted text-[10px] font-mono">{entry.aircraftRegistration}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-acars-text">{formatDuration(entry.flightTimeMin)}</span>
                  </td>
                  <td className="text-right px-3 py-2.5">
                    <span className={`font-mono font-semibold ${landingRateColor(entry.landingRateFpm)}`}>
                      {entry.landingRateFpm != null ? `${entry.landingRateFpm} fpm` : '—'}
                    </span>
                  </td>
                  <td className="text-right px-3 py-2.5">
                    <span className={`font-mono font-bold ${scoreColor(entry.score)}`}>
                      {entry.score ?? '—'}
                    </span>
                  </td>
                  <td className="text-center px-3 py-2.5">
                    <StatusBadge status={entry.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ────────────────────────────────────────── */}
      {total > pageSize && (
        <div className="flex-none border-t border-acars-border bg-acars-bg/50 px-5 py-2 flex items-center justify-between">
          <span className="text-xs text-acars-muted">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-7 w-7 rounded border border-acars-border bg-acars-panel text-acars-muted hover:text-acars-text disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs text-acars-text px-2 font-mono">{page} / {totalPages}</span>
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
