import { Radio, Map, Radar, Plane, MapPin, Navigation } from 'lucide-react';
import { useVatsimStore } from '../../stores/vatsimStore';

/**
 * Small control panel for toggling VATSIM overlay layers on the live map.
 * Positioned below the zoom controls in the top-right corner.
 */
export function VatsimLayerToggle() {
  const layers = useVatsimStore((s) => s.layers);
  const toggleLayer = useVatsimStore((s) => s.toggleLayer);
  const snapshot = useVatsimStore((s) => s.snapshot);

  const controllerCount = snapshot?.controllers.length ?? 0;
  const pilotCount = snapshot?.pilots.length ?? 0;

  return (
    <div className="bg-acars-panel rounded-md border border-acars-border overflow-hidden mt-1 w-44">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-acars-border">
        <Radio className="w-3 h-3 text-sky-400" />
        <span className="text-[10px] font-bold text-acars-text tracking-wider uppercase">VATSIM</span>
        {snapshot && (
          <span className="ml-auto text-[9px] text-acars-muted">
            {controllerCount} ATC
          </span>
        )}
      </div>

      {/* Toggle switches */}
      <div className="p-1.5 space-y-0.5">
        <ToggleRow
          icon={<Map className="w-3 h-3" />}
          label="FIR Boundaries"
          active={layers.showFirBoundaries}
          color="text-sky-400"
          onToggle={() => toggleLayer('showFirBoundaries')}
        />
        <ToggleRow
          icon={<Radar className="w-3 h-3" />}
          label="TRACON Areas"
          active={layers.showTraconBoundaries}
          color="text-amber-400"
          onToggle={() => toggleLayer('showTraconBoundaries')}
        />
        <ToggleRow
          icon={<MapPin className="w-3 h-3" />}
          label="Airport Labels"
          active={layers.showAirportLabels}
          color="text-acars-text"
          onToggle={() => toggleLayer('showAirportLabels')}
        />
        <ToggleRow
          icon={<Navigation className="w-3 h-3" />}
          label="Navaids"
          active={layers.showNavaids}
          color="text-sky-400"
          onToggle={() => toggleLayer('showNavaids')}
        />
        <ToggleRow
          icon={<Plane className="w-3 h-3" />}
          label="Pilots"
          active={layers.showPilots}
          color="text-blue-400"
          count={pilotCount}
          onToggle={() => toggleLayer('showPilots')}
        />
      </div>
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  active,
  color,
  count,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  color: string;
  count?: number;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left transition-colors ${
        active ? 'bg-acars-border' : 'hover:bg-acars-border'
      }`}
    >
      <span className={active ? color : 'text-acars-muted/40'}>{icon}</span>
      <span className={`text-[10px] flex-1 ${active ? 'text-acars-text' : 'text-acars-muted/50'}`}>
        {label}
      </span>
      {count != null && (
        <span className="text-[9px] text-acars-muted tabular-nums">{count}</span>
      )}
      <div
        className={`w-6 h-3.5 rounded-full relative transition-colors ${
          active ? 'bg-sky-500/40' : 'bg-acars-border'
        }`}
      >
        <div
          className={`absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all ${
            active ? 'left-3 bg-sky-500' : 'left-0.5 bg-acars-muted/50'
          }`}
        />
      </div>
    </button>
  );
}
