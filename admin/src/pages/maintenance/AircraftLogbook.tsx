import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { formatDate, formatCurrency } from '@/lib/formatters';

// ── Types ────────────────────────────────────────────────────

interface TimelineEntry {
  type: 'discrepancy' | 'mel_deferral' | 'maintenance' | 'ad_compliance';
  id: number;
  date: string;
  title: string;
  description: string;
  status: string;
  ata_chapter: string | null;
}

interface WorkOrder {
  id: number;
  aircraft_id: number;
  discrepancy_id: number;
  ata_chapter: string;
  severity: string;
  station: string | null;
  estimated_hours: number;
  estimated_cost: number;
  actual_cost: number | null;
  started_at: string;
  completed_at: string | null;
  status: 'in_progress' | 'completed' | 'accepted';
  technician_name: string | null;
  corrective_action: string | null;
  authority: string | null;
  created_at: string;
  updated_at: string;
  registration: string;
  ata_title: string | null;
}

/** Unified timeline item after merging API timeline entries + work order events */
interface UnifiedTimelineItem {
  key: string;
  type: string;
  date: string;
  dotColor: string;
  title: string;
  typeLabel: string;
  reference: string | null;
  description: string | null;
  statusLabel: string | null;
  statusColor: string;
  statusBg: string;
}

// ── Helpers ──────────────────────────────────────────────────

