import { useTelemetry } from '../../hooks/useTelemetry';
import { useUIStore, type ViewMode } from '../../stores/uiStore';
import { Badge } from '../common/Badge';

export function TopBar() {
  const { flight, connectionStatus } = useTelemetry();
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
        <span className="text-[10px] text-acars-muted">
          {new Date().toUTCString().replace('GMT', 'UTC')}
        </span>
        <div className="flex items-center gap-2">
          <Badge variant="blue">ACARS</Badge>
          {connectionStatus.connected ? (
            <Badge variant="green">
              {connectionStatus.simulator.toUpperCase()}
            </Badge>
          ) : (
            <Badge variant="red">DISCONNECTED</Badge>
          )}
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
            className={`px-3 py-0.5 text-[10px] uppercase transition-colors ${
              viewMode === m.value
                ? 'bg-[#1b2b3d] text-[#93c5fd]'
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
