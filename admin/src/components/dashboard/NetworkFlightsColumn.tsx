import { memo } from 'react';
import type { ActiveFlightHeartbeat } from '@acars/shared';
import type { FlightActivity, VatsimPilotSummary, AcarsMessage, HubWeather } from '@/types/dashboard';
import { PHASE_COLORS } from '@/lib/constants';

const Divider = () => <div style={{ height: 1, background: 'rgba(255,255,255,0.04)' }} />;

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}min ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

const FLIGHT_RULES_COLOR: Record<string, string> = {
  VFR: '#4ade80',
  MVFR: '#fbbf24',
  IFR: '#f87171',
};

interface NetworkFlightsColumnProps {
  liveFlights: ActiveFlightHeartbeat[];
  activity: FlightActivity;
  vatsimPilots: VatsimPilotSummary[];
  acarsMessages: AcarsMessage[];
  hubWeather: HubWeather[];
}

export const NetworkFlightsColumn = memo(function NetworkFlightsColumn({
  liveFlights,
  activity,
  vatsimPilots,
  acarsMessages,
  hubWeather,
}: NetworkFlightsColumnProps) {
  const live = liveFlights.slice(0, 5);
  const scheduled = activity.scheduled;
  const completed = activity.completed;

  return (
    <div className="flex flex-col gap-4 overflow-hidden pt-0.5">
      {/* Header */}
      <div>
        <div className="font-semibold" style={{ color: '#f0f0f0', fontSize: 18, lineHeight: 1.15 }}>
          Network<br />&amp; Flights
        </div>
      </div>

      {/* Live Flights */}
      {live.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span
              className="animate-pulse"
              style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 4px rgba(74,222,128,0.6)' }}
            />
            <span className="uppercase" style={{ color: '#5a5a5a', fontSize: 9, letterSpacing: 0.5 }}>Live</span>
          </div>
          <div className="font-mono flex flex-col gap-1" style={{ fontSize: 12 }}>
            {live.map((f) => (
              <div key={f.callsign} className="flex items-center gap-1.5">
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: PHASE_COLORS[f.phase] ?? '#7a7a7a', flexShrink: 0 }} />
                <span style={{ color: '#f0f0f0' }}>{f.callsign}</span>
                <span style={{ color: '#5a5a5a', fontSize: 10, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                  FL{Math.round(f.altitude / 100)} · {Math.round(f.groundSpeed)}kt
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {live.length > 0 && <Divider />}

      {/* VATSIM Status */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="uppercase" style={{ color: '#4a4a4a', fontSize: 9, letterSpacing: 0.5 }}>VATSIM</span>
          <span className="font-mono" style={{ color: vatsimPilots.length > 0 ? '#4ade80' : '#4a4a4a', fontSize: 11 }}>
            {vatsimPilots.length} online
          </span>
        </div>
        {vatsimPilots.length > 0 ? (
          <div className="font-mono flex flex-col gap-1" style={{ fontSize: 12 }}>
            {vatsimPilots.map((p) => (
              <div key={p.callsign} className="flex items-center gap-1.5">
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
                <span style={{ color: '#f0f0f0' }}>{p.callsign}</span>
                <span style={{ color: '#5a5a5a', fontSize: 10, marginLeft: 'auto' }}>
                  {p.departure}→{p.arrival}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="font-mono" style={{ color: '#4a4a4a', fontSize: 11 }}>No SMX pilots on network</div>
        )}
      </div>

      <Divider />

      {/* Recent ACARS */}
      <div>
        <div className="uppercase" style={{ color: '#4a4a4a', fontSize: 9, letterSpacing: 0.5, marginBottom: 6 }}>
          Recent ACARS
        </div>
        {acarsMessages.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {acarsMessages.slice(0, 3).map((m, i) => (
              <div key={i} style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: 3 }}>
                <div className="flex justify-between">
                  <span className="font-mono" style={{ color: '#60a5fa', fontSize: 10 }}>{m.callsign}</span>
                  <span className="font-mono" style={{ color: '#555', fontSize: 9 }}>{timeAgo(m.createdAt)}</span>
                </div>
                <div className="font-mono" style={{ color: '#aaa', fontSize: 10, marginTop: 2 }}>{m.content}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="font-mono" style={{ color: '#4a4a4a', fontSize: 11 }}>No recent messages</div>
        )}
      </div>

      <Divider />

      {/* Hub Weather */}
      <div>
        <div className="uppercase" style={{ color: '#4a4a4a', fontSize: 9, letterSpacing: 0.5, marginBottom: 6 }}>
          Hub Weather
        </div>
        <div className="font-mono flex flex-col gap-1" style={{ fontSize: 12 }}>
          {hubWeather.map((w) => (
            <div key={w.icao} className="flex justify-between">
              <span style={{ color: '#f0f0f0' }}>{w.icao}</span>
              <span style={{ color: FLIGHT_RULES_COLOR[w.flightRules] ?? '#888', fontSize: 10 }}>
                {w.flightRules} · {w.tempC}°C · {w.visibility}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Divider />

      {/* Scheduled */}
      {scheduled.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="uppercase" style={{ color: '#5a5a5a', fontSize: 9, letterSpacing: 0.5 }}>Scheduled</span>
            <span className="font-mono" style={{ color: '#4a4a4a', fontSize: 10, marginLeft: 'auto' }}>
              {scheduled.length} bid{scheduled.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="font-mono flex flex-col gap-1" style={{ fontSize: 12 }}>
            {scheduled.map((f) => (
              <div key={f.flightNumber} className="flex items-center gap-1.5">
                <span style={{ color: '#8a8a8a' }}>{f.flightNumber}</span>
                <span style={{ color: '#5a5a5a', fontSize: 10 }}>{f.depIcao}→{f.arrIcao}</span>
                <span className="font-mono" style={{ color: '#4a4a4a', fontSize: 9, marginLeft: 'auto' }}>{f.depTime}z</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {scheduled.length > 0 && completed.length > 0 && <Divider />}

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <div className="uppercase mb-1.5" style={{ color: '#5a5a5a', fontSize: 9, letterSpacing: 0.5 }}>
            Completed
          </div>
          <div className="font-mono flex flex-col gap-1" style={{ fontSize: 12 }}>
            {completed.map((f) => (
              <div key={f.flightNumber} className="flex items-center gap-1.5">
                <span style={{ color: '#4ade80', fontSize: 10 }}>✓</span>
                <span style={{ color: '#8a8a8a' }}>{f.callsign}</span>
                <span style={{ color: '#5a5a5a', fontSize: 10 }}>{f.depIcao}→{f.arrIcao}</span>
                <span className="font-mono" style={{ color: '#4a4a4a', fontSize: 9, marginLeft: 'auto' }}>{timeAgo(f.completedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
