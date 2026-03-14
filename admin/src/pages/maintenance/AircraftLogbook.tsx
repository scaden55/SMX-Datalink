import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, AlertTriangle, Clock, ChevronDown } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { fadeUp, tableContainer, tableRow } from '@/lib/motion';

// ── Types ────────────────────────────────────────────────────

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
}

interface CheckDueStatus {
  checkType: 'A' | 'B' | 'C' | 'D';
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
}

interface TimelineEntry {
  type: 'discrepancy' | 'mel_deferral' | 'maintenance' | 'ad_compliance';
  id: number;
  date: string;
  title: string;
  description: string;
  status: string;
  ata_chapter: string | null;
}

interface MELDeferral {
  id: number;
  aircraftId: number;
  itemNumber: string;
  title: string;
  category: string;
  deferralDate: string;
  expiryDate: string;
  rectifiedDate: string | null;
  status: string;
  remarks: string | null;
  ataChapter?: string | null;
}

interface AirworthinessDirective {
  id: number;
  aircraftId: number;
  adNumber: string;
  title: string;
  description: string | null;
  complianceStatus: string;
  complianceDate: string | null;
  nextDueHours: number | null;
  nextDueDate: string | null;
}

interface AircraftComponent {
  id: number;
  aircraftId: number;
  componentType: string;
  position: string | null;
  serialNumber: string | null;
  partNumber: string | null;
  hoursSinceNew: number;
  cyclesSinceNew: number;
  hoursSinceOverhaul: number;
  cyclesSinceOverhaul: number;
  overhaulIntervalHours: number | null;
  installedDate: string | null;
  status: string;
  remarks: string | null;
}

// ── Style constants ──────────────────────────────────────────

const colHeaderStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: 0.8,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  padding: '10px 16px',
  borderBottom: '1px solid var(--border-primary)',
  userSelect: 'none',
};

const cellStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderBottom: '1px solid var(--border-primary)',
  fontSize: 12,
  color: 'var(--text-secondary)',
  verticalAlign: 'middle',
};

// ── Helpers ──────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatHours(h: number | null): string {
  if (h === null || h === undefined) return '--';
  return h.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase().replace(/_/g, ' ');
  let bg = 'var(--surface-2)';
  let text = 'var(--text-secondary)';

  if (normalized === 'completed' || normalized === 'active' || normalized === 'ok' || normalized === 'rectified' || normalized === 'installed') {
    bg = 'var(--accent-emerald-bg)';
    text = 'var(--accent-emerald)';
  } else if (normalized === 'overdue' || normalized === 'critical' || normalized === 'expired' || normalized === 'grounded' || normalized === 'scrapped') {
    bg = 'var(--accent-red-bg)';
    text = 'var(--accent-red)';
  } else if (normalized === 'scheduled' || normalized === 'open' || normalized === 'complied' || normalized === 'not applicable') {
    bg = 'var(--accent-blue-bg)';
    text = 'var(--accent-blue-bright)';
  } else if (normalized === 'in progress' || normalized === 'deferred' || normalized === 'maintenance' || normalized === 'warning' || normalized === 'recurring' || normalized === 'removed' || normalized === 'in shop') {
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
        borderRadius: 3,
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

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    A: { bg: 'var(--accent-red-bg)', text: 'var(--accent-red)' },
    B: { bg: 'var(--accent-amber-bg)', text: 'var(--accent-amber)' },
    C: { bg: 'var(--accent-blue-bg)', text: 'var(--accent-blue-bright)' },
    D: { bg: 'var(--accent-emerald-bg)', text: 'var(--accent-emerald)' },
  };
  const c = colors[category] ?? { bg: 'var(--surface-2)', text: 'var(--text-secondary)' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 20,
        borderRadius: 3,
        fontSize: 11,
        fontWeight: 700,
        background: c.bg,
        color: c.text,
      }}
    >
      {category}
    </span>
  );
}

// ── Sub-tab type ─────────────────────────────────────────────

type SubTab = 'timeline' | 'checks' | 'mels' | 'ads' | 'components';

// ── Component Props ──────────────────────────────────────────

interface AircraftLogbookProps {
  aircraftId: number;
  onBack: () => void;
}

