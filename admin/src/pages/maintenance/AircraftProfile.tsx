import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { formatHours } from '@/lib/formatters';
import { fadeUp } from '@/lib/motion';
import { WorkOrderBanner } from './WorkOrderBanner';
import { AircraftLogbook } from './AircraftLogbook';
import { DiscrepanciesTab } from './DiscrepanciesTab';
import { AdsTab } from './AdsTab';
import { MelDeferralsTab } from './MelDeferralsTab';

// ── Types ────────────────────────────────────────────────────

interface FleetMaintenanceStatus {
  aircraftId: number;
  registration: string;
  icaoType: string;
  name: string;
  status: string;
  totalHours: number;
  totalCycles: number;
  checksDue: unknown[];
  hasOverdueChecks: boolean;
  hasOverdueADs: boolean;
  hasExpiredMEL: boolean;
  openDiscrepancies: number;
  activeMELs: number;
  nextCheckType: string | null;
  nextCheckDueIn: number | null;
}

type ProfileTab = 'logbook' | 'discrepancies' | 'mel' | 'checks' | 'ads' | 'components';

interface AircraftProfileProps {
  aircraftId: number;
  onBack: () => void;
}

// ── Status Badge ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase().replace(/_/g, ' ');
  let bg = 'var(--surface-2)';
  let text = 'var(--text-secondary)';

  if (normalized === 'active' || normalized === 'ok' || normalized === 'serviceable') {
    bg = 'var(--accent-emerald-bg)';
    text = 'var(--accent-emerald)';
  } else if (normalized === 'grounded' || normalized === 'critical') {
    bg = 'var(--accent-red-bg)';
    text = 'var(--accent-red)';
  } else if (normalized === 'maintenance') {
    bg = 'var(--accent-amber-bg)';
    text = 'var(--accent-amber)';
  }

  const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 600,
        lineHeight: '16px',
        background: bg,
        color: text,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

// ── Tab definitions ──────────────────────────────────────────

const TABS: { key: ProfileTab; label: string }[] = [
  { key: 'logbook', label: 'Logbook' },
  { key: 'discrepancies', label: 'Discrepancies' },
  { key: 'mel', label: 'MEL Deferrals' },
  { key: 'checks', label: 'Checks' },
  { key: 'ads', label: 'ADs' },
  { key: 'components', label: 'Components' },
];

// ═════════════════════════════════════════════════════════════
// AircraftProfile
// ═════════════════════════════════════════════════════════════

export function AircraftProfile({ aircraftId, onBack }: AircraftProfileProps) {
  const [aircraft, setAircraft] = useState<FleetMaintenanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>('logbook');
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchAircraft = useCallback(async () => {
    try {
      const res = await api.get<{ fleet: FleetMaintenanceStatus[] }>('/api/admin/maintenance/fleet-status');
      const found = res.fleet.find((a) => a.aircraftId === aircraftId);
      setAircraft(found ?? null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load aircraft');
    } finally {
      setLoading(false);
    }
  }, [aircraftId]);

  useEffect(() => {
    fetchAircraft();
  }, [fetchAircraft, refreshKey]);

  function handleWorkOrderAccepted() {
    setRefreshKey((k) => k + 1);
  }

  // ── Loading state ────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 42,
              background: 'transparent',
              border: '1px solid var(--panel-border)',
              marginBottom: 4,
              opacity: 0.5,
            }}
            className="animate-pulse"
          />
        ))}
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────

  if (!aircraft) {
    return (
      <div style={{ padding: 24 }}>
        <button onClick={onBack} style={backButtonStyle}>
          <ArrowLeft size={14} /> Fleet
        </button>
        <p style={{ color: 'var(--text-tertiary)', marginTop: 16, fontSize: 13 }}>
          Aircraft not found.
        </p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <motion.div
      className="flex flex-col h-full"
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      style={{ background: 'var(--surface-0)' }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 24px 0',
          borderBottom: '1px solid var(--border-primary)',
        }}
      >
        {/* Back link */}
        <button onClick={onBack} style={backButtonStyle}>
          <ArrowLeft size={14} /> Fleet
        </button>

        {/* Aircraft info row */}
        <div
          className="flex items-center justify-between"
          style={{ padding: '12px 0 0' }}
        >
          {/* Left: Registration + type */}
          <div className="flex items-center" style={{ gap: 12 }}>
            <span
              className="font-mono"
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '0.02em',
              }}
            >
              {aircraft.registration}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
              <span className="font-mono" style={{ fontWeight: 500 }}>{aircraft.icaoType}</span>
              <span style={{ margin: '0 6px' }}>&middot;</span>
              {aircraft.name}
            </span>
          </div>

          {/* Right: Hours / Cycles / Status */}
          <div className="flex items-center" style={{ gap: 16 }}>
            <div className="flex flex-col items-end" style={{ gap: 1 }}>
              <span style={{ fontSize: 10, color: 'var(--text-quaternary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Hours
              </span>
              <span className="font-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {formatHours(aircraft.totalHours)}
              </span>
            </div>
            <div className="flex flex-col items-end" style={{ gap: 1 }}>
              <span style={{ fontSize: 10, color: 'var(--text-quaternary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Cycles
              </span>
              <span className="font-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {aircraft.totalCycles.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col items-end" style={{ gap: 1 }}>
              <span style={{ fontSize: 10, color: 'var(--text-quaternary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Status
              </span>
              <StatusBadge status={aircraft.status} />
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div
          className="flex"
          style={{
            gap: 0,
            marginTop: 12,
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.key
                  ? '2px solid var(--accent-blue)'
                  : '2px solid transparent',
                padding: '6px 14px',
                fontSize: 11,
                fontWeight: 500,
                color: activeTab === tab.key
                  ? 'var(--accent-blue)'
                  : 'var(--text-quaternary)',
                cursor: 'pointer',
                transition: 'color 120ms',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Work order banner (if active) */}
      <WorkOrderBanner aircraftId={aircraftId} onAccept={handleWorkOrderAccepted} />

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'logbook' && (
          <AircraftLogbook aircraftId={aircraftId} />
        )}
        {activeTab === 'discrepancies' && (
          <DiscrepanciesTab aircraftId={aircraftId} />
        )}
        {activeTab === 'mel' && (
          <MelDeferralsTab aircraftId={aircraftId} />
        )}
        {activeTab === 'checks' && (
          <TabPlaceholder tab="Checks" aircraftId={aircraftId} />
        )}
        {activeTab === 'ads' && (
          <AdsTab aircraftId={aircraftId} />
        )}
        {activeTab === 'components' && (
          <TabPlaceholder tab="Components" aircraftId={aircraftId} />
        )}
      </div>
    </motion.div>
  );
}

// ── Placeholder for tabs not yet wired ───────────────────────

function TabPlaceholder({ tab, aircraftId }: { tab: string; aircraftId: number }) {
  return (
    <div
      style={{
        padding: '32px 24px',
        color: 'var(--text-quaternary)',
        fontSize: 13,
      }}
    >
      <span style={{ fontWeight: 500 }}>{tab}</span> tab — aircraftId: {aircraftId}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────

const backButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: 'none',
  border: 'none',
  color: 'var(--accent-blue)',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  padding: 0,
};
