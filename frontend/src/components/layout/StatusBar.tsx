import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AirplaneTilt } from '@phosphor-icons/react';
import { useTelemetry } from '../../hooks/useTelemetry';

function ZuluClock() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const s = String(now.getUTCSeconds()).padStart(2, '0');
      setTime(`${h}:${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="font-mono text-[10px] text-acars-muted/80 tabular-nums">
      {time}<span className="text-blue-400/80 ml-0.5">Z</span>
    </span>
  );
}

function ActiveFlightPill() {
  const { flight, aircraft, connected } = useTelemetry();
  const navigate = useNavigate();

  if (!connected || !flight) return null;

  const alt = aircraft?.position.altitude ?? 0;

  return (
    <button
      onClick={() => navigate('/dispatch')}
      className="flex items-center gap-1.5 rounded-full bg-emerald-500/8 border border-emerald-400/15 px-2 py-px text-[9px] text-emerald-400 hover:bg-emerald-500/15 hover:border-emerald-400/30"
    >
      <AirplaneTilt className="w-2.5 h-2.5" />
      <span className="font-medium uppercase tracking-wide">
        {flight.phase?.replace('_', ' ') ?? 'IDLE'}
      </span>
      <span className="text-emerald-400/40">|</span>
      <span className="font-mono tabular-nums">
        FL{Math.round(alt / 100).toString().padStart(3, '0')}
      </span>
    </button>
  );
}

export function StatusBar() {
  const { flight, connectionStatus, isStale } = useTelemetry();

  return (
    <div className="flex items-center justify-between border-t border-acars-border bg-acars-panel px-4 h-7 text-[10px]">
      <div className="flex items-center gap-2.5">
        <span className="text-acars-muted/40 font-medium tracking-wide">v{__APP_VERSION__}</span>
        <span className="w-px h-3 bg-white/10" />
        <span className="flex items-center gap-1.5">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              connectionStatus.connected
                ? isStale ? 'bg-amber-500' : 'bg-emerald-500'
                : 'bg-red-500'
            }`}
          />
          {connectionStatus.connected ? (
            <span className={`font-mono ${isStale ? 'text-amber-400/60' : 'text-emerald-400/60'}`}>
              {connectionStatus.applicationName}
            </span>
          ) : (
            <span className="text-red-400/40 truncate max-w-[200px]">
              {connectionStatus.lastError || 'Offline'}
            </span>
          )}
        </span>
        {flight && (
          <>
            <span className="w-px h-3 bg-white/10" />
            <span className="text-acars-muted/60 font-mono tabular-nums">
              {flight.simRate}x
            </span>
          </>
        )}
        <ActiveFlightPill />
      </div>
      <div className="flex items-center gap-2.5 text-acars-muted/60 font-mono tabular-nums">
        <ZuluClock />
        {flight && (
          <>
            <span className="w-px h-3 bg-white/10" />
            <span>{flight.zuluTime}Z</span>
            <span className="w-px h-3 bg-white/10" />
            <span>{flight.localTime}L</span>
          </>
        )}
        {flight?.isPaused && (
          <>
            <span className="w-px h-3 bg-white/10" />
            <span className="text-amber-400 font-semibold tracking-wider">PAUSED</span>
          </>
        )}
      </div>
    </div>
  );
}
