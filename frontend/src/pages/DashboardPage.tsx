import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import {
  CalendarDots,
  ArrowRight,
  Path,
  BookOpen,
  Broadcast,
  ArrowsOut,
  Medal,
  MapPin,
  SpinnerGap,
  Trophy,
  Megaphone,
  CaretLeft,
  CaretRight,
  PushPin,
  Plus,
  PencilSimple,
  Trash,
  X,
  FloppyDisk,
  Airplane,
} from '@phosphor-icons/react';
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../lib/api';
import { toast } from '../stores/toastStore';
import { useAuthStore } from '../stores/authStore';
import { useSocketStore } from '../stores/socketStore';
import type {
  ActiveBidEntry,
  ActiveFlightHeartbeat,
  AllBidsResponse,
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

// ─── Phase helpers ──────────────────────────────────────────────

const PHASE_COLORS: Record<string, string> = {
  PREFLIGHT:  'text-[var(--text-label)] bg-white/[0.04]',
  TAXI_OUT:   'text-amber-400 bg-amber-500/10',
  TAKEOFF:    'text-blue-400 bg-blue-500/10',
  CLIMB:      'text-blue-400 bg-blue-500/10',
  CRUISE:     'text-emerald-400 bg-emerald-500/10',
  DESCENT:    'text-cyan-400 bg-cyan-500/10',
  APPROACH:   'text-amber-400 bg-amber-500/10',
  LANDING:    'text-amber-400 bg-amber-500/10',
  TAXI_IN:    'text-amber-400 bg-amber-500/10',
  PARKED:     'text-[var(--text-label)] bg-white/[0.04]',
};

function phaseLabel(phase: string): string {
  return phase.replace('_', ' ');
}

// ─── Bid Route Card ─────────────────────────────────────────────

function BidRouteCard({ bid, phase }: { bid: ActiveBidEntry; phase?: string }) {
  const navigate = useNavigate();
  const phaseStyle = phase ? PHASE_COLORS[phase] ?? PHASE_COLORS.PREFLIGHT : '';

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-md bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors cursor-pointer"
      onClick={() => navigate('/planning')}
    >
      {/* Flight number + route */}
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <span className="text-[10px] font-semibold text-[#6b8aff] tabular-nums w-16 shrink-0">{bid.flightNumber}</span>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[12px] font-semibold text-white tracking-wide">{bid.depIcao}</span>
          <div className="flex-1 flex items-center gap-1">
            <div className="flex-1 h-px bg-white/[0.08]" />
            <Airplane className="w-3 h-3 text-[#6b8aff]/40 shrink-0 rotate-90" weight="light" />
            <div className="flex-1 h-px bg-white/[0.08]" />
          </div>
          <span className="text-[12px] font-semibold text-white tracking-wide">{bid.arrIcao}</span>
        </div>
      </div>

      {/* Aircraft type */}
      <span className="text-[9px] text-[var(--text-label)] tabular-nums shrink-0">{bid.aircraftType}</span>

      {/* Duration */}
      <span className="text-[9px] text-[var(--text-label)] tabular-nums shrink-0">{formatDuration(bid.flightTimeMin)}</span>

      {/* Phase badge */}
      {phase ? (
        <span className={`text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${phaseStyle}`}>
          {phaseLabel(phase)}
        </span>
      ) : (
        <span className="text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 text-[var(--text-label)] bg-white/[0.04]">
          Idle
        </span>
      )}

      {/* Pilot callsign */}
      <span className="text-[9px] text-[var(--text-secondary)] shrink-0">{bid.pilotCallsign}</span>
    </div>
  );
}

// ─── Active Bids Card ───────────────────────────────────────────

