import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import {
  Plane,
  Users,
  CalendarDays,
  Clock,
  ArrowRight,
  Route,
  BookOpen,
  Radio,
  Maximize2,
  Award,
  MapPin,
  Loader2,
  Trophy,
  Megaphone,
  ChevronLeft,
  ChevronRight,
  Pin,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
} from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import type {
  ActiveBidEntry,
  AllBidsResponse,
  DashboardStats,
  Airport,
  LeaderboardEntry,
  LeaderboardResponse,
  LogbookEntry,
  LogbookListResponse,
  NewsPost,
  NewsListResponse,
  CreateNewsRequest,
  UpdateNewsRequest,
} from '@acars/shared';

// ─── Helpers ────────────────────────────────────────────────────

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

// ─── Quick Actions (static nav links) ───────────────────────────

const QUICK_ACTIONS = [
  { label: 'Bid a Flight', icon: CalendarDays, to: '/schedule', iconBox: 'bg-blue-500/20 border-blue-500/30', iconColor: 'text-blue-400' },
  { label: 'File Flight Plan', icon: Route, to: '/planning', iconBox: 'bg-violet-500/20 border-violet-500/30', iconColor: 'text-violet-400' },
  { label: 'View Logbook', icon: BookOpen, to: '/logbook', iconBox: 'bg-amber-500/20 border-amber-500/30', iconColor: 'text-amber-400' },
  { label: 'Open Dispatch', icon: Radio, to: '/dispatch', iconBox: 'bg-emerald-500/20 border-emerald-500/30', iconColor: 'text-emerald-400' },
] as const;

// ─── Sub-Components ─────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon: typeof Plane;
  iconBox: string;
  iconColor: string;
}

function StatCard({ label, value, icon: Icon, iconBox, iconColor }: StatCardProps) {
  return (
    <div className="panel p-4 flex items-center gap-4">
      <div className={`flex items-center justify-center w-11 h-11 rounded-xl border ${iconBox}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-acars-muted font-medium">{label}</p>
        <span className="text-xl font-semibold text-acars-text tabular-nums">{value}</span>
      </div>
    </div>
  );
}

// ─── Bid phase badge ─────────────────────────────────────────────

const PHASE_STYLES: Record<string, string> = {
  reserved:  'bg-blue-500/15 text-blue-400 border-blue-400/30',
  preflight: 'bg-amber-500/15 text-amber-400 border-amber-400/30',
  taxiout:   'bg-amber-500/15 text-amber-400 border-amber-400/30',
  climb:     'bg-emerald-500/15 text-emerald-400 border-emerald-400/30',
  cruise:    'bg-sky-500/15 text-sky-400 border-sky-400/30',
  descent:   'bg-violet-500/15 text-violet-400 border-violet-400/30',
  approach:  'bg-amber-500/15 text-amber-400 border-amber-400/30',
  landed:    'bg-emerald-500/15 text-emerald-400 border-emerald-400/30',
};

function PhaseBadge({ phase }: { phase: string }) {
  const style = PHASE_STYLES[phase] ?? PHASE_STYLES.reserved;
  const label = phase.charAt(0).toUpperCase() + phase.slice(1);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider border ${style}`}>
      {label}
    </span>
  );
}

