import { useMemo } from 'react';
import { Broadcast, AirplaneTilt, Clock } from '@phosphor-icons/react';
import type { VatsimControllerWithPosition, VatsimPilot } from '@acars/shared';
import { pilotsInAirspace } from '../../lib/geo-utils';

interface Props {
  airspaceId: string;
  airspaceType: 'fir' | 'tracon';
  feature: GeoJSON.Feature;
  controllers: VatsimControllerWithPosition[];
  pilots: VatsimPilot[];
  x: number;
  y: number;
}

function formatLogonDuration(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function AirspaceHoverCard({ airspaceId, airspaceType, feature, controllers, pilots, x, y }: Props) {
  const name = feature.properties?.name || feature.properties?.NAME || airspaceId;

  const matchedControllers = useMemo(() => {
    return controllers.filter((c) => c.boundaryId === airspaceId);
  }, [controllers, airspaceId]);

  const pilotCount = useMemo(() => {
    return pilotsInAirspace(pilots, feature).length;
  }, [pilots, feature]);

  const isFir = airspaceType === 'fir';
  const accentColor = isFir ? '#22d3ee' : '#f59e0b';

  // Clamp position so the card doesn't overflow the viewport
  const cardW = 224; // w-56 = 14rem = 224px
  const cardH = 160; // approximate max height
  const clampedX = typeof window !== 'undefined' ? Math.min(x + 16, window.innerWidth - cardW - 16) : x + 16;
  const clampedY = typeof window !== 'undefined' ? Math.min(Math.max(y - 8, 8), window.innerHeight - cardH - 8) : y - 8;

  return (
    <div
      className="absolute z-[2000] pointer-events-none"
      style={{ left: clampedX, top: clampedY }}
    >
      <div className="bg-acars-panel border border-acars-border rounded-md shadow-lg p-3 w-56">
        <div className="flex items-center gap-2 mb-2">
          <Broadcast className="w-3.5 h-3.5 shrink-0" style={{ color: accentColor }} />
          <div className="min-w-0">
            <div className="text-xs font-bold text-acars-text truncate">{name}</div>
            <div className="text-[9px] text-acars-muted uppercase tracking-wider">
              {isFir ? 'FIR / Center' : 'TRACON / Approach'}
            </div>
          </div>
        </div>

        {matchedControllers.map((ctrl) => (
          <div key={ctrl.callsign} className="flex items-center gap-2 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
            <span className="text-[11px] font-mono font-bold text-acars-text">{ctrl.callsign}</span>
            <span className="text-[11px] font-mono ml-auto" style={{ color: accentColor }}>
              {ctrl.frequency}
            </span>
          </div>
        ))}

        {matchedControllers.length > 0 && (
          <div className="flex items-center gap-1.5 text-[9px] text-acars-muted mb-2">
            <Clock className="w-2.5 h-2.5" />
            <span>Online {formatLogonDuration(matchedControllers[0].logon_time)}</span>
          </div>
        )}

        <div className="border-t border-acars-border pt-2 flex items-center gap-1.5">
          <AirplaneTilt className="w-3 h-3 text-acars-muted" />
          <span className="text-[11px] text-acars-text font-mono font-bold">{pilotCount}</span>
          <span className="text-[10px] text-acars-muted">aircraft in airspace</span>
        </div>
      </div>
    </div>
  );
}
