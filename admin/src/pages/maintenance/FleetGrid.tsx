import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Settings, Wrench } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { formatHours } from '@/lib/formatters';

// ── Types ────────────────────────────────────────────────────

interface CheckDueStatus {
  checkType: string;
  dueAtHours: number | null;
  dueAtCycles: number | null;
  dueAtDate: string | null;
  currentHours: number;
  currentCycles: number;
  isOverdue: boolean;
  isInOverflight: boolean;
  remainingHours: number | null;
  remainingCycles: number | null;
  overflightPct: number;
  estimatedCost?: number;
}

interface FleetMaintenanceStatus {
  aircraftId: number;
  registration: string;
  icaoType: string;
  name: string;
  status: string;
  totalHours: number;
  totalCycles: number;
  checksDue: CheckDueStatus[];
  hasOverdueChecks: boolean;
  hasOverdueADs: boolean;
  hasExpiredMEL: boolean;
  openDiscrepancies: number;
  activeMELs: number;
  nextCheckType: string | null;
  nextCheckDueIn: number | null;
  maintenanceReserveBalance?: number;
  reserveRatePerHour?: number;
}

interface FleetGridProps {
  onSelectAircraft: (aircraftId: number) => void;
  onConfig?: (tab: string) => void;
}

// ── Status helpers ───────────────────────────────────────────

type AircraftStatusCategory = 'airworthy' | 'mel' | 'in-check' | 'aog';

function getStatusCategory(aircraft: FleetMaintenanceStatus): AircraftStatusCategory {
  if (aircraft.hasOverdueChecks || aircraft.hasOverdueADs || aircraft.hasExpiredMEL || aircraft.status === 'aog') {
    return 'aog';
  }
  if (aircraft.status === 'maintenance') {
    return 'in-check';
  }
  if (aircraft.activeMELs > 0) {
    return 'mel';
  }
  return 'airworthy';
}

function getStatusDotColor(category: AircraftStatusCategory): string {
  switch (category) {
    case 'airworthy': return 'var(--accent-emerald)';
    case 'mel': return 'var(--accent-amber)';
    case 'in-check': return 'var(--accent-cyan)';
    case 'aog': return 'var(--accent-red)';
  }
}

function getStatusLabel(category: AircraftStatusCategory): string {
  switch (category) {
    case 'airworthy': return 'Airworthy';
    case 'mel': return 'MEL Dispatch';
    case 'in-check': return 'In Check';
    case 'aog': return 'AOG';
  }
}

function getStatusBadgeStyle(category: AircraftStatusCategory): { bg: string; text: string } {
  switch (category) {
    case 'airworthy': return { bg: 'var(--accent-emerald-bg)', text: 'var(--accent-emerald)' };
    case 'mel': return { bg: 'var(--accent-amber-bg)', text: 'var(--accent-amber)' };
    case 'in-check': return { bg: 'var(--accent-cyan-bg)', text: 'var(--accent-cyan)' };
    case 'aog': return { bg: 'var(--accent-red-bg)', text: 'var(--accent-red)' };
  }
}

function getCardTint(category: AircraftStatusCategory): string {
  switch (category) {
    case 'airworthy': return 'rgba(74, 222, 128, 0.02)';
    case 'mel': return 'rgba(251, 191, 36, 0.02)';
    case 'in-check': return 'rgba(34, 211, 238, 0.02)';
    case 'aog': return 'rgba(248, 113, 113, 0.02)';
  }
}

// ── Badge sub-component ──────────────────────────────────────

function MicroBadge({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 5px',
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: '0.03em',
        lineHeight: '14px',
        background: bg,
        color: text,
        whiteSpace: 'nowrap',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </span>
  );
}

// ── Loading skeleton ─────────────────────────────────────────

function GridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2" style={{ padding: '16px 24px' }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 130,
            border: '1px solid var(--border-primary)',
            background: 'var(--surface-0)',
          }}
          className="animate-pulse"
        />
      ))}
    </div>
  );
}

// ── Main FleetGrid ───────────────────────────────────────────

