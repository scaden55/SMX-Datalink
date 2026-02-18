interface AirportCardProps {
  label: string;
  icao: string;
  active?: boolean;
}

export function AirportCard({ label, icao, active }: AirportCardProps) {
  return (
    <button className={`w-full rounded border px-2 py-1.5 text-left transition-colors ${
      active
        ? 'border-acars-blue bg-acars-blue/10'
        : 'border-acars-border bg-acars-panel hover:border-acars-muted'
    }`}>
      <div className="text-[9px] uppercase tracking-wider text-acars-muted">{label}</div>
      <div className={`text-sm font-bold font-mono ${active ? 'text-acars-cyan' : 'text-acars-text'}`}>
        {icao}
      </div>
    </button>
  );
}
