import type { DispatchMapFlight } from '@/components/layout/SharedMapContext';

interface FloatingFlightCardProps {
  flight: DispatchMapFlight;
  position: { x: number; y: number };
  onOpenDetails: () => void;
  onClose: () => void;
}

/* ── Phase badge config ────────────────────────────────────────── */

const PHASE_BADGE: Record<DispatchMapFlight['phase'], { label: string; bg: string; text: string }> = {
  flying: { label: 'Flying', bg: 'rgba(74, 222, 128, 0.15)', text: '#4ade80' },
  planning: { label: 'Planning', bg: 'rgba(251, 191, 36, 0.15)', text: '#fbbf24' },
  completed: { label: 'Completed', bg: 'rgba(107, 114, 128, 0.15)', text: '#9ca3af' },
};

/* ── Telemetry cell ────────────────────────────────────────────── */

function TelemetryCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{
        fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace',
        fontSize: '13px',
        fontWeight: 600,
        color: '#ffffff',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '10px',
        color: 'var(--text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {label}
      </div>
    </div>
  );
}

/* ── Component ─────────────────────────────────────────────────── */

export function FloatingFlightCard({ flight, position, onOpenDetails, onClose }: FloatingFlightCardProps) {
  const badge = PHASE_BADGE[flight.phase];

  const alt = flight.altitude != null
    ? `FL${String(Math.round(flight.altitude / 100)).padStart(3, '0')}`
    : '---';
  const gs = flight.groundSpeed != null
    ? `${Math.round(flight.groundSpeed)}kt`
    : '---';
  const hdg = flight.heading != null
    ? `${String(Math.round(flight.heading)).padStart(3, '0')}°`
    : '---';

  // Clamp position so card doesn't overflow viewport
  const cardWidth = 260;
  const cardHeight = 240;
  const left = Math.min(position.x + 12, window.innerWidth - cardWidth - 16);
  const top = Math.min(Math.max(position.y - 20, 8), window.innerHeight - cardHeight - 16);

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        zIndex: 50,
        background: 'var(--surface-1)',
        border: '1px solid var(--border-secondary)',
        borderRadius: '8px',
        padding: '12px',
        minWidth: '220px',
        maxWidth: `${cardWidth}px`,
        color: 'var(--text-primary)',
        fontSize: '13px',
        lineHeight: 1.4,
        pointerEvents: 'auto',
        animation: 'fadeIn 150ms ease-out',
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 6, right: 8,
          background: 'none', border: 'none', color: 'var(--text-tertiary)',
          cursor: 'pointer', fontSize: '14px', lineHeight: 1,
          transition: 'color 150ms ease-out',
        }}
      >
        ×
      </button>

      {/* Header: Callsign + Phase badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', paddingRight: '16px' }}>
        <span style={{
          fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace',
          fontWeight: 700, fontSize: '14px',
          color: 'var(--accent-blue-bright)',
        }}>
          {flight.callsign}
        </span>
        <span style={{
          fontSize: '10px', fontWeight: 600, padding: '2px 8px',
          borderRadius: '9999px', background: badge.bg, color: badge.text,
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {badge.label}
        </span>
      </div>

      {/* Route + Aircraft */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{
          fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace',
          fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)',
        }}>
          {flight.depIcao} → {flight.arrIcao}
        </span>
        <span style={{
          fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace',
          fontSize: '11px', color: 'var(--text-tertiary)',
        }}>
          {flight.aircraftType || '---'}
        </span>
      </div>

      {/* Telemetry row (flying only) */}
      {flight.phase === 'flying' && (
        <div style={{
          display: 'flex', gap: '4px', padding: '6px 0',
          borderTop: '1px solid var(--border-primary)',
          borderBottom: '1px solid var(--border-primary)',
          marginBottom: '8px',
        }}>
          <TelemetryCell label="ALT" value={alt} />
          <TelemetryCell label="GS" value={gs} />
          <TelemetryCell label="HDG" value={hdg} />
        </div>
      )}

      {/* Pilot info */}
      {flight.pilot && (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
          {flight.pilot.name}
        </div>
      )}

      {/* Action buttons */}
      <div style={{
        display: 'flex', gap: '6px',
        borderTop: '1px solid var(--border-primary)',
        paddingTop: '10px',
      }}>
        <button
          onClick={onOpenDetails}
          style={{
            flex: 1, padding: '6px 10px', borderRadius: '6px', border: 'none',
            background: 'var(--accent-blue)', color: '#ffffff',
            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            transition: 'filter 150ms ease-out',
          }}
        >
          Open Details
        </button>
        <button
          onClick={onOpenDetails}
          style={{
            flex: 1, padding: '6px 10px', borderRadius: '6px',
            border: '1px solid var(--border-secondary)',
            background: 'var(--surface-3)', color: 'var(--text-secondary)',
            fontSize: '12px', fontWeight: 500, cursor: 'pointer',
            transition: 'border-color 150ms ease-out, color 150ms ease-out',
          }}
        >
          ACARS
        </button>
      </div>
    </div>
  );
}
