import { useNavigate } from 'react-router-dom';
import { useSharedMap } from './SharedMapContext';

interface OverviewFlightCardProps {
  callsign: string;
  flightNumber?: string;
  depIcao?: string;
  arrIcao?: string;
  aircraftType?: string;
  phase?: string;
  altitude?: number;
  groundSpeed?: number;
  bidId?: number;
  onClose: () => void;
}

/* ── Phase badge ─────────────────────────────────────────────── */

const PHASE_COLORS: Record<string, { bg: string; text: string }> = {
  planning: { bg: 'rgba(251, 191, 36, 0.15)', text: '#fbbf24' },
  active: { bg: 'rgba(74, 222, 128, 0.15)', text: '#4ade80' },
  completed: { bg: 'rgba(107, 114, 128, 0.15)', text: '#9ca3af' },
};

/* ── Component ───────────────────────────────────────────────── */

export function OverviewFlightCard({
  callsign,
  flightNumber,
  depIcao,
  arrIcao,
  aircraftType,
  phase,
  altitude,
  groundSpeed,
  bidId,
  onClose,
}: OverviewFlightCardProps) {
  const navigate = useNavigate();
  const { setDetailBidId, setSelectedBidId } = useSharedMap();

  const phaseColor = phase ? PHASE_COLORS[phase] : undefined;

  const alt =
    altitude != null
      ? `FL${String(Math.round(altitude / 100)).padStart(3, '0')}`
      : null;
  const gs =
    groundSpeed != null ? `${Math.round(groundSpeed)} kt` : null;

  const handleViewDispatch = () => {
    // Dismiss the overview card immediately
    onClose();
    // Set selectedBidId so the flight stays highlighted on the map during transition
    if (bidId != null) {
      setSelectedBidId(bidId);
    }
    // Navigate — overview cards slide out, dispatch overlays slide in
    navigate('/dispatch');
    // Open the detail panel after the transition animation completes
    if (bidId != null) {
      setTimeout(() => setDetailBidId(bidId), 400);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        left: 24,
        zIndex: 50,
        width: 280,
        background: 'var(--surface-1)',
        border: '1px solid var(--surface-3)',
        borderRadius: 8,
        padding: 12,
        pointerEvents: 'auto',
        animation: 'fadeIn 150ms ease-out',
      }}
    >
      {/* Header: Callsign + close */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span
          style={{
            fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace',
            fontWeight: 700,
            fontSize: 14,
            color: 'var(--accent-blue-bright)',
          }}
        >
          {callsign}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            padding: '0 2px',
            transition: 'color 150ms ease-out',
          }}
        >
          ×
        </button>
      </div>

      {/* Route + aircraft type */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span
          style={{
            fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-primary)',
          }}
        >
          {depIcao ?? '----'} → {arrIcao ?? '----'}
        </span>
        {aircraftType && (
          <span
            style={{
              fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace',
              fontSize: 11,
              color: 'var(--text-muted)',
            }}
          >
            {aircraftType}
          </span>
        )}
      </div>

      {flightNumber && (
        <div
          style={{
            fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace',
            fontSize: 11,
            color: 'var(--text-secondary)',
            marginBottom: 6,
          }}
        >
          {flightNumber}
        </div>
      )}

      {/* Phase badge */}
      {phase && phaseColor && (
        <div style={{ marginBottom: 8 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 9999,
              background: phaseColor.bg,
              color: phaseColor.text,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {phase}
          </span>
        </div>
      )}

      {/* Telemetry (if available) */}
      {(alt || gs) && (
        <div
          style={{
            display: 'flex',
            gap: 12,
            fontSize: 11,
            color: 'var(--text-muted)',
            fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace',
            fontVariantNumeric: 'tabular-nums',
            borderTop: '1px solid var(--surface-3)',
            paddingTop: 6,
            marginBottom: 8,
          }}
        >
          {alt && <span>{alt}</span>}
          {gs && <span>{gs}</span>}
        </div>
      )}

      {/* View in Dispatch link */}
      {bidId != null && (
        <div
          style={{
            borderTop: '1px solid var(--surface-3)',
            paddingTop: 8,
          }}
        >
          <button
            onClick={handleViewDispatch}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              padding: 0,
              transition: 'color 150ms ease-out',
            }}
          >
            View in Dispatch →
          </button>
        </div>
      )}
    </div>
  );
}
