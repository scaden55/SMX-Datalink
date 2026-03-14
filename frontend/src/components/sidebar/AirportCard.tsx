interface AirportCardProps {
  label: string;
  icao: string;
  active?: boolean;
}

export function AirportCard({ label, icao, active }: AirportCardProps) {
  return (
    <button className={`w-full rounded border px-2 py-1.5 text-left transition-colors ${
      active
        ? 'border-blue-400 bg-blue-500/10'
        : 'border-acars-border bg-acars-input hover:border-acars-muted'
    }`}>
      <div className="text-[9px] uppercase tracking-wider text-acars-muted">{label}</div>
      <div className={`text-sm font-bold tabular-nums ${active ? 'text-sky-400' : 'text-acars-text'}`}>
        {icao}
      </div>
    </button>
  );
}
