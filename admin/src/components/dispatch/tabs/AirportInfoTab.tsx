import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { DispatchFlight } from '@acars/shared';
import { api } from '@/lib/api';

interface AirportInfoTabProps {
  flight: DispatchFlight;
}

interface AirportDetail {
  icao: string;
  name: string;
  city?: string;
  country?: string;
  lat?: number;
  lon?: number;
  elevation?: number;
}

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

export default function AirportInfoTab({ flight }: AirportInfoTabProps) {
  const airports = [
    { icao: flight.bid.depIcao, label: 'Origin' },
    { icao: flight.bid.arrIcao, label: 'Destination' },
    ...(flight.flightPlanData?.alternate1
      ? [{ icao: flight.flightPlanData.alternate1, label: 'Alternate 1' }]
      : []),
    ...(flight.flightPlanData?.alternate2
      ? [{ icao: flight.flightPlanData.alternate2, label: 'Alternate 2' }]
      : []),
  ];

  const [selected, setSelected] = useState(airports[0]?.icao ?? '');
  const [detail, setDetail] = useState<AirportDetail | null>(null);
  const [metar, setMetar] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      api.get<AirportDetail>(`/api/airports/${selected}`).catch(() => null),
      api
        .get<any>(`/api/weather/metar?ids=${selected}`)
        .then((res) => {
          const arr = Array.isArray(res) ? res : [];
          const m = arr.find((r: any) => r.icaoId === selected || r.stationId === selected);
          return m?.rawOb ?? m?.rawMetar ?? null;
        })
        .catch(() => null),
    ]).then(([airportRes, metarRes]) => {
      if (cancelled) return;
      setDetail(airportRes);
      setMetar(metarRes);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  return (
    <div className="space-y-3">
      {/* Airport selector */}
      <div className="flex gap-1.5">
        {airports.map((a) => (
          <button
            key={a.icao}
            onClick={() => setSelected(a.icao)}
            className={`px-2.5 py-1 rounded text-[11px] font-mono font-medium transition-colors ${
              selected === a.icao
                ? 'bg-[var(--accent)]/20 text-[var(--accent-blue-bright)] border border-[var(--accent)]/30'
                : 'bg-[var(--surface-1)] text-[var(--text-muted)] border border-[var(--surface-3)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {a.icao}
            <span className="ml-1 text-[9px] opacity-60">{a.label}</span>
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={16} className="animate-spin text-[var(--accent)]" />
        </div>
      )}

      {!loading && (
        <>
          {/* Airport header */}
          <div className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-md p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-sky-400 font-mono">{selected}</span>
              {detail?.name && (
                <span className="text-[11px] text-[var(--text-muted)]">{detail.name}</span>
              )}
            </div>

            {/* General info grid */}
            {detail && (
              <div className="grid grid-cols-4 gap-3 text-[12px]">
                <div>
                  <span className="text-[11px] text-[var(--text-muted)]">Name</span>
                  <div className="text-[var(--text-primary)] truncate">{detail.name || '---'}</div>
                </div>
                <div>
                  <span className="text-[11px] text-[var(--text-muted)]">Location</span>
                  <div className="text-[var(--text-primary)]">
                    {detail.city ? `${detail.city}${detail.country ? `, ${detail.country}` : ''}` : '---'}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-[var(--text-muted)]">ICAO</span>
                  <div className="font-mono tabular-nums text-[var(--text-primary)]">{detail.icao}</div>
                </div>
                <div>
                  <span className="text-[11px] text-[var(--text-muted)]">Elevation</span>
                  <div className="font-mono tabular-nums text-[var(--text-primary)]">
                    {detail.elevation != null ? `${detail.elevation} ft` : '---'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* METAR section */}
          <div className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-md p-3 space-y-2">
            <h3 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              METAR
            </h3>
            {metar ? (
              <>
                <div className="font-mono text-[11px] text-[var(--text-secondary)] leading-relaxed break-all">
                  {metar}
                </div>
                <div className="grid grid-cols-4 gap-3 text-[12px]">
                  {(() => {
                    const parsed = parseMetar(metar);
                    return (
                      <>
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
                      </>
                    );
                  })()}
                </div>
              </>
            ) : (
              <p className="text-[11px] text-[var(--text-muted)] italic">METAR not available.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
