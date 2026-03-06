import { useState } from 'react';
import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { formatLatLon } from '../../utils/format';
import type { Airport, FaaAirportEvent, MetarData } from '@acars/shared';
import type { DispatchData } from '../../hooks/useDispatchData';

type AirportView = 'origin' | 'destination';

function getFaaEvent(faaEvents: FaaAirportEvent[], icao?: string): FaaAirportEvent | null {
  if (!icao || icao.length < 4) return null;
  const iata = icao.slice(1); // KDEN → DEN
  return faaEvents.find((e) => e.airportId === iata) ?? null;
}

function StatusBadge({ color, children }: { color: 'red' | 'amber' | 'green' | 'blue' | 'cyan'; children: React.ReactNode }) {
  const colors = {
    red: 'bg-red-500/15 text-red-400 border-red-500/30',
    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    green: 'bg-emerald-500/15 text-emerald-400 border-emerald-400/20',
    blue: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    cyan: 'bg-sky-500/15 text-sky-400 border-sky-400/30',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${colors[color]}`}>
      {children}
    </span>
  );
}

function FaaStatusSection({ event }: { event: FaaAirportEvent | null }) {
  if (!event) {
    return (
      <div className="panel p-3">
        <h3 className="text-xs font-semibold text-acars-text mb-2">FAA Status</h3>
        <div className="text-[11px] text-acars-muted italic">No FAA status data for this airport.</div>
      </div>
    );
  }

  const hasAnyEvent = event.groundStop || event.groundDelay || event.arrivalDelay ||
    event.departureDelay || event.airportClosure || event.deicing;

  return (
    <div className="panel p-3 space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold text-acars-text">FAA Status</h3>
        {!hasAnyEvent && <StatusBadge color="green">Normal Operations</StatusBadge>}
      </div>

      {event.airportClosure && (
        <div className="flex items-center gap-2 text-[11px]">
          <StatusBadge color="red">CLOSED</StatusBadge>
          <span className="text-acars-text">{event.airportClosure.reason}</span>
        </div>
      )}

      {event.groundStop && (
        <div className="text-[11px] space-y-0.5">
          <div className="flex items-center gap-2">
            <StatusBadge color="red">GROUND STOP</StatusBadge>
            <span className="text-acars-muted">{event.groundStop.impactingCondition}</span>
          </div>
          <div className="text-acars-muted ml-1">
            {formatTimeRange(event.groundStop.startTime, event.groundStop.endTime)}
            {event.groundStop.probabilityOfExtension &&
              <span> | Ext: {event.groundStop.probabilityOfExtension}</span>
            }
          </div>
        </div>
      )}

      {event.groundDelay && (
        <div className="text-[11px] space-y-0.5">
          <div className="flex items-center gap-2">
            <StatusBadge color="amber">GROUND DELAY</StatusBadge>
            <span className="text-acars-text">
              Avg {event.groundDelay.avgDelay}min / Max {event.groundDelay.maxDelay}min
            </span>
          </div>
          <div className="text-acars-muted ml-1">
            {event.groundDelay.impactingCondition} | {formatTimeRange(event.groundDelay.startTime, event.groundDelay.endTime)}
          </div>
        </div>
      )}

      {event.arrivalDelay && (
        <div className="text-[11px] flex items-center gap-2">
          <StatusBadge color="amber">ARR DELAY</StatusBadge>
          <span className="text-acars-text">
            {event.arrivalDelay.arrivalDeparture.min}–{event.arrivalDelay.arrivalDeparture.max}
            {event.arrivalDelay.arrivalDeparture.trend && ` (${event.arrivalDelay.arrivalDeparture.trend})`}
          </span>
          <span className="text-acars-muted">{event.arrivalDelay.reason}</span>
        </div>
      )}

      {event.departureDelay && (
        <div className="text-[11px] flex items-center gap-2">
          <StatusBadge color="amber">DEP DELAY</StatusBadge>
          <span className="text-acars-text">
            {event.departureDelay.arrivalDeparture.min}–{event.departureDelay.arrivalDeparture.max}
            {event.departureDelay.arrivalDeparture.trend && ` (${event.departureDelay.arrivalDeparture.trend})`}
          </span>
          <span className="text-acars-muted">{event.departureDelay.reason}</span>
        </div>
      )}

      {event.deicing && (
        <div className="text-[11px] flex items-center gap-2">
          <StatusBadge color="blue">DEICING</StatusBadge>
          <span className="text-acars-muted">
            Active since {formatTime(event.deicing.eventTime)}
            {event.deicing.expTime && ` | Expires ${formatTime(event.deicing.expTime)}`}
          </span>
        </div>
      )}

      {event.airportConfig && (
        <div className="text-[11px] mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          <span className="text-acars-muted">Arr Runways</span>
          <span className="text-acars-text tabular-nums">{event.airportConfig.arrivalRunwayConfig || '—'}</span>
          <span className="text-acars-muted">Dep Runways</span>
          <span className="text-acars-text tabular-nums">{event.airportConfig.departureRunwayConfig || '—'}</span>
          <span className="text-acars-muted">Arr Rate</span>
          <span className="text-acars-text tabular-nums">{event.airportConfig.arrivalRate}/hr</span>
        </div>
      )}
    </div>
  );
}

function MetarSummary({ metar }: { metar?: MetarData }) {
  if (!metar) {
    return (
      <div className="panel p-3">
        <h3 className="text-xs font-semibold text-acars-text mb-2">METAR</h3>
        <div className="text-[11px] text-acars-muted italic">No METAR available.</div>
      </div>
    );
  }

  const cat = metar.flightCategory;
  const catColor = cat === 'VFR' ? 'green' : cat === 'MVFR' ? 'blue' : cat === 'IFR' ? 'amber' : cat === 'LIFR' ? 'red' : 'cyan';

  return (
    <div className="panel p-3 space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold text-acars-text">METAR</h3>
        {cat && <StatusBadge color={catColor}>{cat}</StatusBadge>}
      </div>
      <div className="tabular-nums text-[10px] text-acars-text leading-relaxed break-all">
        {metar.rawOb}
      </div>
      <div className="grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <span className="text-acars-muted">Wind</span>
          <div className="text-acars-text tabular-nums">
            {metar.windDir != null ? `${String(metar.windDir).padStart(3, '0')}°` : '---'}
            /{metar.windSpeed ?? '--'}kt
            {metar.windGust != null && `G${metar.windGust}`}
          </div>
        </div>
        <div>
          <span className="text-acars-muted">Vis</span>
          <div className="text-acars-text tabular-nums">{metar.visibility ?? '--'} sm</div>
        </div>
        <div>
          <span className="text-acars-muted">Temp/Dew</span>
          <div className="text-acars-text tabular-nums">
            {metar.temp ?? '--'}/{metar.dewpoint ?? '--'}°C
          </div>
        </div>
        <div>
          <span className="text-acars-muted">Altimeter</span>
          <div className="text-acars-text tabular-nums">{metar.altimeter?.toFixed(2) ?? '----'}</div>
        </div>
      </div>
    </div>
  );
}

function AirportDetail({ airport }: { airport: Airport | null }) {
  if (!airport) {
    return (
      <div className="text-[11px] text-acars-muted italic">
        Airport data not available.
      </div>
    );
  }

  const coords = formatLatLon(airport.lat, airport.lon);

  return (
    <div className="panel p-3">
      <h3 className="text-xs font-semibold text-acars-text mb-2">General</h3>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[11px]">
        <span className="text-acars-muted">Name</span>
        <span className="text-acars-text">{airport.name}</span>
        <span className="text-acars-muted">Location</span>
        <span className="text-acars-text">{airport.city}, {airport.state}, {airport.country}</span>
        <span className="text-acars-muted">ICAO</span>
        <span className="text-acars-text tabular-nums">{airport.icao}</span>
        <span className="text-acars-muted">Coordinates</span>
        <span className="text-acars-text tabular-nums">{coords.lat} / {coords.lon}</span>
        <span className="text-acars-muted">Elevation</span>
        <span className="text-acars-text">{airport.elevation.toLocaleString()} ft</span>
        <span className="text-acars-muted">Timezone</span>
        <span className="text-acars-text">{airport.timezone}</span>
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }) + 'Z';
  } catch {
    return iso;
  }
}

function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export function AirportInfoTab({ dispatchData }: { dispatchData: DispatchData }) {
  const flightPlan = useFlightPlanStore((s) => s.flightPlan);
  const airports = useFlightPlanStore((s) => s.airports);
  const [view, setView] = useState<AirportView>('origin');

  const originIcao = flightPlan?.origin;
  const destIcao = flightPlan?.destination;
  const altIcaos = flightPlan?.alternates ?? [];

  const originAirport = airports.find((a) => a.icao === originIcao) ?? null;
  const destAirport = airports.find((a) => a.icao === destIcao) ?? null;
  const altAirports = altIcaos.map((icao) => airports.find((a) => a.icao === icao) ?? null);

  if (!flightPlan) {
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-acars-text">Airport Info</h3>
        <div className="text-[11px] text-acars-muted italic">
          No flight plan loaded. Airport information will appear once a flight is selected.
        </div>
      </div>
    );
  }

  const selectedAirport = view === 'origin' ? originAirport : destAirport;
  const selectedIcao = view === 'origin' ? originIcao : destIcao;
  const faaEvent = getFaaEvent(dispatchData.faaEvents, selectedIcao);
  const metar = selectedIcao ? dispatchData.metars[selectedIcao] : undefined;

  return (
    <div className="space-y-3">
      {/* Airport selector */}
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => setView('origin')}
          className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
            view === 'origin'
              ? 'bg-sky-500/15 text-sky-400 border border-sky-400/30'
              : 'text-acars-muted border border-acars-border hover:border-acars-muted'
          }`}
        >
          {originIcao ?? '----'} (Origin)
        </button>
        <button
          onClick={() => setView('destination')}
          className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
            view === 'destination'
              ? 'bg-sky-500/15 text-sky-400 border border-sky-400/30'
              : 'text-acars-muted border border-acars-border hover:border-acars-muted'
          }`}
        >
          {destIcao ?? '----'} (Destination)
        </button>
        {altIcaos.length > 0 && (
          <span className="text-[10px] text-acars-muted ml-2">
            Alt: {altIcaos.join(', ')}
          </span>
        )}
        {dispatchData.loading && (
          <span className="text-[10px] text-sky-400 animate-pulse ml-auto">Updating...</span>
        )}
      </div>

      {/* Airport header */}
      <div className="flex items-center gap-2">
        <span className="font-bold text-sky-400 text-sm">{selectedIcao}</span>
        {selectedAirport && (
          <span className="text-xs text-acars-muted">
            {selectedAirport.name} — {selectedAirport.city}, {selectedAirport.state}
          </span>
        )}
      </div>

      {/* FAA Status */}
      <FaaStatusSection event={faaEvent} />

      {/* METAR Summary */}
      <MetarSummary metar={metar} />

      {/* Airport details */}
      <AirportDetail airport={selectedAirport} />

      {/* Alternates section */}
      {altAirports.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-acars-text mb-2">Alternates</h3>
          <div className="grid grid-cols-2 gap-2">
            {altAirports.map((alt, i) => (
              <div key={altIcaos[i]} className="panel p-2">
                <div className="text-xs font-bold text-sky-400">{altIcaos[i]}</div>
                {alt ? (
                  <div className="text-[10px] text-acars-muted mt-0.5">
                    {alt.name} — {alt.city}, {alt.state}
                    <br />
                    Elev: {alt.elevation.toLocaleString()}' | {alt.timezone}
                  </div>
                ) : (
                  <div className="text-[10px] text-acars-muted mt-0.5 italic">Not in database</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