// ═════════════════════════════════════════════════════════════
// AircraftLogbook
// ═════════════════════════════════════════════════════════════

export function AircraftLogbook({ aircraftId, onBack }: AircraftLogbookProps) {
  const [aircraft, setAircraft] = useState<FleetMaintenanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<SubTab>('timeline');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api.get<{ fleet: FleetMaintenanceStatus[] }>('/api/admin/maintenance/fleet-status');
        if (cancelled) return;
        const found = res.fleet.find((a) => a.aircraftId === aircraftId);
        setAircraft(found ?? null);
      } catch (err) {
        if (!cancelled) toast.error(err instanceof ApiError ? err.message : 'Failed to load aircraft');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [aircraftId]);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{ height: 42, background: 'var(--surface-2)', borderRadius: 4, marginBottom: 4, opacity: 0.5 }}
            className="animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!aircraft) {
    return (
      <div style={{ padding: 24 }}>
        <button onClick={onBack} style={backButtonStyle}>
          <ArrowLeft size={14} /> Fleet Status
        </button>
        <p style={{ color: 'var(--text-tertiary)', marginTop: 16 }}>Aircraft not found.</p>
      </div>
    );
  }

  const subTabs: { key: SubTab; label: string }[] = [
    { key: 'timeline', label: 'Timeline' },
    { key: 'checks', label: 'Checks' },
    { key: 'mels', label: 'Active MELs' },
    { key: 'ads', label: 'ADs' },
    { key: 'components', label: 'Components' },
  ];

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible">
      {/* Back button */}
      <div style={{ padding: '12px 24px 0' }}>
        <button onClick={onBack} style={backButtonStyle}>
          <ArrowLeft size={14} /> Fleet Status
        </button>
      </div>

      {/* Aircraft header card */}
      <div
        style={{
          margin: '12px 24px',
          padding: '16px 20px',
          background: 'var(--surface-1)',
          borderRadius: 6,
          border: '1px solid var(--border-primary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
            {aircraft.registration}
          </span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>&middot;</span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
            {aircraft.icaoType}
          </span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>&middot;</span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {aircraft.name}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{formatHours(aircraft.totalHours)}</span> hrs
          </span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>&middot;</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{aircraft.totalCycles.toLocaleString()}</span> cycles
          </span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>&middot;</span>
          <StatusBadge status={aircraft.status} />
        </div>
        {(aircraft.openDiscrepancies > 0 || aircraft.activeMELs > 0) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
            {aircraft.openDiscrepancies > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--accent-amber)' }}>
                <AlertTriangle size={13} />
                {aircraft.openDiscrepancies} open discrepanc{aircraft.openDiscrepancies === 1 ? 'y' : 'ies'}
              </span>
            )}
            {aircraft.activeMELs > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--accent-amber)' }}>
                <Clock size={13} />
                {aircraft.activeMELs} active MEL{aircraft.activeMELs === 1 ? '' : 's'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          padding: '0 24px',
          borderBottom: '1px solid var(--border-primary)',
        }}
      >
        {subTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: subTab === tab.key ? '2px solid var(--accent-blue)' : '2px solid transparent',
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 500,
              color: subTab === tab.key ? 'var(--accent-blue-bright)' : 'var(--text-tertiary)',
              cursor: 'pointer',
              transition: 'color 120ms',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {subTab === 'timeline' && <TimelineSubTab aircraftId={aircraftId} />}
        {subTab === 'checks' && <ChecksSubTab checksDue={aircraft.checksDue} />}
        {subTab === 'mels' && <MelsSubTab aircraftId={aircraftId} />}
        {subTab === 'ads' && <AdsSubTab aircraftId={aircraftId} />}
        {subTab === 'components' && <ComponentsSubTab aircraftId={aircraftId} />}
      </div>
    </motion.div>
  );
}

const backButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: 'none',
  border: 'none',
  color: 'var(--accent-blue-bright)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  padding: 0,
};

// ═════════════════════════════════════════════════════════════
// Timeline Sub-Tab
// ═════════════════════════════════════════════════════════════

