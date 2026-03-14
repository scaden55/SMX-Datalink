import { useMemo } from 'react';
import { CircleMarker, Popup } from 'react-leaflet';
import type { VatsimControllerWithPosition, VatsimFacilityType } from '@acars/shared';

/** Human-readable names for facility types (mirrored from shared to avoid CJS import) */
const VATSIM_FACILITY_NAMES: Record<VatsimFacilityType, string> = {
  0: 'Observer',
  1: 'Flight Service Station',
  2: 'Delivery',
  3: 'Ground',
  4: 'Tower',
  5: 'Approach/Departure',
  6: 'Center',
};

interface Props {
  controllers: VatsimControllerWithPosition[];
  visible: boolean;
}

/** Color mapping by facility type */
const FACILITY_COLORS: Record<VatsimFacilityType, string> = {
  0: '#6b7280', // Observer — gray
  1: '#4F6CCD', // FSS — blue
  2: '#60a5fa', // Delivery — blue
  3: '#22c55e', // Ground — green
  4: '#ef4444', // Tower — red
  5: '#f59e0b', // Approach — amber
  6: '#22d3ee', // Center — cyan
};

function formatLogonTime(iso: string): string {
  const logon = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - logon.getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

/**
 * Renders CircleMarkers for VATSIM controllers that have a known position
 * (from transceiver data). Color-coded by facility type.
 */
export function ControllerMarkers({ controllers, visible }: Props) {
  const positioned = useMemo(
    () => controllers.filter((c) => c.latitude != null && c.longitude != null),
    [controllers],
  );

  if (!visible) return null;

  return (
    <>
      {positioned.map((ctrl) => (
        <CircleMarker
          key={ctrl.callsign}
          center={[ctrl.latitude!, ctrl.longitude!]}
          radius={5}
          pathOptions={{
            color: FACILITY_COLORS[ctrl.facility] ?? '#6b7280',
            fillColor: FACILITY_COLORS[ctrl.facility] ?? '#6b7280',
            fillOpacity: 0.8,
            weight: 1.5,
          }}
        >
          <Popup className="vatsim-controller-popup">
            <div style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontFeatureSettings: '"tnum"',
              fontSize: '11px',
              color: 'var(--text-primary)',
              background: 'var(--bg-panel)',
              padding: '8px 10px',
              borderRadius: '6px',
              lineHeight: '1.7',
              minWidth: '160px',
              border: '1px solid var(--border-panel)',
            }}>
              <div style={{ fontWeight: 600, color: FACILITY_COLORS[ctrl.facility], marginBottom: '4px' }}>
                {ctrl.callsign}
              </div>
              <div style={{ color: 'rgb(var(--text-secondary-rgb))', fontSize: '10px', marginBottom: '4px' }}>
                {ctrl.name} — {VATSIM_FACILITY_NAMES[ctrl.facility]}
              </div>
              <div>Freq: <span style={{ color: 'var(--text-primary)' }}>{ctrl.frequency}</span></div>
              <div>Online: <span style={{ color: 'var(--text-primary)' }}>{formatLogonTime(ctrl.logon_time)}</span></div>
              {ctrl.text_atis && ctrl.text_atis.length > 0 && (
                <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid var(--border-panel)' }}>
                  <div style={{ color: 'rgb(var(--text-secondary-rgb))', fontSize: '10px', marginBottom: '2px' }}>ATIS</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                    {ctrl.text_atis.join('\n')}
                  </div>
                </div>
              )}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}
