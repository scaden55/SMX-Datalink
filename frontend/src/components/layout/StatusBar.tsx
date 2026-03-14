import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AirplaneTilt, WifiHigh, WifiSlash, WifiMedium } from '@phosphor-icons/react';
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
    <div className="status-block">
      <span className="status-label">UTC</span>
      <span className="font-mono text-[11px] text-acars-text/90 tabular-nums tracking-wide">
        {time}<span className="text-[#4F6CCD] ml-0.5 text-[9px]">Z</span>
      </span>
    </div>
  );
}

function ActiveFlightPill() {
  const { flight, aircraft, connected } = useTelemetry();
  const navigate = useNavigate();

  if (!connected || !flight) return null;

  const alt = aircraft?.position.altitude ?? 0;
  const gs = aircraft?.position.groundSpeed ?? 0;
  const hdg = aircraft?.position.heading ?? 0;

  return (
    <button
      onClick={() => navigate('/dispatch')}
      className="flex items-center gap-0 h-full border-l border-r border-white/[0.06] hover:bg-emerald-500/[0.06] transition-colors"
    >
      <div className="flex items-center gap-1.5 px-2.5">
        <span className="relative flex items-center justify-center w-1.5 h-1.5">
          <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-40" />
          <span className="relative rounded-full w-1.5 h-1.5 bg-emerald-400" />
        </span>
        <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-emerald-400">
          {flight.phase?.replace('_', ' ') ?? 'ACTIVE'}
        </span>
      </div>

      <div className="status-divider" />

      <div className="flex items-center gap-3 px-2.5">
        <div className="flex items-center gap-1">
          <span className="status-label">FL</span>
          <span className="font-mono text-[11px] text-acars-text/90 tabular-nums">
            {Math.round(alt / 100).toString().padStart(3, '0')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="status-label">GS</span>
          <span className="font-mono text-[11px] text-acars-text/90 tabular-nums">
            {Math.round(gs).toString().padStart(3, '0')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="status-label">HDG</span>
          <span className="font-mono text-[11px] text-acars-text/90 tabular-nums">
            {Math.round(hdg).toString().padStart(3, '0')}°
          </span>
        </div>
      </div>
    </button>
  );
}

export function StatusBar() {
  const { flight, connectionStatus, isStale } = useTelemetry();

  const connIcon = connectionStatus.connected
    ? isStale ? WifiMedium : WifiHigh
    : WifiSlash;
  const ConnIcon = connIcon;

  const connColor = connectionStatus.connected
    ? isStale ? 'text-amber-400' : 'text-emerald-400'
    : 'text-red-400/60';

  const connBg = connectionStatus.connected
    ? isStale ? 'bg-amber-400' : 'bg-emerald-400'
    : 'bg-red-400';

  return (
    <div
      className="flex items-center h-7 shrink-0 text-[11px] select-none"
      style={{
        background: 'var(--bg-sidebar)',
        borderTop: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      {/* Left: Version + Connection */}
      <div className="flex items-center h-full">
        <div className="status-block px-3">
          <span className="font-mono text-[9px] text-acars-muted/30 tracking-wider">v{__APP_VERSION__}</span>
        </div>

        <div className="status-divider" />

        <div className="status-block px-2.5">
          <ConnIcon className={`w-3 h-3 ${connColor}`} weight="bold" />
          <span className={`h-1.5 w-1.5 rounded-full ${connBg} ${!connectionStatus.connected ? 'animate-pulse' : ''}`} />
          {connectionStatus.connected ? (
            <span className={`font-mono text-[9px] tabular-nums ${isStale ? 'text-amber-400/70' : 'text-emerald-400/70'}`}>
              {connectionStatus.applicationName}
            </span>
          ) : (
            <span className="text-red-400/40 text-[9px] truncate max-w-[140px]">
              {connectionStatus.lastError || 'Offline'}
            </span>
          )}
        </div>

        {flight && (
          <>
            <div className="status-divider" />
            <div className="status-block px-2.5">
              <span className="status-label">SIM</span>
              <span className="font-mono text-[11px] text-acars-muted/70 tabular-nums">{flight.simRate}×</span>
            </div>
          </>
        )}

        <div className="status-divider" />

        <ActiveFlightPill />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right: Time displays */}
      <div className="flex items-center h-full pr-3">
        <ZuluClock />

        {flight && (
          <>
            <div className="status-divider" />
            <div className="status-block px-2.5">
              <span className="status-label">SIM</span>
              <span className="font-mono text-[11px] text-acars-muted/70 tabular-nums">{flight.zuluTime}Z</span>
            </div>
            <div className="status-divider" />
            <div className="status-block px-2.5">
              <span className="status-label">LCL</span>
              <span className="font-mono text-[11px] text-acars-muted/70 tabular-nums">{flight.localTime}L</span>
            </div>
          </>
        )}

        {flight?.isPaused && (
          <>
            <div className="status-divider" />
            <div className="status-block px-2.5">
              <span className="font-mono text-[11px] font-bold text-amber-400 tracking-widest animate-pulse">PAUSED</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
