import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane } from 'lucide-react';
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
    <span className="font-mono text-xs text-acars-muted tabular-nums">
      {time}<span className="text-blue-400 ml-0.5">Z</span>
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
      className="flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-400/20 px-2.5 py-0.5 text-[10px] text-emerald-400 hover:bg-emerald-500/20 transition-colors"
    >
      <Plane className="w-3 h-3" />
      <span className="font-medium">
        {flight.phase.replace('_', ' ')}
      </span>
      <span className="text-emerald-400/70">|</span>
      <span className="font-mono tabular-nums">
        FL{Math.round(alt / 100).toString().padStart(3, '0')}
      </span>
    </button>
  );
}

export function StatusBar() {
  const { flight, connectionStatus, isStale } = useTelemetry();

  return (
    <div className="flex items-center justify-between border-t border-acars-border bg-acars-panel px-4 py-1 text-[11px]">
      <div className="flex items-center gap-3">
        <span className="text-acars-muted/50 font-medium">Backend v1.0</span>
        <span className="text-acars-muted/30">|</span>
        <span className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              connectionStatus.connected
                ? isStale ? 'bg-amber-500' : 'bg-emerald-500'
                : 'bg-red-500'
            }`}
          />
          {connectionStatus.connected ? (
            <span className={isStale ? 'text-amber-400/70' : 'text-emerald-400/70'}>
              {connectionStatus.applicationName} v{connectionStatus.simConnectVersion}
            </span>
          ) : (
            <span className="text-red-400/50 italic">Sim Offline</span>
          )}
        </span>
        {flight && (
          <>
            <span className="text-acars-muted/30">&middot;</span>
            <span className="text-acars-muted">
              SIM RATE: {flight.simRate}x
            </span>
          </>
        )}
        <ActiveFlightPill />
      </div>
      <div className="flex items-center gap-3 text-acars-muted">
        <ZuluClock />
        {flight && (
          <>
            <span className="text-acars-muted/30">&middot;</span>
            <span>ZULU {flight.zuluTime}</span>
            <span className="text-acars-muted/30">&middot;</span>
            <span>LOCAL {flight.localTime}</span>
          </>
        )}
        {flight?.isPaused && (
          <>
            <span className="text-acars-muted/30">&middot;</span>
            <span className="text-amber-400 font-medium">PAUSED</span>
          </>
        )}
      </div>
    </div>
  );
}
