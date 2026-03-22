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

/* ── METAR parsing helpers ─────────────────────────────────────── */

function parseMetar(raw: string) {
  const windMatch = raw.match(/(\d{3})(\d{2,3})(G(\d{2,3}))?KT/);
  const visMatch = raw.match(/\s(\d+)\s?SM/) || raw.match(/\s(\d{4})\s/);
  const tempMatch = raw.match(/\s(M?\d{2})\/(M?\d{2})\s/);
  const altMatch = raw.match(/[QA](\d{4})/);

  return {
    wind: windMatch
      ? `${windMatch[1]}°/${windMatch[2]}${windMatch[4] ? `G${windMatch[4]}` : ''}kt`
      : '---',
    vis: visMatch ? `${visMatch[1]} sm` : '---',
    temp: tempMatch
      ? `${tempMatch[1].replace('M', '-')}/${tempMatch[2].replace('M', '-')}°C`
      : '---',
    altimeter: altMatch
      ? raw.includes('Q')
        ? `${altMatch[1]} hPa`
        : `${(parseInt(altMatch[1]) / 100).toFixed(2)} inHg`
      : '---',
  };
}

function getFlightCategory(raw: string): { cat: string; color: string } {
  const visMatch = raw.match(/\s(\d+)\s?SM/);
  const vis = visMatch ? parseInt(visMatch[1]) : 10;
  if (vis < 1) return { cat: 'LIFR', color: 'bg-red-500/15 text-red-400 border-red-500/30' };
  if (vis < 3) return { cat: 'IFR', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
  if (vis < 5) return { cat: 'MVFR', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
  return { cat: 'VFR', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-400/20' };
}

/* ── Component ─────────────────────────────────────────────────── */

export default function WeatherTab({ flight }: WeatherTabProps) {
  const [weather, setWeather] = useState<AirportWeather[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const airports: { icao: string; label: string }[] = [];

    if (flight.bid.depIcao) airports.push({ icao: flight.bid.depIcao, label: 'Origin' });
    if (flight.bid.arrIcao) airports.push({ icao: flight.bid.arrIcao, label: 'Destination' });
    if (flight.flightPlanData?.alternate1)
      airports.push({ icao: flight.flightPlanData.alternate1, label: 'Alternate 1' });
    if (flight.flightPlanData?.alternate2)
      airports.push({ icao: flight.flightPlanData.alternate2, label: 'Alternate 2' });

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

    return () => {
      cancelled = true;
    };
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
      {weather.map((w) => {
        const fc = w.metar ? getFlightCategory(w.metar) : null;
        const parsed = w.metar ? parseMetar(w.metar) : null;

        return (
          <div key={w.icao} className="space-y-2">
            {/* METAR section */}
            <div className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-md p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-sky-400">{w.icao}</span>
                <span className="text-[11px] text-[var(--text-muted)]">({w.label})</span>
                {fc && (
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold border ${fc.color}`}
                  >
                    {fc.cat}
                  </span>
                )}
              </div>

              {w.metar ? (
                <>
                  <div>
                    <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      METAR
                    </span>
                    <div className="font-mono tabular-nums text-[11px] text-[var(--text-secondary)] mt-1 leading-relaxed break-all">
                      {w.metar}
                    </div>
                  </div>

                  {parsed && (
                    <div className="grid grid-cols-4 gap-3 text-[12px]">
                      <div>
                        <span className="text-[11px] text-[var(--text-muted)]">Wind</span>
                        <div className="font-mono tabular-nums text-[var(--text-primary)]">
                          {parsed.wind}
                        </div>
                      </div>
                      <div>
                        <span className="text-[11px] text-[var(--text-muted)]">Visibility</span>
                        <div className="font-mono tabular-nums text-[var(--text-primary)]">
                          {parsed.vis}
                        </div>
                      </div>
                      <div>
                        <span className="text-[11px] text-[var(--text-muted)]">Temp/Dew</span>
                        <div className="font-mono tabular-nums text-[var(--text-primary)]">
                          {parsed.temp}
                        </div>
                      </div>
                      <div>
                        <span className="text-[11px] text-[var(--text-muted)]">Altimeter</span>
                        <div className="font-mono tabular-nums text-[var(--text-primary)]">
                          {parsed.altimeter}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[11px] text-[var(--text-muted)] italic">METAR not available.</p>
              )}
            </div>

            {/* TAF section */}
            <div className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-md p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-sky-400">{w.icao}</span>
                <span className="text-[11px] text-[var(--text-muted)]">({w.label} TAF)</span>
              </div>

              {w.taf ? (
                <div className="font-mono tabular-nums text-[11px] text-[var(--text-secondary)] leading-relaxed break-all whitespace-pre-wrap">
                  {w.taf}
                </div>
              ) : (
                <p className="text-[11px] text-[var(--text-muted)] italic">TAF not available.</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