function TimelineSubTab({ aircraftId }: { aircraftId: number }) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchTimeline = useCallback(async (pg: number, append: boolean) => {
    try {
      setLoading(true);
      const res = await api.get<{ entries: TimelineEntry[]; total: number }>(
        `/api/admin/maintenance/aircraft/${aircraftId}/timeline?page=${pg}&pageSize=50`,
      );
      setEntries((prev) => (append ? [...prev, ...res.entries] : res.entries));
      setTotal(res.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  }, [aircraftId]);

  useEffect(() => { fetchTimeline(1, false); }, [fetchTimeline]);

  function getDotColor(entry: TimelineEntry): string {
    if (entry.type === 'discrepancy') {
      const s = entry.status.toLowerCase();
      if (s === 'open' || s === 'grounded') return 'var(--accent-red)';
      return 'var(--accent-emerald)';
    }
    if (entry.type === 'mel_deferral') return 'var(--accent-amber)';
    if (entry.type === 'ad_compliance') return 'var(--accent-blue)';
    // maintenance or resolved
    return 'var(--accent-emerald)';
  }

  function getTypeLabel(type: string): string {
    switch (type) {
      case 'discrepancy': return 'Discrepancy';
      case 'mel_deferral': return 'MEL Deferral';
      case 'maintenance': return 'Maintenance';
      case 'ad_compliance': return 'AD Compliance';
      default: return type;
    }
  }

  if (loading && entries.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ height: 52, background: 'var(--surface-2)', borderRadius: 4, marginBottom: 6, opacity: 0.5 }} className="animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
        No timeline entries found
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 24px' }}>
      {entries.map((entry, idx) => (
        <div
          key={`${entry.type}-${entry.id}-${idx}`}
          style={{
            display: 'flex',
            gap: 12,
            padding: '10px 0',
            borderBottom: idx < entries.length - 1 ? '1px solid var(--border-primary)' : 'none',
          }}
        >
          {/* Color dot */}
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: getDotColor(entry),
              marginTop: 5,
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                {entry.title}
              </span>
              <StatusBadge status={entry.status} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
              <span>{formatDate(entry.date)}</span>
              <span>&middot;</span>
              <span>{getTypeLabel(entry.type)}</span>
              {entry.ata_chapter && (
                <>
                  <span>&middot;</span>
                  <span>ATA {entry.ata_chapter}</span>
                </>
              )}
            </div>
            {entry.description && (
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 600 }}>
                {entry.description}
              </p>
            )}
          </div>
        </div>
      ))}

      {entries.length < total && (
        <div style={{ textAlign: 'center', paddingTop: 12 }}>
          <button
            onClick={() => {
              const nextPage = page + 1;
              setPage(nextPage);
              fetchTimeline(nextPage, true);
            }}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: '1px solid var(--border-primary)',
              borderRadius: 6,
              padding: '6px 16px',
              color: 'var(--text-secondary)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <ChevronDown size={14} />
            {loading ? 'Loading...' : `Load more (${entries.length} of ${total})`}
          </button>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Checks Sub-Tab
// ═════════════════════════════════════════════════════════════

function ChecksSubTab({ checksDue }: { checksDue: CheckDueStatus[] }) {
  const checkTypes: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];

  function getCheckColor(check: CheckDueStatus | undefined): string {
    if (!check || check.remainingHours === null) return 'var(--accent-blue)';
    if (check.isOverdue) return 'var(--accent-red)';
    // Compute percentage remaining
    const dueAtHours = check.dueAtHours;
    if (dueAtHours && dueAtHours > 0) {
      const pct = check.remainingHours / dueAtHours;
      if (pct < 0.05) return 'var(--accent-red)';
      if (pct < 0.20) return 'var(--accent-amber)';
    }
    return 'var(--accent-emerald)';
  }

  function getCheckBgColor(check: CheckDueStatus | undefined): string {
    if (!check || check.remainingHours === null) return 'var(--accent-blue-bg)';
    if (check.isOverdue) return 'var(--accent-red-bg)';
    const dueAtHours = check.dueAtHours;
    if (dueAtHours && dueAtHours > 0) {
      const pct = check.remainingHours / dueAtHours;
      if (pct < 0.05) return 'var(--accent-red-bg)';
      if (pct < 0.20) return 'var(--accent-amber-bg)';
    }
    return 'var(--accent-emerald-bg)';
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, padding: '16px 24px' }}>
      {checkTypes.map((type) => {
        const check = checksDue.find((c) => c.checkType === type);
        const color = getCheckColor(check);
        const bgColor = getCheckBgColor(check);

        return (
          <div
            key={type}
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border-primary)',
              borderRadius: 6,
              padding: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  borderRadius: 6,
                  background: bgColor,
                  color: color,
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                {type}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                {type} Check
              </span>
            </div>

            {check ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Remaining</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color }}>
                    {check.remainingHours !== null ? `${formatHours(check.remainingHours)} hrs` : '--'}
                  </span>
                </div>
                {check.dueAtHours !== null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>Due at</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>
                      {formatHours(check.dueAtHours)} hrs
                    </span>
                  </div>
                )}
                {check.remainingCycles !== null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>Cycles remaining</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>
                      {check.remainingCycles.toLocaleString()}
                    </span>
                  </div>
                )}
                {check.dueAtDate && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>Due date</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{formatDate(check.dueAtDate)}</span>
                  </div>
                )}
                {check.isInOverflight && (
                  <div style={{ marginTop: 4 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 8px',
                        borderRadius: 3,
                        fontSize: 10,
                        fontWeight: 600,
                        background: 'var(--accent-amber-bg)',
                        color: 'var(--accent-amber)',
                      }}
                    >
                      <AlertTriangle size={10} /> OVERFLIGHT
                    </span>
                  </div>
                )}
                {check.isOverdue && (
                  <div style={{ marginTop: 4 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 8px',
                        borderRadius: 3,
                        fontSize: 10,
                        fontWeight: 600,
                        background: 'var(--accent-red-bg)',
                        color: 'var(--accent-red)',
                      }}
                    >
                      OVERDUE
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>No schedule configured</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Active MELs Sub-Tab
// ═════════════════════════════════════════════════════════════

function MelsSubTab({ aircraftId }: { aircraftId: number }) {
  const [deferrals, setDeferrals] = useState<MELDeferral[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api.get<{ deferrals: MELDeferral[]; total: number }>(
          `/api/admin/maintenance/mel?aircraftId=${aircraftId}&status=open`,
        );
        if (!cancelled) setDeferrals(res.deferrals);
      } catch (err) {
        if (!cancelled) toast.error(err instanceof ApiError ? err.message : 'Failed to load MEL deferrals');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [aircraftId]);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ height: 42, background: 'var(--surface-2)', borderRadius: 4, marginBottom: 4, opacity: 0.5 }} className="animate-pulse" />
        ))}
      </div>
    );
  }

  if (deferrals.length === 0) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
        No active MEL deferrals
      </div>
    );
  }

  function getRemainingColor(expiryDate: string): string {
    const now = Date.now();
    const expiry = new Date(expiryDate).getTime();
    const remainingMs = expiry - now;
    const hours48 = 48 * 60 * 60 * 1000;
    const days7 = 7 * 24 * 60 * 60 * 1000;
    if (remainingMs < 0) return 'var(--accent-red)';
    if (remainingMs < hours48) return 'var(--accent-red)';
    if (remainingMs < days7) return 'var(--accent-amber)';
    return 'var(--accent-emerald)';
  }

  function getRemainingDays(expiryDate: string): string {
    const now = Date.now();
    const expiry = new Date(expiryDate).getTime();
    const remainingMs = expiry - now;
    if (remainingMs < 0) return 'Expired';
    const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    if (days === 0) return `${hours}h`;
    return `${days}d ${hours}h`;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={colHeaderStyle}>CAT</th>
            <th style={colHeaderStyle}>ITEM #</th>
            <th style={colHeaderStyle}>TITLE</th>
            <th style={colHeaderStyle}>DEFERRED</th>
            <th style={colHeaderStyle}>EXPIRY</th>
            <th style={colHeaderStyle}>REMAINING</th>
            <th style={colHeaderStyle}>STATUS</th>
          </tr>
        </thead>
        <motion.tbody variants={tableContainer} initial="hidden" animate="visible">
          {deferrals.map((mel) => (
            <motion.tr
              key={mel.id}
              variants={tableRow}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <td style={cellStyle}><CategoryBadge category={mel.category} /></td>
              <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-primary)' }}>
                {mel.itemNumber}
              </td>
              <td style={{ ...cellStyle, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {mel.title}
              </td>
              <td style={cellStyle}>{formatDate(mel.deferralDate)}</td>
              <td style={cellStyle}>{formatDate(mel.expiryDate)}</td>
              <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: getRemainingColor(mel.expiryDate) }}>
                {getRemainingDays(mel.expiryDate)}
              </td>
              <td style={cellStyle}><StatusBadge status={mel.status} /></td>
            </motion.tr>
          ))}
        </motion.tbody>
      </table>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// ADs Sub-Tab
