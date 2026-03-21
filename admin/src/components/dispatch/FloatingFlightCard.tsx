import { Popup } from 'react-leaflet';
import type { DispatchMapFlight } from '@/pages/DispatchMapPage';

interface FloatingFlightCardProps {
  flight: DispatchMapFlight;
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
        color: 'var(--text-tertiary, #76798b)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {label}
      </div>
    </div>
  );
}

/* ── Component ─────────────────────────────────────────────────── */

export function FloatingFlightCard({ flight, onOpenDetails, onClose }: FloatingFlightCardProps) {
  const badge = PHASE_BADGE[flight.phase];

  // Format telemetry values
  const alt = flight.altitude != null
    ? `FL${String(Math.round(flight.altitude / 100)).padStart(3, '0')}`
    : '---';
  const gs = flight.groundSpeed != null
    ? `${Math.round(flight.groundSpeed)}kt`
    : '---';
  const hdg = flight.heading != null
    ? `${String(Math.round(flight.heading)).padStart(3, '0')}°`
    : '---';

  // Position for popup
  const lat = flight.latitude ?? flight.depLat ?? 0;
  const lon = flight.longitude ?? flight.depLon ?? 0;

  return (
    <Popup
      position={[lat, lon]}
      className="dispatch-popup"
      closeButton={false}
      autoPan={true}
      offset={[0, -8]}
      eventHandlers={{ remove: onClose }}
    >
      <div style={{
        background: 'var(--surface-1, #0e1125)',
        border: '1px solid var(--border-secondary, rgba(48, 61, 104, 0.12))',
        borderRadius: '8px',
        padding: '12px',
        minWidth: '220px',
        maxWidth: '260px',
        color: 'var(--text-primary, #ffffff)',
        fontSize: '13px',
        lineHeight: 1.4,
      }}>
        {/* Header: Callsign + Phase badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{
            fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace',
            fontWeight: 700,
            fontSize: '14px',
            color: 'var(--accent-blue-bright, #9BB3F0)',
          }}>
            {flight.callsign}
          </span>
          <span style={{
            fontSize: '10px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '9999px',
            background: badge.bg,
            color: badge.text,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            {badge.label}
          </span>
        </div>

        {/* Route + Aircraft */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{
            fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--text-primary, #ffffff)',
          }}>
            {flight.depIcao} → {flight.arrIcao}
          </span>
          <span style={{
            fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace',
            fontSize: '11px',
            color: 'var(--text-tertiary, #76798b)',
          }}>
            {flight.aircraftType || '---'}
          </span>
        </div>

        {/* Telemetry row (flying only) */}
        {flight.phase === 'flying' && (
          <div style={{
            display: 'flex',
            gap: '4px',
            padding: '6px 0',
            borderTop: '1px solid var(--border-primary, rgba(48, 61, 104, 0.08))',
            borderBottom: '1px solid var(--border-primary, rgba(48, 61, 104, 0.08))',
            marginBottom: '8px',
          }}>
            <TelemetryCell label="ALT" value={alt} />
            <TelemetryCell label="GS" value={gs} />
            <TelemetryCell label="HDG" value={hdg} />
          </div>
        )}

        {/* Pilot info */}
        {flight.pilot && (
          <div style={{
            fontSize: '12px',
            color: 'var(--text-secondary, #b6b8c5)',
            marginBottom: '10px',
          }}>
            {flight.pilot.name}
          </div>
        )}

        {/* Action buttons */}
        <div style={{
          display: 'flex',
          gap: '6px',
          borderTop: '1px solid var(--border-primary, rgba(48, 61, 104, 0.08))',
          paddingTop: '10px',
        }}>
          <button
            onClick={onOpenDetails}
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: '6px',
              border: 'none',
              background: 'var(--accent-blue, #6384E6)',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Open Details
          </button>
          <button
            onClick={onOpenDetails}
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border-secondary, rgba(48, 61, 104, 0.12))',
              background: 'var(--surface-3, #131728)',
              color: 'var(--text-secondary, #b6b8c5)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            ACARS
          </button>
        </div>
      </div>
    </Popup>
  );
}
