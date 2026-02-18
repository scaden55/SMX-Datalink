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
    <div className="flex items-center justify-between border-b border-acars-border bg-acars-panel px-4 py-2">
      {/* Left: Flight info */}
      <div className="flex items-center gap-4">
        <span className="text-xs text-acars-muted">
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
            <Badge variant="amber">{flight.phase.replace('_', ' ')}</Badge>
          )}
        </div>
      </div>

      {/* Right: View mode toggle */}
      <div className="flex rounded-md border border-acars-border">
        {modes.map((m) => (
          <button
            key={m.value}
            onClick={() => setViewMode(m.value)}
            className={`px-3 py-1 text-xs transition-colors ${
              viewMode === m.value
                ? 'bg-acars-blue/20 text-acars-blue'
                : 'text-acars-muted hover:text-acars-text'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
