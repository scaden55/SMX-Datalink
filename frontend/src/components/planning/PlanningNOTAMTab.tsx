import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { AlertCircle } from 'lucide-react';

export function PlanningNOTAMTab() {
  const { form, weatherCache } = useFlightPlanStore();

  const icaos = [form.origin, form.destination].filter(Boolean);

  if (icaos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-2 p-4">
        <AlertCircle className="w-6 h-6 text-acars-muted/20" />
        <p className="text-[11px] text-acars-muted font-sans">Enter origin/destination to fetch NOTAMs</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3 overflow-auto">
      {icaos.map((icao) => {
        const notams = weatherCache[icao]?.notams ?? [];
        return (
          <div key={icao}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono text-[12px] text-acars-mono font-semibold">{icao}</span>
              <span className="text-[11px] text-acars-muted font-sans">
                {notams.length} NOTAM{notams.length !== 1 ? 's' : ''}
              </span>
            </div>
            {notams.length === 0 ? (
              <p className="text-[11px] text-acars-muted font-sans">No NOTAMs available</p>
            ) : (
              <div className="space-y-1.5">
                {notams.map((n, i) => (
                  <pre
                    key={i}
                    className="text-[11px] font-mono text-acars-mono bg-acars-input rounded-md px-2 py-1 whitespace-pre-wrap break-words border border-acars-border"
                  >
                    {n.text}
                  </pre>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