export function FleetGrid({ onSelectAircraft, onConfig }: FleetGridProps) {
  const [fleet, setFleet] = useState<FleetMaintenanceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchFleet = useCallback(async () => {
    try {
      const res = await api.get<{ fleet: FleetMaintenanceStatus[] }>('/api/admin/maintenance/fleet-status');
      setFleet(res.fleet);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load fleet status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFleet(); }, [fetchFleet]);

  const filtered = useMemo(() => {
    if (!search) return fleet;
    const q = search.toLowerCase();
    return fleet.filter(
      (a) =>
        a.registration.toLowerCase().includes(q) ||
        a.icaoType.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q),
    );
  }, [fleet, search]);

  // Summary counts
  const counts = useMemo(() => {
    let airworthy = 0, mel = 0, inCheck = 0, aog = 0;
    for (const a of fleet) {
      const cat = getStatusCategory(a);
      if (cat === 'airworthy') airworthy++;
      else if (cat === 'mel') mel++;
      else if (cat === 'in-check') inCheck++;
      else if (cat === 'aog') aog++;
    }
    return { airworthy, mel, inCheck, aog, total: fleet.length };
  }, [fleet]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <FleetHeader search={search} onSearch={setSearch} onConfig={onConfig} counts={null} />
        <GridSkeleton />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <FleetHeader search={search} onSearch={setSearch} onConfig={onConfig} counts={counts} />

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
            {search ? 'No aircraft match your search' : 'No aircraft in fleet'}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {filtered.map((aircraft) => (
              <AircraftCard
                key={aircraft.aircraftId}
                aircraft={aircraft}
                onClick={() => onSelectAircraft(aircraft.aircraftId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Header ───────────────────────────────────────────────────

interface FleetHeaderProps {
  search: string;
  onSearch: (v: string) => void;
  onConfig?: (tab: string) => void;
  counts: { airworthy: number; mel: number; inCheck: number; aog: number; total: number } | null;
}

function FleetHeader({ search, onSearch, onConfig, counts }: FleetHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        borderBottom: '1px solid var(--border-primary)',
      }}
    >
      {/* Left: title + summary badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div>
          <span
            className="text-subheading"
            style={{ fontSize: 11, letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}
          >
            MAINTENANCE
          </span>
          <span
            style={{ color: 'var(--text-quaternary)', margin: '0 8px', fontSize: 11 }}
          >
            /
          </span>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }}>
            Fleet Overview
          </span>
        </div>

        {counts && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MicroBadge
              label={`${counts.airworthy} AWY`}
              bg="var(--accent-emerald-bg)"
              text="var(--accent-emerald)"
            />
            {counts.mel > 0 && (
              <MicroBadge
                label={`${counts.mel} MEL`}
                bg="var(--accent-amber-bg)"
                text="var(--accent-amber)"
              />
            )}
            {counts.inCheck > 0 && (
              <MicroBadge
                label={`${counts.inCheck} CHK`}
                bg="var(--accent-cyan-bg)"
                text="var(--accent-cyan)"
              />
            )}
            {counts.aog > 0 && (
              <MicroBadge
                label={`${counts.aog} AOG`}
                bg="var(--accent-red-bg)"
                text="var(--accent-red)"
              />
            )}
          </div>
        )}
      </div>

      {/* Right: search + config buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ position: 'relative', width: 180 }}>
          <Search
            size={13}
            style={{
              position: 'absolute',
              left: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
            }}
          />
          <input
            type="text"
            placeholder="Search fleet..."
            aria-label="Search fleet"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="input-glow"
            style={{
              width: '100%',
              height: 28,
              paddingLeft: 26,
              paddingRight: 8,
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              color: 'var(--text-primary)',
              fontSize: 11,
              outline: 'none',
            }}
          />
        </div>

        {onConfig && (
          <>
            <button
              onClick={() => onConfig('checks')}
              className="btn-glow"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                height: 28,
                padding: '0 10px',
                border: '1px solid var(--border-primary)',
                background: 'transparent',
                color: 'var(--text-tertiary)',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Wrench size={12} />
              Checks
            </button>
            <button
              onClick={() => onConfig('settings')}
              className="btn-glow"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                height: 28,
                padding: '0 10px',
                border: '1px solid var(--border-primary)',
                background: 'transparent',
                color: 'var(--text-tertiary)',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Settings size={12} />
              Config
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Aircraft Card ────────────────────────────────────────────

function AircraftCard({ aircraft, onClick }: { aircraft: FleetMaintenanceStatus; onClick: () => void }) {
  const category = getStatusCategory(aircraft);
  const dotColor = getStatusDotColor(category);
  const statusBadge = getStatusBadgeStyle(category);
  const tint = getCardTint(category);

  return (
    <button
      onClick={onClick}
      className="card-interactive"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '12px 14px',
        border: '1px solid var(--border-primary)',
        background: tint,
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'border-color 200ms ease, box-shadow 200ms ease',
      }}
    >
      {/* Top row: reg + status dot */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span
          className="data-md"
          style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15, letterSpacing: '0.04em' }}
        >
          {aircraft.registration}
        </span>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: dotColor,
            flexShrink: 0,
            boxShadow: `0 0 6px ${dotColor}`,
          }}
        />
      </div>

      {/* Type + name */}
      <div style={{ marginBottom: 6 }}>
        <span className="data-xs" style={{ color: 'var(--text-tertiary)' }}>
          {aircraft.icaoType}
        </span>
        <span style={{ color: 'var(--text-quaternary)', margin: '0 4px', fontSize: 9 }}>
          ·
        </span>
        <span style={{ color: 'var(--text-quaternary)', fontSize: 10 }}>
          {aircraft.name}
        </span>
      </div>

      {/* Hours / cycles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <span className="data-xs" style={{ color: 'var(--text-tertiary)' }}>
          {formatHours(aircraft.totalHours)} hrs
        </span>
        <span className="data-xs" style={{ color: 'var(--text-tertiary)' }}>
          {aircraft.totalCycles.toLocaleString()} cyc
        </span>
      </div>

      {/* Bottom badges row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        {/* Status badge */}
        <MicroBadge
          label={getStatusLabel(category)}
          bg={statusBadge.bg}
          text={statusBadge.text}
        />

        {/* MEL count if dispatching with MELs */}
        {category === 'mel' && aircraft.activeMELs > 0 && (
          <MicroBadge
            label={`${aircraft.activeMELs} MEL`}
            bg="var(--accent-amber-bg)"
            text="var(--accent-amber)"
          />
        )}

        {/* Open discrepancies */}
        {aircraft.openDiscrepancies > 0 && (
          <MicroBadge
            label={`${aircraft.openDiscrepancies} DISCREP`}
            bg="var(--accent-red-bg)"
            text="var(--accent-red)"
          />
        )}

        {/* Next check type + remaining hours */}
        {aircraft.nextCheckType && (
          <MicroBadge
            label={`${aircraft.nextCheckType}${aircraft.nextCheckDueIn != null ? ` ${formatHours(aircraft.nextCheckDueIn)}h` : ''}`}
            bg="var(--accent-blue-bg)"
            text="var(--accent-blue-bright)"
          />
        )}
      </div>
    </button>
  );
}