// ═════════════════════════════════════════════════════════════

function AdsSubTab({ aircraftId }: { aircraftId: number }) {
  const [directives, setDirectives] = useState<AirworthinessDirective[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api.get<{ directives: AirworthinessDirective[]; total: number }>(
          `/api/admin/maintenance/ads?aircraftId=${aircraftId}`,
        );
        if (!cancelled) setDirectives(res.directives);
      } catch (err) {
        if (!cancelled) toast.error(err instanceof ApiError ? err.message : 'Failed to load ADs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [aircraftId]);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ height: 42, background: 'var(--surface-2)', borderRadius: 4, marginBottom: 4, opacity: 0.5 }} className="animate-pulse" />
        ))}
      </div>
    );
  }

  if (directives.length === 0) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
        No airworthiness directives found
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={colHeaderStyle}>AD NUMBER</th>
            <th style={colHeaderStyle}>TITLE</th>
            <th style={colHeaderStyle}>STATUS</th>
            <th style={colHeaderStyle}>COMPLIANCE DATE</th>
            <th style={colHeaderStyle}>NEXT DUE</th>
          </tr>
        </thead>
        <motion.tbody variants={tableContainer} initial="hidden" animate="visible">
          {directives.map((ad) => (
            <motion.tr
              key={ad.id}
              variants={tableRow}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-primary)' }}>
                {ad.adNumber}
              </td>
              <td style={{ ...cellStyle, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ad.title}
              </td>
              <td style={cellStyle}><StatusBadge status={ad.complianceStatus} /></td>
              <td style={cellStyle}>{formatDate(ad.complianceDate)}</td>
              <td style={cellStyle}>
                {ad.nextDueHours != null ? (
                  <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{formatHours(ad.nextDueHours)} hrs</span>
                ) : ad.nextDueDate ? (
                  formatDate(ad.nextDueDate)
                ) : (
                  '--'
                )}
              </td>
            </motion.tr>
          ))}
        </motion.tbody>
      </table>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Components Sub-Tab
