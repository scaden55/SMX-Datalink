import { useEffect, useState } from 'react';
import { Loader2, CloudRain } from 'lucide-react';
import type { DispatchFlight } from '@acars/shared';
import { api } from '@/lib/api';

interface WeatherTabProps {
  flight: DispatchFlight;
}

interface AirportWeather {
  icao: string;
  label: string;
  metar: string | null;
  taf: string | null;
}

export default function WeatherTab({ flight }: WeatherTabProps) {
  const [weather, setWeather] = useState<AirportWeather[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const airports: { icao: string; label: string }[] = [];

    if (flight.bid.depIcao) airports.push({ icao: flight.bid.depIcao, label: 'Origin' });
    if (flight.bid.arrIcao) airports.push({ icao: flight.bid.arrIcao, label: 'Destination' });
    if (flight.flightPlanData?.alternate1) airports.push({ icao: flight.flightPlanData.alternate1, label: 'Alternate 1' });
    if (flight.flightPlanData?.alternate2) airports.push({ icao: flight.flightPlanData.alternate2, label: 'Alternate 2' });

    if (airports.length === 0) {
      setLoading(false);
      return;
    }

    const icaoList = airports.map((a) => a.icao).join(',');
    let cancelled = false;

    Promise.all([
      api.get<any>(`/api/weather/metar?ids=${icaoList}`).catch(() => null),
      api.get<any>(`/api/weather/taf?ids=${icaoList}`).catch(() => null),
    ]).then(([metarRes, tafRes]) => {
      if (cancelled) return;

      const metarArr: any[] = Array.isArray(metarRes) ? metarRes : [];
      const tafArr: any[] = Array.isArray(tafRes) ? tafRes : [];

      const result: AirportWeather[] = airports.map((a) => {
        const metar = metarArr.find((m: any) => m.icaoId === a.icao || m.stationId === a.icao);
        const taf = tafArr.find((t: any) => t.icaoId === a.icao || t.stationId === a.icao);
        return {
          icao: a.icao,
          label: a.label,
          metar: metar?.rawOb ?? metar?.rawMetar ?? null,
          taf: taf?.rawTaf ?? taf?.rawTAF ?? null,
        };
      });

      setWeather(result);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [flight.bid.depIcao, flight.bid.arrIcao, flight.flightPlanData?.alternate1, flight.flightPlanData?.alternate2]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={16} className="animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  if (weather.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-xs text-[var(--text-muted)] gap-2">
        <CloudRain size={20} />
        No airport data available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {weather.map((w) => (
        <div key={w.icao} className="rounded bg-[var(--surface-1)] p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-[11px] font-bold text-[var(--accent-blue-bright)]">{w.icao}</span>
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{w.label}</span>
          </div>

          {/* METAR */}
          <div className="mb-2">
            <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">METAR</span>
            {w.metar ? (
              <pre className="font-mono text-[10px] text-[var(--text-secondary)] mt-0.5 whitespace-pre-wrap break-all">
                {w.metar}
              </pre>
            ) : (
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5 italic">No data</p>
            )}
          </div>

          {/* TAF */}
          <div>
            <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">TAF</span>
            {w.taf ? (
              <pre className="font-mono text-[10px] text-[var(--text-secondary)] mt-0.5 whitespace-pre-wrap break-all">
                {w.taf}
              </pre>
            ) : (
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5 italic">No data</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