function ActiveBidsTable({ bids }: { bids: ActiveBidEntry[] }) {
  const navigate = useNavigate();

  return (
    <div className="panel flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-acars-border">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-acars-text">Active Bids</h3>
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-blue-500/20 border border-blue-400/30 text-[10px] font-semibold text-blue-400 tabular-nums px-1.5">
            {bids.length}
          </span>
        </div>
        <button
          onClick={() => navigate('/schedule')}
          className="flex items-center gap-1 text-[11px] font-medium text-blue-400 hover:text-acars-text transition-colors"
        >
          Bid a Flight <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      {bids.length === 0 ? (
        <div className="empty-state">
          <CalendarDays className="empty-state-icon" />
          <p className="empty-state-title">No Active Cargo Runs</p>
          <p className="empty-state-desc">No pilots currently have active bids across the VA</p>
          <button
            onClick={() => navigate('/schedule')}
            className="btn-primary btn-sm mt-4"
          >
            Browse Schedule
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-acars-muted border-b border-acars-border">
                <th className="text-left px-4 py-2 font-medium">Flight #</th>
                <th className="text-left px-4 py-2 font-medium">Route</th>
                <th className="text-left px-4 py-2 font-medium hidden xl:table-cell">Aircraft</th>
                <th className="text-left px-4 py-2 font-medium">Dep (Z)</th>
                <th className="text-left px-4 py-2 font-medium hidden lg:table-cell">Duration</th>
                <th className="text-left px-4 py-2 font-medium">Pilot</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {bids.map((bid) => (
                <tr
                  key={bid.id}
                  className="hover:bg-acars-hover transition-colors"
                >
                  <td className="px-4 py-2.5 font-mono font-semibold text-acars-text">{bid.flightNumber}</td>
                  <td className="px-4 py-2.5 text-acars-muted/80">
                    <span className="font-mono">{bid.depIcao}</span>
                    <ArrowRight className="w-3 h-3 text-blue-400/60 inline mx-1" />
                    <span className="font-mono">{bid.arrIcao}</span>
                  </td>
                  <td className="px-4 py-2.5 text-acars-muted/80 hidden xl:table-cell font-mono">{bid.aircraftType}</td>
                  <td className="px-4 py-2.5 font-mono text-acars-muted/80 tabular-nums">{bid.depTime}Z</td>
                  <td className="px-4 py-2.5 font-mono text-acars-muted/80 tabular-nums hidden lg:table-cell">{formatDuration(bid.flightTimeMin)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-acars-muted/80 text-[11px]">{bid.pilotCallsign}</span>
                      <span className="text-acars-muted/60 hidden xl:inline">{bid.pilotName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <PhaseBadge phase="reserved" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="panel flex flex-col h-full">
      <div className="px-4 py-3 border-b border-acars-border">
        <h3 className="text-sm font-semibold text-acars-text">Quick Actions</h3>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-3 p-4">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={() => navigate(action.to)}
              className="flex flex-col items-center justify-center gap-2.5 rounded-md border border-acars-border bg-acars-bg hover:border-blue-400/50 hover:bg-acars-hover hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 transition-all duration-200 p-4"
            >
              <div className={`flex items-center justify-center w-10 h-10 rounded-xl border ${action.iconBox}`}>
                <Icon className={`w-5 h-5 ${action.iconColor}`} />
              </div>
              <span className={`text-xs font-medium ${action.iconColor}`}>{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Network Map ────────────────────────────────────────────────

function NetworkMapPreview({ airports }: { airports: Airport[] }) {
  const navigate = useNavigate();

  return (
    <div className="panel flex flex-col h-[320px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-acars-border">
        <div className="flex items-center gap-2.5">
          <img src="/logos/chevron-light.png" alt="SMA" className="h-5 w-auto opacity-60" />
          <h3 className="text-sm font-semibold text-acars-text">Network Map</h3>
        </div>
        <button
          onClick={() => navigate('/map')}
          className="flex items-center gap-1 text-[11px] font-medium text-blue-400 hover:text-acars-text transition-colors"
        >
          Expand <Maximize2 className="w-3 h-3" />
        </button>
      </div>
      <div className="flex-1 relative overflow-hidden shadow-[inset_0_2px_8px_rgba(0,0,0,0.3)]">
        <MapContainer
          center={[37.5, -96.0]}
          zoom={3.5}
          zoomSnap={0.5}
          className="h-full w-full"
          zoomControl={false}
          attributionControl={false}
          style={{ background: 'var(--bg-map)' }}
          scrollWheelZoom={false}
          dragging={false}
          doubleClickZoom={false}
          touchZoom={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            maxZoom={19}
          />
          {airports.map(apt => (
            <CircleMarker
              key={apt.icao}
              center={[apt.lat, apt.lon]}
              radius={5}
              pathOptions={{
                color: 'var(--cyan)',
                fillColor: 'var(--cyan)',
                fillOpacity: 0.7,
                weight: 1,
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -6]}
                className="hub-tooltip"
                permanent={false}
              >
                <span style={{ fontSize: '10px', fontFeatureSettings: '"tnum"' }}>
                  {apt.icao} — {apt.city}
                </span>
              </Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

// ─── My Info Card ───────────────────────────────────────────────

function MyInfoCard({ recentFlights }: { recentFlights: LogbookEntry[] }) {
  const user = useAuthStore(s => s.user);

  if (!user) return null;

  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();

  return (
    <div className="panel flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-acars-border">
        <h3 className="text-sm font-semibold text-acars-text">My Info</h3>
      </div>
      <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
        {/* Profile header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-11 h-11 rounded-full bg-blue-500/25 border border-blue-400/40 text-blue-400 text-sm font-semibold shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-acars-text">{user.firstName} {user.lastName}</p>
            <div className="flex items-center gap-2 text-[11px] text-acars-muted mt-0.5">
              <span className="font-mono">{user.callsign}</span>
              <span className="text-acars-border">|</span>
              <span className="truncate">{user.email}</span>
            </div>
          </div>
        </div>

        {/* Role & Rank row */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-400 bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 rounded-full">
            <Award className="w-3 h-3" /> {user.rank}
          </span>
          <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide text-blue-400 bg-blue-500/15 border border-blue-400/30 px-2 py-0.5 rounded-full">
            {user.role === 'admin' ? 'Admin' : 'Pilot'}
          </span>
          <span className="text-[10px] text-acars-muted ml-auto">
            Member since {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
        </div>

        {/* Recent Flights */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-2">Recent Flights</p>
          {recentFlights.length === 0 ? (
            <p className="text-[11px] text-acars-muted/60 italic">No flights logged yet</p>
          ) : (
            <div className="space-y-1">
              {recentFlights.map(flight => {
                const date = new Date(flight.createdAt);
                const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const fpm = flight.landingRateFpm;
                const fpmColor = fpm == null ? 'text-acars-muted/60' : Math.abs(fpm) <= 200 ? 'text-emerald-400' : Math.abs(fpm) <= 400 ? 'text-amber-400' : 'text-red-400';
                return (
                  <div key={flight.id} className="flex items-center gap-3 text-[11px] py-1.5">
                    <span className="text-acars-muted/80 tabular-nums w-14 shrink-0">{dateStr}</span>
                    <span className="font-mono text-acars-text">
                      {flight.depIcao}
                      <ArrowRight className="w-3 h-3 text-blue-400/60 inline mx-1" />
                      {flight.arrIcao}
                    </span>
                    <span className="text-acars-muted/60 tabular-nums ml-auto">{formatDuration(flight.flightTimeMin)}</span>
                    <span className={`font-mono tabular-nums ${fpmColor}`}>
                      {fpm != null ? `${fpm > 0 ? '-' : '-'}${Math.abs(fpm)}fpm` : '---'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Hub info */}
        <div className="flex items-center gap-2 text-[11px] text-acars-muted">
          <MapPin className="w-3.5 h-3.5 text-blue-400" />
          <span>Home hub assignment coming soon</span>
        </div>
      </div>
    </div>
  );
}

// ─── Pilot Leaderboard ──────────────────────────────────────────

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

const RANK_STYLES: Record<number, string> = {
  1: 'text-yellow-400 font-bold',
  2: 'text-gray-300 font-bold',
  3: 'text-amber-600 font-bold',
};

function PilotLeaderboard() {
  const [month, setMonth] = useState(getCurrentMonth);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<LeaderboardResponse>(`/api/leaderboard?month=${month}`)
      .then(data => setEntries(data.entries))
      .catch(err => console.error('[Leaderboard] Error:', err))
      .finally(() => setLoading(false));
  }, [month]);

  const canGoNext = month < getCurrentMonth();

  return (
    <div className="panel flex flex-col h-[380px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-acars-border">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-500" />
          <h3 className="text-sm font-semibold text-acars-text">Pilot Leaderboard</h3>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMonth(m => shiftMonth(m, -1))} className="p-1 rounded hover:bg-acars-border text-acars-muted hover:text-acars-text transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-acars-muted tabular-nums min-w-[120px] text-center">{formatMonth(month)}</span>
          <button onClick={() => canGoNext && setMonth(m => shiftMonth(m, 1))} disabled={!canGoNext} className="p-1 rounded hover:bg-acars-border text-acars-muted hover:text-acars-text transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Trophy className="w-8 h-8 text-acars-muted/30 mb-2" />
          <p className="text-xs text-acars-muted">No flights logged for {formatMonth(month)}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-acars-muted border-b border-acars-border">
                <th className="text-center px-3 py-2 font-medium w-10">#</th>
                <th className="text-left px-3 py-2 font-medium">Pilot</th>
                <th className="text-right px-3 py-2 font-medium">Flights</th>
                <th className="text-right px-3 py-2 font-medium hidden lg:table-cell">Hours</th>
                <th className="text-right px-3 py-2 font-medium hidden xl:table-cell">Cargo</th>
                <th className="text-right px-3 py-2 font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr
                  key={e.callsign}
                  className={`border-b border-acars-border hover:bg-acars-hover transition-colors ${
                    i % 2 === 0 ? 'bg-acars-panel' : 'bg-acars-bg'
                  }`}
                >
                  <td className={`text-center px-3 py-2.5 tabular-nums ${RANK_STYLES[e.rank] ?? 'text-acars-muted'}`}>
                    <span className="inline-flex items-center gap-1">
                      {e.rank <= 3 && (
                        <span className={`inline-block w-4 h-4 rounded-full text-[9px] font-bold leading-4 text-center ${
                          e.rank === 1 ? 'bg-yellow-500/25 text-yellow-400' :
                          e.rank === 2 ? 'bg-gray-400/25 text-gray-300' :
                          'bg-amber-700/25 text-amber-600'
                        }`}>{e.rank}</span>
                      )}
                      {e.rank > 3 && e.rank}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-acars-text">{e.callsign}</span>
                      <span className="text-acars-muted hidden xl:inline">{e.pilotName}</span>
                    </div>
                  </td>
                  <td className="text-right px-3 py-2.5 font-mono text-acars-text tabular-nums">{e.flights}</td>
                  <td className="text-right px-3 py-2.5 font-mono text-acars-muted tabular-nums hidden lg:table-cell">{formatDuration(e.hoursMin)}</td>
                  <td className="text-right px-3 py-2.5 font-mono text-acars-muted tabular-nums hidden xl:table-cell">{e.cargoLbs.toLocaleString()} lb</td>
                  <td className="text-right px-3 py-2.5 tabular-nums">
                    {e.avgScore != null ? (
                      <span className={e.avgScore >= 90 ? 'text-emerald-400' : e.avgScore >= 75 ? 'text-amber-400' : 'text-red-400'}>
                        {e.avgScore}
                      </span>
                    ) : (
                      <span className="text-acars-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── News Feed ──────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function NewsFeed() {
  const user = useAuthStore(s => s.user);
  const isAdmin = user?.role === 'admin';
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null); // post id or -1 for new
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formPinned, setFormPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadPosts = useCallback(() => {
    setLoading(true);
    api.get<NewsListResponse>('/api/news?pageSize=20')
      .then(data => setPosts(data.posts))
      .catch(err => console.error('[News] Error:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  function startCreate() {
    setEditing(-1);
    setFormTitle('');
    setFormBody('');
    setFormPinned(false);
  }

  function startEdit(post: NewsPost) {
    setEditing(post.id);
    setFormTitle(post.title);
    setFormBody(post.body);
    setFormPinned(post.pinned);
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function handleSave() {
    if (!formTitle.trim() || !formBody.trim()) return;
    setSaving(true);
    try {
      if (editing === -1) {
        await api.post<NewsPost>('/api/news', { title: formTitle.trim(), body: formBody.trim(), pinned: formPinned } satisfies CreateNewsRequest);
      } else {
        await api.patch<NewsPost>(`/api/news/${editing}`, { title: formTitle.trim(), body: formBody.trim(), pinned: formPinned } satisfies UpdateNewsRequest);
      }
      setEditing(null);
      loadPosts();
    } catch (err) {
      console.error('[News] Save error:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.delete(`/api/news/${id}`);
      loadPosts();
    } catch (err) {
      console.error('[News] Delete error:', err);
    }
  }

  return (
    <div className="panel flex flex-col h-[380px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-acars-border">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-acars-text">Announcements</h3>
          {posts.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-blue-500/20 border border-blue-400/30 text-[10px] font-semibold text-blue-400 tabular-nums px-1.5">
              {posts.length}
            </span>
          )}
        </div>
        {isAdmin && editing === null && (
          <button onClick={startCreate} className="btn-green btn-sm flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> New Post
          </button>
        )}
      </div>

      {/* Inline create/edit form */}
      {editing !== null && (
        <div className="px-4 py-3 border-b border-acars-border space-y-2 bg-acars-bg/50">
          <input
            type="text"
            value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
            placeholder="Title"
            className="w-full px-2.5 py-1.5 bg-acars-bg border border-acars-border rounded text-xs text-acars-text placeholder:text-acars-muted/60 focus:outline-none focus:border-blue-400"
          />
          <textarea
            value={formBody}
            onChange={e => setFormBody(e.target.value)}
            placeholder="Body"
            rows={3}
            className="w-full px-2.5 py-1.5 bg-acars-bg border border-acars-border rounded text-xs text-acars-text placeholder:text-acars-muted/60 focus:outline-none focus:border-blue-400 resize-none"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-[11px] text-amber-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formPinned}
                onChange={e => setFormPinned(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-amber-400/40 bg-acars-bg text-amber-400 focus:ring-amber-400/40 focus:ring-offset-0 accent-amber-500"
              />
              <Pin className="w-3 h-3" /> Pin post
            </label>
            <div className="flex items-center gap-2">
              <button onClick={cancelEdit} className="btn-danger btn-sm flex items-center gap-1">
                <X className="w-3 h-3" /> Cancel
              </button>
              <button onClick={handleSave} disabled={saving || !formTitle.trim() || !formBody.trim()} className="btn-green btn-sm flex items-center gap-1">
                <Save className="w-3 h-3" /> {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Megaphone className="w-8 h-8 text-acars-muted/30 mb-2" />
          <p className="text-xs text-acars-muted">No announcements yet — check back soon!</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {posts.map(post => {
            const isExpanded = expandedId === post.id;
            return (
              <div
                key={post.id}
                className="px-4 py-3 border-b border-acars-border hover:bg-acars-hover transition-colors group cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : post.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {post.pinned && <Pin className="w-3 h-3 text-amber-400 shrink-0" />}
                      <h4 className="text-xs font-semibold text-acars-text truncate">{post.title}</h4>
                    </div>
                    <p className={`text-[11px] text-acars-muted mb-1 ${isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>{post.body}</p>
                    <div className="flex items-center gap-2 text-[10px] text-acars-muted/80">
                      <span className="font-mono">{post.authorCallsign}</span>
                      <span className="text-acars-border">|</span>
                      <span>{relativeTime(post.createdAt)}</span>
                      {isExpanded && post.updatedAt !== post.createdAt && (
                        <>
                          <span className="text-acars-border">|</span>
                          <span>edited {relativeTime(post.updatedAt)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {isAdmin && editing === null && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => startEdit(post)} className="p-1 rounded hover:bg-acars-border text-acars-muted hover:text-acars-text transition-colors">
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleDelete(post.id)} className="p-1 rounded hover:bg-red-500/10 text-acars-muted hover:text-red-400 transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Dashboard Page ─────────────────────────────────────────────

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [bids, setBids] = useState<ActiveBidEntry[]>([]);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [recentFlights, setRecentFlights] = useState<LogbookEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<DashboardStats>('/api/stats'),
      api.get<AllBidsResponse>('/api/bids/all'),
      api.get<Airport[]>('/api/airports'),
      api.get<LogbookListResponse>('/api/logbook?pageSize=5').catch(() => ({ entries: [] as LogbookEntry[], total: 0, page: 1, pageSize: 5 })),
    ]).then(([statsData, bidsData, airportsData, logbookData]) => {
      setStats(statsData);
      setBids(bidsData.bids);
      setAirports(airportsData);
      setRecentFlights(logbookData.entries);
    }).catch(err => {
      console.error('[Dashboard] Load error:', err);
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5 overflow-auto h-full">
      {/* Row 1: Stats Bar */}
      <div className="grid grid-cols-4 gap-5">
        <StatCard label="Active Flights" value={stats?.activeFlights ?? '—'} icon={Plane} iconBox="bg-emerald-500/20 border-emerald-500/30" iconColor="text-emerald-400" />
        <StatCard label="Pilots Online" value={stats?.pilotsOnline ?? '—'} icon={Users} iconBox="bg-blue-500/20 border-blue-500/30" iconColor="text-blue-400" />
        <StatCard label="Flights this Month" value={stats?.flightsThisMonth ?? '—'} icon={CalendarDays} iconBox="bg-amber-500/20 border-amber-500/30" iconColor="text-amber-400" />
        <StatCard label="Total Flight Hours" value={stats?.totalHours ?? '—'} icon={Clock} iconBox="bg-blue-400/20 border-blue-400/30" iconColor="text-blue-300" />
      </div>

      {/* Row 2: Active Bids + Quick Actions */}
      <div className="grid grid-cols-[1fr_340px] gap-5">
        <ActiveBidsTable bids={bids} />
        <QuickActions />
      </div>

      {/* Row 3: Network Map + My Info */}
      <div className="grid grid-cols-[1fr_420px] gap-5">
        <NetworkMapPreview airports={airports} />
        <MyInfoCard recentFlights={recentFlights} />
      </div>

      {/* Row 4: Pilot Leaderboard + News */}
      <div className="grid grid-cols-[1fr_380px] gap-5">
        <PilotLeaderboard />
        <NewsFeed />
      </div>
    </div>
  );
}
