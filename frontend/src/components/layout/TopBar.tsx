import { useDispatchTelemetry } from '../../hooks/useDispatchTelemetry';
import { useDispatchEdit } from '../../contexts/DispatchEditContext';
import { useUIStore, type ViewMode } from '../../stores/uiStore';
import { Badge } from '../common/Badge';

export function TopBar() {
  const { flight, connectionStatus, connected } = useDispatchTelemetry();
  const { isOwnFlight } = useDispatchEdit();
  const viewMode = useUIStore((s) => s.viewMode);
  const setViewMode = useUIStore((s) => s.setViewMode);

  const modes: { value: ViewMode; label: string }[] = [
    { value: 'planning', label: 'Planning Info' },
    { value: 'map', label: 'Map' },
    { value: 'both', label: 'Both' },
  ];

  return (
    <div className="flex items-center justify-between border-b border-acars-border bg-acars-card px-4 h-8">
      {/* Left: Flight info */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-acars-muted">
          {new Date().toUTCString().replace('GMT', 'UTC')}
        </span>
        <div className="flex items-center gap-2">
          <Badge variant="blue">ACARS</Badge>
          {isOwnFlight ? (
            connectionStatus.connected ? (
              <Badge variant="green">
                {connectionStatus.simulator.toUpperCase()}
              </Badge>
            ) : (
              <Badge variant="red">DISCONNECTED</Badge>
            )
          ) : connected ? (
            <Badge variant="green">LIVE</Badge>
          ) : null}
          {flight && (
            <Badge variant="amber">{flight.phase?.replace('_', ' ') ?? 'IDLE'}</Badge>
          )}
        </div>
      </div>

      {/* Right: View mode pill toggle */}
      <div className="flex rounded-full border border-acars-border overflow-hidden">
        {modes.map((m) => (
          <button
            key={m.value}
            onClick={() => setViewMode(m.value)}
            className={`px-3 py-0.5 text-[11px] uppercase transition-colors ${
              viewMode === m.value
                ? 'bg-[#4F6CCD]/15 text-[#7B94E0]'
                : 'bg-acars-input text-acars-muted hover:text-acars-text'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