function ActiveBidsCard({ bids, isAdmin, onBidRemoved, activeFlights }: { bids: ActiveBidEntry[]; isAdmin: boolean; onBidRemoved: () => void; activeFlights: ActiveFlightHeartbeat[] }) {
  const navigate = useNavigate();

  const handleForceRemove = async (bidId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Remove this bid? The pilot will be notified.')) return;
    try {
      await api.delete(`/api/bids/${bidId}/force`);
      toast.success('Bid removed');
      onBidRemoved();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove bid');
    }
  };

  // Build a lookup of bidId → phase from active flights
  const phaseByBid = new Map<number, string>();
  for (const flight of activeFlights) {
    if (flight.bidId) phaseByBid.set(flight.bidId, flight.phase);
  }

  return (
    <div className="gradient-card flex flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <h3 className="text-[14px] font-semibold text-white">Active Bids</h3>
          <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-full bg-[#3b5bdb]/20 text-[10px] font-semibold text-[#6b8aff] tabular-nums px-1.5">
            {bids.length}
          </span>
        </div>
        <button
          onClick={() => navigate('/schedule')}
          className="flex items-center gap-1 text-[11px] font-medium text-[#6b8aff]/70 hover:text-[#6b8aff] transition-colors"
        >
          Bid a Flight <ArrowRight className="w-3.5 h-3.5" weight="light" />
        </button>
      </div>
      {bids.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-6">
          <CalendarDots className="w-10 h-10 text-white/10 mb-3" weight="light" />
          <p className="text-[13px] font-medium text-white/50 mb-1">No Active Cargo Runs</p>
          <p className="text-[11px] text-[var(--text-label)] mb-4">No pilots currently have active bids</p>
          <button
            onClick={() => navigate('/schedule')}
            className="btn-primary btn-sm"
          >
            Browse Schedule
          </button>
        </div>
      ) : (
        <div className="px-3 pb-3 space-y-1">
          {bids.map((bid) => (
            <div key={bid.id} className="relative group">
              <BidRouteCard bid={bid} phase={phaseByBid.get(bid.id)} />
              {isAdmin && (
                <button
                  onClick={(e) => handleForceRemove(bid.id, e)}
                  className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-[var(--text-label)] hover:text-red-400 transition-all"
                  title="Force remove this bid (admin only)"
                >
                  <Trash className="w-3 h-3" weight="light" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Quick Actions ──────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: 'Bid a Flight', icon: CalendarDots, to: '/schedule', accent: 'text-[#6b8aff]' },
  { label: 'File Flight Plan', icon: Path, to: '/planning', accent: 'text-[#6b8aff]' },
  { label: 'View Logbook', icon: BookOpen, to: '/logbook', accent: 'text-[#6b8aff]' },
  { label: 'Open Dispatch', icon: Broadcast, to: '/dispatch', accent: 'text-[#6b8aff]' },
] as const;

function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-2">
      {QUICK_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            onClick={() => navigate(action.to)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.08] active:scale-[0.98] text-[11px] font-medium text-[var(--text-secondary)] hover:text-white transition-all duration-150"
          >
            <Icon className={`w-3.5 h-3.5 ${action.accent}`} weight="light" />
            {action.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Network Map ────────────────────────────────────────────────

const DASH_PLANE_SVG = (heading: number) => `
  <svg viewBox="0 0 64 64" width="22" height="22" style="transform: rotate(${heading}deg); filter: drop-shadow(0 1px 3px rgba(0,0,0,0.6)) drop-shadow(0 0 8px rgba(59,130,246,0.5));">
    <path d="
      M32 2
      C33 2 34 3 34 5
      L34 20
      L54 30 C56 31 56 33 55 34 L34 32
      L34 48
      L42 54 C43 55 43 56 42 57 L34 55
      L33 58 C32.5 59 31.5 59 31 58
      L30 55
      L22 57 C21 56 21 55 22 54 L30 48
      L30 32
      L9 34 C8 33 8 31 10 30 L30 20
      L30 5
      C30 3 31 2 32 2 Z"
      fill="#3b82f6" stroke="rgba(0,0,0,0.3)" stroke-width="0.5"/>
  </svg>`;

const dashPlaneIconCache = new Map<number, L.DivIcon>();

function getDashPlaneIcon(heading: number): L.DivIcon {
  const rounded = Math.round(heading / 5) * 5;
  let icon = dashPlaneIconCache.get(rounded);
  if (!icon) {
    icon = L.divIcon({
      html: DASH_PLANE_SVG(rounded),
      className: '',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    dashPlaneIconCache.set(rounded, icon);
  }
  return icon;
}

function NetworkMapPreview({ activeFlights }: { activeFlights: ActiveFlightHeartbeat[] }) {
  const navigate = useNavigate();

  return (
    <div className="gradient-card flex flex-col h-[400px]">
      <div className="flex items-center justify-between px-5 py-3.5">
        <div className="flex items-center gap-2">
          <img src="./logos/chevron-light.png" alt="SMX" className="h-4 w-auto opacity-40" />
          <h3 className="text-[14px] font-semibold text-white">Network Map</h3>
          {activeFlights.length > 0 && (
            <span className="text-[10px] text-acars-muted/60 tabular-nums">{activeFlights.length} active</span>
          )}
        </div>
        <button
          onClick={() => navigate('/map')}
          className="flex items-center gap-1 text-[11px] font-medium text-[#6b8aff]/70 hover:text-[#6b8aff] transition-colors"
        >
          Expand <ArrowsOut className="w-3.5 h-3.5" weight="light" />
        </button>
      </div>
      <div className="flex-1 relative overflow-hidden">
        <MapContainer
          center={[37.5, -96.0]}
          zoom={4.5}
          zoomSnap={0.5}
          className="h-full w-full"
          zoomControl={false}
          attributionControl={false}
          style={{ background: '#000000' }}
          scrollWheelZoom={false}
          dragging={false}
          doubleClickZoom={false}
          touchZoom={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            maxZoom={19}
          />
          {activeFlights.map((af) => (
            <Marker
              key={af.userId}
              position={[af.latitude, af.longitude]}
              icon={getDashPlaneIcon(af.heading)}
            >
              <Tooltip direction="top" offset={[0, -12]} opacity={0.95}>
                <span className="tabular-nums text-xs">{af.callsign} · FL{Math.round(af.altitude / 100)}</span>
              </Tooltip>
            </Marker>
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
    <div className="gradient-card flex flex-col">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.04]">
        <h3 className="text-[14px] font-semibold text-white">My Info</h3>
      </div>
      <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
        {/* Profile header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-11 h-11 rounded-full bg-[#3b5bdb]/15 text-[#6b8aff] text-sm font-semibold shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-white">{user.firstName} {user.lastName}</p>
            <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)] mt-0.5">
              <span>{user.callsign}</span>
              <span className="text-white/10">|</span>
              <span className="truncate">{user.email}</span>
            </div>
          </div>
        </div>

        {/* Role & Rank row */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
            <Medal className="w-3 h-3" weight="light" /> {user.rank}
          </span>
          <span className="inline-flex items-center text-[9px] font-semibold uppercase tracking-wider text-[#6b8aff] bg-[#3b5bdb]/10 px-2 py-0.5 rounded">
            {user.role === 'admin' ? 'Admin' : 'Pilot'}
          </span>
          <span className="text-[10px] text-[var(--text-label)] ml-auto">
            Member since {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
        </div>

        {/* Recent Flights */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-label)] font-medium mb-2">Recent Flights</p>
          {recentFlights.length === 0 ? (
            <p className="text-[11px] text-[var(--text-label)] italic">No flights logged yet</p>
          ) : (
            <div className="space-y-1">
              {recentFlights.map(flight => {
                const date = new Date(flight.createdAt);
                const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const fpm = flight.landingRateFpm;
                const fpmColor = fpm == null ? 'text-[var(--text-label)]' : Math.abs(fpm) <= 200 ? 'text-emerald-400' : Math.abs(fpm) <= 400 ? 'text-amber-400' : 'text-red-400';
                return (
                  <div key={flight.id} className="flex items-center gap-3 text-[11px] py-1.5">
                    <span className="text-[var(--text-label)] tabular-nums w-14 shrink-0">{dateStr}</span>
                    <span className="text-white">
                      {flight.depIcao}
                      <ArrowRight className="w-3 h-3 text-[#6b8aff]/40 inline mx-1" />
                      {flight.arrIcao}
                    </span>
                    <span className="text-[var(--text-label)] tabular-nums ml-auto">{formatDuration(flight.flightTimeMin)}</span>
                    <span className={`tabular-nums ${fpmColor}`}>
                      {fpm != null ? `${fpm > 0 ? '-' : '-'}${Math.abs(fpm)}fpm` : '---'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Hub info */}
        <div className="flex items-center gap-2 text-[11px] text-[var(--text-label)]">
          <MapPin className="w-3.5 h-3.5 text-[#6b8aff]/60" weight="light" />
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
    <div className="gradient-card flex flex-col min-h-[280px] max-h-[560px]">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-500" weight="light" />
          <h3 className="text-[14px] font-semibold text-white">Pilot Leaderboard</h3>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMonth(m => shiftMonth(m, -1))} className="p-1 rounded hover:bg-white/[0.04] text-[var(--text-label)] hover:text-white transition-colors">
            <CaretLeft className="w-4 h-4" weight="light" />
          </button>
          <span className="text-[11px] text-[var(--text-secondary)] tabular-nums min-w-[120px] text-center">{formatMonth(month)}</span>
          <button onClick={() => canGoNext && setMonth(m => shiftMonth(m, 1))} disabled={!canGoNext} className="p-1 rounded hover:bg-white/[0.04] text-[var(--text-label)] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <CaretRight className="w-4 h-4" weight="light" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <SpinnerGap className="w-5 h-5 text-[#6b8aff] animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Trophy className="w-8 h-8 text-white/10 mb-2" weight="light" />
          <p className="text-[11px] text-[var(--text-label)]">No flights logged for {formatMonth(month)}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-[9px] uppercase tracking-[0.08em] text-[var(--text-label)] border-b border-white/[0.04]">
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
                  className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors duration-100"
                >
                  <td className={`text-center px-3 py-2.5 tabular-nums ${
                    e.rank === 1 ? 'text-yellow-400 font-bold' :
                    e.rank === 2 ? 'text-gray-300 font-bold' :
                    e.rank === 3 ? 'text-amber-600 font-bold' : 'text-[var(--text-label)]'
                  }`}>
                    <span className="inline-flex items-center gap-1">
                      {e.rank <= 3 ? (
                        <span className={`inline-block w-4 h-4 rounded-full text-[9px] font-bold leading-4 text-center ${
                          e.rank === 1 ? 'bg-yellow-500/15 text-yellow-400' :
                          e.rank === 2 ? 'bg-gray-400/15 text-gray-300' :
                          'bg-amber-700/15 text-amber-600'
                        }`}>{e.rank}</span>
                      ) : e.rank}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-white">{e.callsign}</span>
                      <span className="text-[var(--text-label)] hidden xl:inline">{e.pilotName}</span>
                    </div>
                  </td>
                  <td className="text-right px-3 py-2.5 text-white tabular-nums">{e.flights}</td>
                  <td className="text-right px-3 py-2.5 text-[var(--text-secondary)] tabular-nums hidden lg:table-cell">{formatDuration(e.hoursMin)}</td>
                  <td className="text-right px-3 py-2.5 text-[var(--text-secondary)] tabular-nums hidden xl:table-cell">{e.cargoLbs.toLocaleString()} lb</td>
                  <td className="text-right px-3 py-2.5 tabular-nums">
                    {e.avgScore != null ? (
                      <span className={e.avgScore >= 90 ? 'text-emerald-400' : e.avgScore >= 75 ? 'text-amber-400' : 'text-red-400'}>
                        {e.avgScore}
                      </span>
                    ) : (
                      <span className="text-[var(--text-label)]">—</span>
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
  const [editing, setEditing] = useState<number | null>(null);
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
    <div className="gradient-card flex flex-col h-[400px]">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-[#6b8aff]" weight="light" />
          <h3 className="text-[14px] font-semibold text-white">Announcements</h3>
          {posts.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-full bg-[#3b5bdb]/20 text-[10px] font-semibold text-[#6b8aff] tabular-nums px-1.5">
              {posts.length}
            </span>
          )}
        </div>
        {isAdmin && editing === null && (
          <button onClick={startCreate} className="btn-green btn-sm flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" weight="light" /> New Post
          </button>
        )}
      </div>

      {/* Inline create/edit form */}
      {editing !== null && (
        <div className="px-5 py-3 border-b border-white/[0.04] space-y-2 bg-white/[0.02]">
          <input
            type="text"
            value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
            placeholder="Title"
            className="w-full px-2.5 py-1.5 bg-black border border-white/[0.06] rounded text-[12px] text-white placeholder:text-[var(--text-label)] focus:outline-none focus:border-[#3b5bdb]/50"
          />
          <textarea
            value={formBody}
            onChange={e => setFormBody(e.target.value)}
            placeholder="Body"
            rows={3}
            className="w-full px-2.5 py-1.5 bg-black border border-white/[0.06] rounded text-[12px] text-white placeholder:text-[var(--text-label)] focus:outline-none focus:border-[#3b5bdb]/50 resize-none"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-[11px] text-amber-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formPinned}
                onChange={e => setFormPinned(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-amber-400/40 bg-black text-amber-400 focus:ring-amber-400/40 focus:ring-offset-0 accent-amber-500"
              />
              <PushPin className="w-3 h-3" weight="light" /> Pin post
            </label>
            <div className="flex items-center gap-2">
              <button onClick={cancelEdit} className="btn-danger btn-sm flex items-center gap-1">
                <X className="w-3 h-3" weight="light" /> Cancel
              </button>
              <button onClick={handleSave} disabled={saving || !formTitle.trim() || !formBody.trim()} className="btn-green btn-sm flex items-center gap-1">
                <FloppyDisk className="w-3 h-3" weight="light" /> {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <SpinnerGap className="w-5 h-5 text-[#6b8aff] animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Megaphone className="w-8 h-8 text-white/10 mb-2" weight="light" />
          <p className="text-[11px] text-[var(--text-label)]">No announcements yet — check back soon!</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {posts.map(post => {
            const isExpanded = expandedId === post.id;
            return (
              <div
                key={post.id}
                className="px-5 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors duration-100 group cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : post.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {post.pinned && <PushPin className="w-3 h-3 text-amber-400 shrink-0" weight="light" />}
                      <h4 className="text-[12px] font-semibold text-white truncate">{post.title}</h4>
                    </div>
                    <p className={`text-[11px] text-[var(--text-secondary)] mb-1 ${isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>{post.body}</p>
                    <div className="flex items-center gap-2 text-[10px] text-[var(--text-label)]">
                      <span>{post.authorCallsign}</span>
                      <span className="text-white/10">|</span>
                      <span>{relativeTime(post.createdAt)}</span>
                      {isExpanded && post.updatedAt !== post.createdAt && (
                        <>
                          <span className="text-white/10">|</span>
                          <span>edited {relativeTime(post.updatedAt)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {isAdmin && editing === null && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => startEdit(post)} className="p-1 rounded hover:bg-white/[0.04] text-[var(--text-label)] hover:text-white transition-colors">
                        <PencilSimple className="w-3 h-3" weight="light" />
                      </button>
                      <button onClick={() => handleDelete(post.id)} className="p-1 rounded hover:bg-red-500/10 text-[var(--text-label)] hover:text-red-400 transition-colors">
                        <Trash className="w-3 h-3" weight="light" />
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
  const [bids, setBids] = useState<ActiveBidEntry[]>([]);
  const [recentFlights, setRecentFlights] = useState<LogbookEntry[]>([]);
  const [activeFlights, setActiveFlights] = useState<ActiveFlightHeartbeat[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore(s => s.user);
  const isAdmin = user?.role === 'admin';
  const socket = useSocketStore(s => s.socket);

  const fetchBids = useCallback(() => {
    api.get<AllBidsResponse>('/api/bids/all')
      .then(data => setBids(data.bids))
      .catch(() => {});
  }, []);

  // Subscribe to flights:active for real-time phase data
  useEffect(() => {
    if (!socket) return;

    socket.emit('telemetry:subscribe');

    const handleActiveFlights = (flights: ActiveFlightHeartbeat[]) => {
      setActiveFlights(flights);
    };

    socket.on('flights:active', handleActiveFlights);

    return () => {
      socket.off('flights:active', handleActiveFlights);
      socket.emit('telemetry:unsubscribe');
    };
  }, [socket]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<AllBidsResponse>('/api/bids/all'),
      api.get<LogbookListResponse>('/api/logbook?pageSize=5').catch(() => ({ entries: [] as LogbookEntry[], total: 0, page: 1, pageSize: 5 })),
    ]).then(([bidsData, logbookData]) => {
      setBids(bidsData.bids);
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
        <SpinnerGap className="w-6 h-6 text-[#6b8aff] animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 overflow-auto h-full">
      {/* Quick Actions strip */}
      <QuickActions />

      {/* Row 2: Active Bids — primary operational view (full width) */}
      <ActiveBidsCard bids={bids} isAdmin={!!isAdmin} onBidRemoved={fetchBids} activeFlights={activeFlights} />

      {/* Row 3: Network Map (full width, hero) */}
      <NetworkMapPreview activeFlights={activeFlights} />

      {/* Row 4: Announcements + My Info */}
      <div className="grid grid-cols-[1fr_440px] gap-4">
        <NewsFeed />
        <MyInfoCard recentFlights={recentFlights} />
      </div>

      {/* Row 5: Pilot Leaderboard (full width) */}
      <PilotLeaderboard />
    </div>
  );
}
