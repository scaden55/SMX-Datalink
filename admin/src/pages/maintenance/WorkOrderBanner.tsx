import { useCallback, useEffect, useState } from 'react';
import { Loader2, Wrench, CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { formatCurrency } from '@/lib/formatters';

// ── Types ────────────────────────────────────────────────────

interface WorkOrder {
  id: number;
  aircraft_id: number;
  discrepancy_id: number;
  ata_chapter: string;
  ata_title: string | null;
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
  registration: string;
  created_at: string;
  updated_at: string;
}

interface WorkOrderBannerProps {
  aircraftId: number;
  onAccept?: () => void;
}

// ── Component ────────────────────────────────────────────────

export function WorkOrderBanner({ aircraftId, onAccept }: WorkOrderBannerProps) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  const fetchWorkOrders = useCallback(async () => {
    try {
      const res = await api.get<WorkOrder[]>(`/api/admin/maintenance/work-orders?aircraft_id=${aircraftId}`);
      setWorkOrders(res);
    } catch {
      // Silently fail — banner is optional
    } finally {
      setLoading(false);
    }
  }, [aircraftId]);

  useEffect(() => {
    fetchWorkOrders();
    // Poll every 30s to pick up completion
    const interval = setInterval(fetchWorkOrders, 30_000);
    return () => clearInterval(interval);
  }, [fetchWorkOrders]);

  // Find the most relevant work order (in_progress first, then completed)
  const activeWO = workOrders.find((wo) => wo.status === 'in_progress')
    || workOrders.find((wo) => wo.status === 'completed');

  if (loading || !activeWO) return null;

  async function handleAccept() {
    if (!activeWO || accepting) return;
    setAccepting(true);
    try {
      await api.post(`/api/admin/maintenance/work-orders/${activeWO.id}/accept`);
      toast.success('Work order accepted — aircraft returned to service');
      onAccept?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to accept work order');
    } finally {
      setAccepting(false);
    }
  }

  const isCompleted = activeWO.status === 'completed';
  const isInProgress = activeWO.status === 'in_progress';

  // Calculate elapsed time
  const startedMs = new Date(activeWO.started_at + 'Z').getTime();
  const elapsedHours = (Date.now() - startedMs) / 3_600_000;
  const progressPct = Math.min(100, (elapsedHours / activeWO.estimated_hours) * 100);

  return (
    <div
      style={{
        borderBottom: '1px solid var(--border-primary)',
        background: isCompleted
          ? 'rgba(74, 222, 128, 0.04)'
          : 'rgba(251, 191, 36, 0.04)',
        padding: '10px 24px',
      }}
    >
      {isInProgress && (
        <div className="flex items-center" style={{ gap: 12 }}>
          {/* Label */}
          <div className="flex items-center" style={{ gap: 6, flexShrink: 0 }}>
            <Wrench size={14} style={{ color: 'var(--accent-amber)' }} />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--accent-amber)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              In Maintenance
            </span>
          </div>

          {/* Details */}
          <span className="text-caption" style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>
            ATA <span className="font-mono" style={{ fontWeight: 600 }}>{activeWO.ata_chapter}</span>
            {activeWO.ata_title && <> — {activeWO.ata_title}</>}
          </span>

          {/* Station */}
          {activeWO.station && (
            <span className="font-mono text-caption" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
              @ {activeWO.station}
            </span>
          )}

          <div className="flex-1" />

          {/* Progress bar */}
          <div className="flex items-center" style={{ gap: 8, minWidth: 180 }}>
            <div
              style={{
                flex: 1,
                height: 4,
                background: 'var(--surface-3)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progressPct}%`,
                  background: progressPct >= 90 ? 'var(--accent-cyan)' : 'var(--accent-amber)',
                  transition: 'width 300ms',
                }}
              />
            </div>
            <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
              {elapsedHours.toFixed(1)}h / {activeWO.estimated_hours.toFixed(1)}h
            </span>
          </div>
        </div>
      )}

      {isCompleted && (
        <div className="flex items-center" style={{ gap: 12 }}>
          {/* Label */}
          <div className="flex items-center" style={{ gap: 6, flexShrink: 0 }}>
            <CheckCircle2 size={14} style={{ color: 'var(--accent-emerald)' }} />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--accent-emerald)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Repair Complete
            </span>
          </div>

          {/* Details */}
          <span className="text-caption" style={{ color: 'var(--text-secondary)' }}>
            {activeWO.technician_name && (
              <span className="font-mono" style={{ fontWeight: 500 }}>{activeWO.technician_name}</span>
            )}
            {activeWO.corrective_action && (
              <span style={{ marginLeft: 6 }}>
                — {activeWO.corrective_action.length > 80
                  ? activeWO.corrective_action.slice(0, 80) + '...'
                  : activeWO.corrective_action}
              </span>
            )}
          </span>

          <div className="flex-1" />

          {/* Cost */}
          {activeWO.actual_cost != null && (
            <span className="font-mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              {formatCurrency(activeWO.actual_cost)}
            </span>
          )}

          {/* Accept button */}
          <button
            onClick={handleAccept}
            disabled={accepting}
            onMouseEnter={(e) => { if (!accepting) e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={(e) => { if (!accepting) e.currentTarget.style.opacity = '1'; }}
            className="flex items-center"
            style={{
              gap: 5,
              padding: '5px 12px',
              background: 'var(--accent-emerald)',
              color: '#000',
              fontSize: 11,
              fontWeight: 700,
              border: 'none',
              cursor: accepting ? 'default' : 'pointer',
              opacity: accepting ? 0.6 : 1,
              whiteSpace: 'nowrap',
              transition: 'opacity 120ms',
            }}
          >
            {accepting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <CheckCircle2 size={12} />
            )}
            Accept & Return to Service
          </button>
        </div>
      )}
    </div>
  );
}
