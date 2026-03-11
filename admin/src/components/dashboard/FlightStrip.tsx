import { memo, useMemo } from 'react';
import type { ActiveFlightHeartbeat } from '@acars/shared';
import type { FlightActivity } from '../../types/dashboard';

const PHASE_COLORS: Record<string, string> = {
  CRUISE: '#4ade80',
  CLIMB: '#fbbf24',
  DESCENT: '#fbbf24',
  APPROACH: '#22d3ee',
  TAKEOFF: '#3b5bdb',
  LANDING: '#22d3ee',
  TAXI_OUT: '#7a7a7a',
  TAXI_IN: '#7a7a7a',
  PREFLIGHT: '#7a7a7a',
  PARKED: '#7a7a7a',
};

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return '<1h ago';
  return `${hours}h ago`;
}

interface FlightStripProps {
  liveFlights: ActiveFlightHeartbeat[];
  activity: FlightActivity | null;
}

export const FlightStrip = memo(function FlightStrip({ liveFlights, activity }: FlightStripProps) {
  const live = liveFlights.slice(0, 5);
  const scheduled = activity?.scheduled ?? [];
  const completed = activity?.completed ?? [];

  const hasLive = live.length > 0;
  const hasScheduled = scheduled.length > 0;
  const hasCompleted = completed.length > 0;
  const hasAny = hasLive || hasScheduled || hasCompleted;

  const columns = useMemo(() => {
    const cols: string[] = [];
    if (hasLive) cols.push('live');
    if (hasScheduled) cols.push('scheduled');
    if (hasCompleted) cols.push('completed');
    return cols;
  }, [hasLive, hasScheduled, hasCompleted]);

  return (
    <div className="absolute bottom-0 left-0 right-0" style={{ zIndex: 10 }}>
      {/* Gradient fade */}
      <div style={{ height: 24, background: 'linear-gradient(to bottom, transparent, rgba(5,5,5,0.9))' }} />

      {/* Content */}
      <div style={{ background: 'rgba(5,5,5,0.92)', padding: '8px 12px 10px' }}>
        {!hasAny ? (
          <div className="flex items-center justify-center gap-2 py-1">
            <span className="font-mono" style={{ color: '#3a3a3a', fontSize: 9 }}>No flight activity</span>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, 1fr)`, gap: 12 }}>
            {columns.map((col, idx) => (
              <div key={col} style={idx > 0 ? { borderLeft: '1px solid rgba(255,255,255,0.04)', paddingLeft: 12 } : undefined}>
                {col === 'live' && (
                  <>
                    <div className="flex items-center gap-1 mb-1">
                      <span
                        className="animate-pulse"
                        style={{ width: 4, height: 4, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 4px rgba(74,222,128,0.6)' }}
                      />
                      <span className="uppercase" style={{ color: '#4a4a4a', fontSize: 7, letterSpacing: 0.5 }}>Live</span>
                    </div>
                    <div className="font-mono flex flex-col gap-0.5" style={{ fontSize: 9 }}>
                      {live.map(f => (
                        <div key={f.callsign} className="flex items-center gap-1">
                          <span style={{ width: 3, height: 3, borderRadius: '50%', background: PHASE_COLORS[f.phase] ?? '#7a7a7a', flexShrink: 0 }} />
                          <span style={{ color: '#f0f0f0' }}>{f.callsign}</span>
                          <span style={{ color: '#4a4a4a', fontSize: 7, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                            FL{Math.round(f.altitude / 100)} · {Math.round(f.groundSpeed)}kt
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {col === 'scheduled' && (
                  <>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="uppercase" style={{ color: '#4a4a4a', fontSize: 7, letterSpacing: 0.5 }}>Scheduled</span>
                      <span className="font-mono" style={{ color: '#3a3a3a', fontSize: 8, marginLeft: 'auto' }}>
                        {scheduled.length} bid{scheduled.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="font-mono flex flex-col gap-0.5" style={{ fontSize: 9 }}>
                      {scheduled.map(f => (
                        <div key={f.flightNumber} className="flex items-center gap-1">
                          <span style={{ color: '#7a7a7a' }}>{f.flightNumber}</span>
                          <span style={{ color: '#4a4a4a', fontSize: 8 }}>{f.depIcao}→{f.arrIcao}</span>
                          <span style={{ color: '#3a3a3a', fontSize: 7, marginLeft: 'auto' }}>{f.depTime}z</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {col === 'completed' && (
                  <>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="uppercase" style={{ color: '#4a4a4a', fontSize: 7, letterSpacing: 0.5 }}>Completed</span>
                    </div>
                    <div className="font-mono flex flex-col gap-0.5" style={{ fontSize: 9 }}>
                      {completed.map(f => (
                        <div key={f.flightNumber} className="flex items-center gap-1">
                          <span style={{ color: '#4ade80', fontSize: 7 }}>✓</span>
                          <span style={{ color: '#7a7a7a' }}>{f.callsign}</span>
                          <span style={{ color: '#4a4a4a', fontSize: 8 }}>{f.depIcao}→{f.arrIcao}</span>
                          <span style={{ color: '#3a3a3a', fontSize: 7, marginLeft: 'auto' }}>{timeAgo(f.completedAt)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