function getDotColor(entry: TimelineEntry): string {
  if (entry.type === 'discrepancy') {
    const s = entry.status.toLowerCase();
    if (s === 'open' || s === 'grounded') return 'var(--accent-red)';
    return 'var(--accent-emerald)';
  }
  if (entry.type === 'mel_deferral') return 'var(--accent-amber)';
  if (entry.type === 'ad_compliance') return 'var(--accent-cyan, var(--accent-blue))';
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

function getStatusStyle(status: string): { color: string; bg: string } {
  const normalized = status.toLowerCase().replace(/_/g, ' ');
  if (normalized === 'completed' || normalized === 'active' || normalized === 'ok' || normalized === 'rectified' || normalized === 'installed') {
    return { bg: 'var(--accent-emerald-bg)', color: 'var(--accent-emerald)' };
  }
  if (normalized === 'overdue' || normalized === 'critical' || normalized === 'expired' || normalized === 'grounded' || normalized === 'scrapped') {
    return { bg: 'var(--accent-red-bg)', color: 'var(--accent-red)' };
  }
  if (normalized === 'scheduled' || normalized === 'open' || normalized === 'complied' || normalized === 'not applicable') {
    return { bg: 'var(--accent-blue-bg)', color: 'var(--accent-blue-bright)' };
  }
  if (normalized === 'in progress' || normalized === 'deferred' || normalized === 'maintenance' || normalized === 'warning' || normalized === 'recurring' || normalized === 'removed' || normalized === 'in shop') {
    return { bg: 'var(--accent-amber-bg)', color: 'var(--accent-amber)' };
  }
  return { bg: 'var(--surface-2)', color: 'var(--text-secondary)' };
}

/** Convert API timeline entries into unified items */
function timelineEntryToUnified(entry: TimelineEntry): UnifiedTimelineItem {
  const ss = getStatusStyle(entry.status);
  return {
    key: `${entry.type}-${entry.id}`,
    type: entry.type,
    date: entry.date,
    dotColor: getDotColor(entry),
    title: entry.title,
    typeLabel: getTypeLabel(entry.type),
    reference: entry.ata_chapter ? `ATA ${entry.ata_chapter}` : null,
    description: entry.description || null,
    statusLabel: entry.status,
    statusColor: ss.color,
    statusBg: ss.bg,
  };
}

/** Convert a work order into 1–3 unified timeline items depending on status */
function workOrderToUnifiedItems(wo: WorkOrder): UnifiedTimelineItem[] {
  const items: UnifiedTimelineItem[] = [];
  const ataRef = wo.ata_chapter + (wo.ata_title ? ` — ${wo.ata_title}` : '');

  // 1) Always show "Submitted for Maintenance" event at started_at
  const stationNote = wo.station ? `Station: ${wo.station}` : null;
  const severityNote = wo.severity === 'grounding' ? 'Grounding' : 'Non-grounding';
  const submittedDesc = [severityNote, stationNote].filter(Boolean).join(' · ');

  items.push({
    key: `wo-submit-${wo.id}`,
    type: 'work_order_submit',
    date: wo.started_at,
    dotColor: 'var(--accent-amber)',
    title: 'Submitted for Maintenance',
    typeLabel: 'Work Order',
    reference: `ATA ${ataRef}`,
    description: submittedDesc || null,
    statusLabel: 'In Progress',
    statusColor: 'var(--accent-amber)',
    statusBg: 'var(--accent-amber-bg)',
  });

  // 2) If completed or accepted, show "Repair Complete" event at completed_at
  if ((wo.status === 'completed' || wo.status === 'accepted') && wo.completed_at) {
    const parts: string[] = [];
    if (wo.technician_name) parts.push(`Tech: ${wo.technician_name}`);
    if (wo.corrective_action) parts.push(wo.corrective_action);

    items.push({
      key: `wo-complete-${wo.id}`,
      type: 'work_order_complete',
      date: wo.completed_at,
      dotColor: 'var(--accent-emerald)',
      title: 'Repair Complete',
      typeLabel: 'Work Order',
      reference: `ATA ${ataRef}`,
      description: parts.join(' · ') || null,
      statusLabel: 'Completed',
      statusColor: 'var(--accent-emerald)',
      statusBg: 'var(--accent-emerald-bg)',
    });
  }

  // 3) If accepted, show "Returned to Service" at updated_at
  if (wo.status === 'accepted') {
    const costParts: string[] = [];
    if (wo.actual_cost != null) costParts.push(`Cost: ${formatCurrency(wo.actual_cost)}`);
    if (wo.authority) costParts.push(`Authority: ${wo.authority}`);

    items.push({
      key: `wo-accept-${wo.id}`,
      type: 'work_order_accept',
      date: wo.updated_at,
      dotColor: 'var(--accent-emerald)',
      title: 'Returned to Service',
      typeLabel: 'Work Order',
      reference: `ATA ${ataRef}`,
      description: costParts.join(' · ') || null,
      statusLabel: 'Accepted',
      statusColor: 'var(--accent-emerald)',
      statusBg: 'var(--accent-emerald-bg)',
    });
  }

  return items;
}

// ── Component Props ──────────────────────────────────────────

interface AircraftLogbookProps {
  aircraftId: number;
}

// ═════════════════════════════════════════════════════════════
// AircraftLogbook — Timeline-only view (sub-tab of AircraftProfile)
// ═════════════════════════════════════════════════════════════

export function AircraftLogbook({ aircraftId }: AircraftLogbookProps) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [woLoading, setWoLoading] = useState(true);

  // Fetch timeline entries (paginated)
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

  // Fetch work orders for this aircraft
  const fetchWorkOrders = useCallback(async () => {
    try {
      setWoLoading(true);
      const res = await api.get<WorkOrder[]>(
        `/api/admin/maintenance/work-orders?aircraft_id=${aircraftId}`,
      );
      setWorkOrders(res);
    } catch {
      // Silently fail — work orders are supplementary
      setWorkOrders([]);
    } finally {
      setWoLoading(false);
    }
  }, [aircraftId]);

  useEffect(() => {
    fetchTimeline(1, false);
    fetchWorkOrders();
  }, [fetchTimeline, fetchWorkOrders]);

  // Merge timeline entries + work order events into a single sorted list
  const unified = useMemo(() => {
    const timelineItems = entries.map(timelineEntryToUnified);
    const woItems = workOrders.flatMap(workOrderToUnifiedItems);
    const all = [...timelineItems, ...woItems];
    // Sort descending by date (newest first)
    all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return all;
  }, [entries, workOrders]);

  const isLoading = loading && entries.length === 0 && woLoading;

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 52,
              background: 'transparent',
              border: '1px solid var(--panel-border)',
              borderRadius: 4,
              marginBottom: 6,
              opacity: 0.5,
            }}
            className="animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (unified.length === 0) {
    return (
      <div
        className="text-body"
        style={{
          padding: '40px 24px',
          textAlign: 'center',
          color: 'var(--text-tertiary)',
        }}
      >
        No timeline entries found
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 24px' }}>
      {/* Vertical timeline */}
      <div style={{ position: 'relative', paddingLeft: 20 }}>
        {/* Left border line */}
        <div
          style={{
            position: 'absolute',
            left: 3,
            top: 8,
            bottom: 8,
            width: 2,
            background: 'var(--border-primary)',
          }}
        />

        {unified.map((item, idx) => (
          <div
            key={`${item.key}-${idx}`}
            style={{
              position: 'relative',
              padding: '10px 0',
              borderBottom:
                idx < unified.length - 1
                  ? '1px solid var(--border-primary)'
                  : 'none',
            }}
          >
            {/* Color dot on the left border */}
            <div
              style={{
                position: 'absolute',
                left: -20,
                top: 15,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: item.dotColor,
                border: '2px solid var(--surface-0)',
                zIndex: 1,
              }}
            />

            {/* Content */}
            <div style={{ minWidth: 0 }}>
              {/* Row 1: Title + Status badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginBottom: 2,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    className="text-caption"
                    style={{
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {item.title}
                  </span>
                  {item.statusLabel && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '2px 8px',
                        borderRadius: 3,
                        fontSize: 11,
                        fontWeight: 600,
                        lineHeight: '16px',
                        background: item.statusBg,
                        color: item.statusColor,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.statusLabel.charAt(0).toUpperCase() +
                        item.statusLabel.slice(1).toLowerCase().replace(/_/g, ' ')}
                    </span>
                  )}
                </div>

                {/* Date on the right */}
                <span
                  className="text-caption font-mono"
                  style={{
                    color: 'var(--text-tertiary)',
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatDate(item.date)}
                </span>
              </div>

              {/* Row 2: Type label + ATA/reference */}
              <div
                className="text-caption"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: 'var(--text-tertiary)',
                }}
              >
                <span>{item.typeLabel}</span>
                {item.reference && (
                  <>
                    <span>&middot;</span>
                    <span className="font-mono" style={{ fontSize: 11 }}>
                      {item.reference}
                    </span>
                  </>
                )}
              </div>

              {/* Row 3: Description */}
              {item.description && (
                <p
                  className="text-caption"
                  style={{
                    marginTop: 4,
                    lineHeight: 1.4,
                    color: 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 600,
                  }}
                >
                  {item.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Load more button (for paginated timeline entries) */}
      {entries.length < total && (
        <div style={{ textAlign: 'center', paddingTop: 12 }}>
          <button
            onClick={() => {
              const nextPage = page + 1;
              setPage(nextPage);
              fetchTimeline(nextPage, true);
            }}
            disabled={loading}
            className="text-caption"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: '1px solid var(--border-primary)',
              borderRadius: 6,
              padding: '6px 16px',
              color: 'var(--text-secondary)',
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
