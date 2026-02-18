import { useFlightPlanStore } from '../../stores/flightPlanStore';

function AirportMiniCard({ label, icao, color, onClick }: { label: string; icao: string; color: string; onClick: () => void }) {
  if (!icao) return null;
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-2.5 rounded-md border border-acars-border bg-acars-bg hover:border-acars-muted/50 transition-colors"
    >
      <span className={`text-[8px] uppercase tracking-wider font-medium block mb-0.5`} style={{ color }}>{label}</span>
      <span className="font-mono text-sm font-bold text-acars-text block">{icao}</span>
    </button>
  );
}

function PhaseBadge({ phase }: { phase: string }) {
  const colors: Record<string, string> = {
    planning: 'text-acars-blue bg-acars-blue/10 border-acars-blue/20',
    active: 'text-acars-green bg-acars-green/10 border-acars-green/20',
    completed: 'text-acars-muted bg-acars-muted/10 border-acars-muted/20',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border ${colors[phase] ?? colors.planning}`}>
      {phase}
    </span>
  );
}

export function PlanningRightPanel() {
  const { form, phase, setSelectedAirportIcao, setPlanningTab } = useFlightPlanStore();

  const handleAirportClick = (icao: string) => {
    setSelectedAirportIcao(icao);
    setPlanningTab('airport-info');
  };

  return (
    <div className="w-[180px] shrink-0 border-l border-acars-border flex flex-col bg-acars-panel overflow-hidden">
      <div className="px-3 py-3 border-b border-acars-border">
        <span className="text-[10px] uppercase tracking-wider text-acars-muted font-medium">Airports</span>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-2">
        <AirportMiniCard label="Origin" icao={form.origin} color="#3fb950" onClick={() => handleAirportClick(form.origin)} />
        <AirportMiniCard label="Destination" icao={form.destination} color="#f85149" onClick={() => handleAirportClick(form.destination)} />
        <AirportMiniCard label="Alternate 1" icao={form.alternate1} color="#d29922" onClick={() => handleAirportClick(form.alternate1)} />
        <AirportMiniCard label="Alternate 2" icao={form.alternate2} color="#d29922" onClick={() => handleAirportClick(form.alternate2)} />
      </div>
      <div className="px-3 py-3 border-t border-acars-border flex items-center justify-center">
        <PhaseBadge phase={phase} />
      </div>
    </div>
  );
}