// ═════════════════════════════════════════════════════════════

function ComponentsSubTab({ aircraftId }: { aircraftId: number }) {
  const [components, setComponents] = useState<AircraftComponent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api.get<{ components: AircraftComponent[] }>(
          `/api/admin/maintenance/components?aircraftId=${aircraftId}`,
        );
        if (!cancelled) setComponents(res.components);
      } catch (err) {
        if (!cancelled) toast.error(err instanceof ApiError ? err.message : 'Failed to load components');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [aircraftId]);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ height: 42, background: 'var(--surface-2)', borderRadius: 4, marginBottom: 4, opacity: 0.5 }} className="animate-pulse" />
        ))}
      </div>
    );
  }

  if (components.length === 0) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
        No tracked components
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={colHeaderStyle}>TYPE</th>
            <th style={colHeaderStyle}>POSITION</th>
            <th style={colHeaderStyle}>SERIAL #</th>
            <th style={colHeaderStyle}>HOURS SINCE NEW</th>
            <th style={colHeaderStyle}>STATUS</th>
          </tr>
        </thead>
        <motion.tbody variants={tableContainer} initial="hidden" animate="visible">
          {components.map((comp) => (
            <motion.tr
              key={comp.id}
              variants={tableRow}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <td style={{ ...cellStyle, fontWeight: 600, color: 'var(--text-primary)' }}>
                {comp.componentType.replace(/_/g, ' ')}
              </td>
              <td style={cellStyle}>{comp.position ?? '--'}</td>
              <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>
                {comp.serialNumber ?? '--'}
              </td>
              <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                {formatHours(comp.hoursSinceNew)}
              </td>
              <td style={cellStyle}><StatusBadge status={comp.status} /></td>
            </motion.tr>
          ))}
        </motion.tbody>
      </table>
    </div>
  );
}
