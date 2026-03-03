import { useState, useEffect, useCallback } from 'react';
import {
  AirplaneTakeoff,
  AirplaneTilt,
  ArrowRight,
  Clock,
  ClipboardText,
  CurrencyDollar,
  Gauge,
  Heartbeat,
  NavigationArrow,
} from '@phosphor-icons/react';
import type { ActiveFlightHeartbeat } from '@acars/shared';
import { Globe } from '@/components/dashboard/Globe';
import { StatCard, StatusBadge } from '@/components/primitives';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useSocketStore } from '@/stores/socketStore';
import { useSocket } from '@/hooks/useSocket';

// ── Types ──────────────────────────────────────────────

interface RecentFlight {
  id: number;
  flightNumber: string;
  depIcao: string;
  arrIcao: string;
  status: string;
  pilotCallsign: string;
  landingRate: number | null;
  createdAt: string;
}

interface DashboardData {
  activeFlights: number;
  pendingPireps: number;
  fleetHealthPct: number;
  monthlyRevenue: number;
  recentFlights: RecentFlight[];
}

// ── Helpers ────────────────────────────────────────────

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function landingRateColor(fpm: number): string {
  const abs = Math.abs(fpm);
  if (abs <= 150) return 'text-[var(--accent-emerald)]';
  if (abs <= 300) return 'text-[var(--accent-amber)]';
  return 'text-[var(--accent-red)]';
}

function formatRevenue(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`;
}

// ── Component ──────────────────────────────────────────

export function DashboardPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { connect, connected } = useSocketStore();
  const [recentFlights, setRecentFlights] = useState<RecentFlight[]>([]);
  const [activeFlights, setActiveFlights] = useState<ActiveFlightHeartbeat[]>([]);
  const [stats, setStats] = useState({
    activeFlights: 0,
    pendingPireps: 0,
    fleetHealthPct: 0,
    monthlyRevenue: 0,
  });

  // Connect socket
  useEffect(() => {
    if (accessToken && !connected) {
      connect(accessToken);
    }
  }, [accessToken, connected, connect]);

  // Subscribe to live flights
  useSocket<ActiveFlightHeartbeat[]>('flights:active', (data) => {
    setActiveFlights(data);
  }, {
    subscribeEvent: 'livemap:subscribe',
    unsubscribeEvent: 'livemap:unsubscribe',
  });

  // Fetch dashboard data
  const fetchDashboard = useCallback(async () => {
    try {
      const data = await api.get<DashboardData>('/api/admin/dashboard');
      setRecentFlights(data.recentFlights);
      setStats({
        activeFlights: data.activeFlights,
        pendingPireps: data.pendingPireps,
        fleetHealthPct: data.fleetHealthPct,
        monthlyRevenue: data.monthlyRevenue,
      });
    } catch {
      // silently fail — globe still renders
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const hasActive = activeFlights.length > 0;

  return (
    <div className="-m-6 h-[calc(100%+3rem)] relative overflow-hidden">
      {/* Globe background — isolate keeps CSS2D labels inside this stacking context */}
      <div className="absolute inset-0 isolate">
        <Globe />
      </div>

      {/* Bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-4 flex flex-col gap-3">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard
            icon={AirplaneTakeoff}
            label="Active Flights"
            value={stats.activeFlights}
            accent="emerald"
            className="bg-[var(--surface-2)]/90"
          />
          <StatCard
            icon={ClipboardText}
            label="Pending PIREPs"
            value={stats.pendingPireps}
            accent="amber"
            className="bg-[var(--surface-2)]/90"
          />
          <StatCard
            icon={Heartbeat}
            label="Fleet Health"
            value={`${stats.fleetHealthPct}%`}
            accent="blue"
            className="bg-[var(--surface-2)]/90"
          />
          <StatCard
            icon={CurrencyDollar}
            label="Monthly Revenue"
            value={formatRevenue(stats.monthlyRevenue)}
            accent="cyan"
            className="bg-[var(--surface-2)]/90"
          />
        </div>

        {/* Panels row */}
        <div className="flex gap-3 items-stretch h-[260px]">
          {/* ── Recent Flights ─────────────────────── */}
          <div className="flex-1 rounded-md bg-[var(--surface-0)]/95 border border-[var(--border-primary)] border-l-[3px] border-l-[var(--accent-blue)] flex flex-col overflow-hidden min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 shrink-0 bg-[var(--surface-0)]/60">
              <div className="flex items-center gap-2">
                <AirplaneTakeoff size={14} weight="duotone" className="text-[var(--accent-blue)]" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                  Recent Flights
                </h2>
              </div>
              <span className="text-[11px] font-mono text-[var(--accent-blue)]/70">
                {recentFlights.length} flights
              </span>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-[1fr_1.2fr_0.8fr_0.7fr_0.6fr_0.6fr] gap-2 px-4 py-1.5 text-[10px] uppercase tracking-wider text-[var(--text-quaternary)] bg-[var(--surface-0)]/40 shrink-0 border-b border-[var(--border-primary)]/30">
              <span>Flight</span>
              <span>Route</span>
              <span>Pilot</span>
              <span>Status</span>
              <span className="text-right">Landing</span>
              <span className="text-right">Time</span>
            </div>

            {/* Scrollable rows */}
            <div className="flex-1 overflow-y-auto pb-1">
              {recentFlights.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-[var(--text-quaternary)]">
                  No recent flights
                </div>
              ) : (
                recentFlights.map((f, i) => (
                  <div
                    key={f.id}
                    className={`grid grid-cols-[1fr_1.2fr_0.8fr_0.7fr_0.6fr_0.6fr] gap-2 px-4 py-1.5 items-center border-b border-[var(--border-primary)]/10 ${
                      i % 2 === 0 ? 'bg-transparent' : 'bg-[var(--surface-1)]/30'
                    }`}
                  >
                    <span className="font-mono text-[11px] font-semibold text-[var(--text-primary)] truncate">
                      {f.flightNumber}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] truncate">
                      <span className="font-mono font-medium text-[var(--accent-blue)]">{f.depIcao}</span>
                      <ArrowRight size={10} className="text-[var(--text-quaternary)] shrink-0" />
                      <span className="font-mono font-medium text-[var(--accent-cyan)]">{f.arrIcao}</span>
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)] truncate">{f.pilotCallsign}</span>
                    <span><StatusBadge status={f.status} /></span>
                    <span className={`text-[11px] font-mono text-right ${f.landingRate != null ? landingRateColor(f.landingRate) : 'text-[var(--text-quaternary)]'}`}>
                      {f.landingRate != null ? `${Math.abs(f.landingRate)}` : '\u2014'}
                      {f.landingRate != null && (
                        <span className="opacity-50 text-[9px] ml-0.5">fpm</span>
                      )}
                    </span>
                    <span className="text-[10px] text-right text-[var(--text-quaternary)]">
                      {timeAgo(f.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Active Flights (conditional) ────────── */}
          {hasActive && (
            <div className="w-64 shrink-0 rounded-md bg-[var(--surface-0)]/95 border border-[var(--border-primary)] border-l-[3px] border-l-[var(--accent-emerald)] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2.5 shrink-0 bg-[var(--accent-emerald)]/5">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-emerald)] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent-emerald)]" />
                  </span>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    Active
                  </h2>
                </div>
                <span className="text-[11px] font-mono font-semibold text-[var(--accent-emerald)]">
                  {activeFlights.length}
                </span>
              </div>

              <div className="mx-3 border-t border-[var(--accent-emerald)]/15" />

              {/* Scrollable flight cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {activeFlights.map((f) => (
                  <div
                    key={f.userId}
                    className="rounded bg-[var(--surface-2)] border border-[var(--border-primary)] px-2.5 py-2"
                  >
                    {/* Top row: callsign + phase */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-[11px] font-semibold text-[var(--text-primary)]">
                        {f.callsign}
                      </span>
                      <StatusBadge status={f.phase} />
                    </div>

                    {/* Aircraft type */}
                    <div className="flex items-center gap-1 mb-1.5">
                      <AirplaneTilt size={11} weight="duotone" className="text-[var(--accent-blue)]/50" />
                      <span className="text-[10px] text-[var(--text-tertiary)]">{f.aircraftType}</span>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="flex items-center gap-0.5" title="Altitude">
                        <Gauge size={10} className="text-[var(--accent-amber)]/60" />
                        <span className="font-mono text-[var(--text-secondary)]">{f.altitude > 0 ? `FL${Math.round(f.altitude / 100)}` : 'GND'}</span>
                      </span>
                      <span className="flex items-center gap-0.5" title="Ground speed">
                        <Clock size={10} className="text-[var(--accent-cyan)]/60" />
                        <span className="font-mono text-[var(--text-secondary)]">{Math.round(f.groundSpeed)} kts</span>
                      </span>
                      <span className="flex items-center gap-0.5" title="Heading">
                        <NavigationArrow
                          size={10}
                          className="text-[var(--accent-emerald)]/60"
                          style={{ transform: `rotate(${f.heading}deg)` }}
                        />
                        <span className="font-mono text-[var(--text-secondary)]">{Math.round(f.heading)}&deg;</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
