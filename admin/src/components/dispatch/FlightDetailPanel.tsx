import { AirplaneTilt, Gauge, ArrowsVertical, Compass, Drop, NavigationArrow } from '@phosphor-icons/react';
import type { TelemetrySnapshot, AcarsMessagePayload } from '@acars/shared';
import type { ActiveFlightHeartbeat } from '@acars/shared';
import { AcarsChat } from './AcarsChat';

const PHASE_COLORS: Record<string, string> = {
  PREFLIGHT: 'bg-zinc-600 text-zinc-200',
  TAXI: 'bg-amber-700 text-amber-100',
  TAKEOFF: 'bg-red-700 text-red-100',
  CLIMB: 'bg-blue-700 text-blue-100',
  CRUISE: 'bg-emerald-700 text-emerald-100',
  DESCENT: 'bg-amber-700 text-amber-100',
  APPROACH: 'bg-red-700 text-red-100',
  LANDING: 'bg-red-700 text-red-100',
  ARRIVED: 'bg-emerald-700 text-emerald-100',
};

function PhaseBadge({ phase }: { phase: string }) {
  const upper = phase.toUpperCase();
  const colors = PHASE_COLORS[upper] ?? 'bg-zinc-600 text-zinc-200';
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${colors}`}>
      {phase}
    </span>
  );
}

interface TelemetryRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function TelemetryRow({ icon, label, value }: TelemetryRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span className="font-mono text-sm">{value}</span>
    </div>
  );
}

interface FlightDetailPanelProps {
  flight: ActiveFlightHeartbeat | null;
  telemetry: TelemetrySnapshot | null;
  bidId: number | null;
  messages: AcarsMessagePayload[];
}

export function FlightDetailPanel({ flight, telemetry, bidId, messages }: FlightDetailPanelProps) {
  if (!flight) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 border-l border-border text-muted-foreground">
        <AirplaneTilt size={32} />
        <p className="text-sm">Select a flight</p>
      </div>
    );
  }

  const pos = telemetry?.aircraft?.position;
  const fuel = telemetry?.fuel;

  const altitude = pos?.altitude ?? flight.altitude;
  const speed = pos?.groundSpeed ?? flight.groundSpeed;
  const heading = pos?.heading ?? flight.heading;
  const verticalSpeed = pos?.verticalSpeed ?? 0;
  const fuelRemaining = fuel ? Math.round(fuel.totalQuantityWeight) : null;
  const fuelPercent = fuel ? Math.round(fuel.fuelPercentage) : null;
  const phase = telemetry?.flight?.phase ?? flight.phase;

  return (
    <div className="flex h-full flex-col border-l border-border">
      {/* Flight header */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-base font-bold">{flight.callsign}</span>
          <PhaseBadge phase={phase || 'unknown'} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground font-mono">
          {flight.aircraftType || 'Unknown aircraft'}
        </p>
      </div>

      {/* Telemetry data */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Live Telemetry
        </h3>

        <div className="space-y-0.5">
          <TelemetryRow
            icon={<ArrowsVertical size={14} />}
            label="Altitude"
            value={`${Math.round(altitude).toLocaleString()} ft`}
          />
          <TelemetryRow
            icon={<Gauge size={14} />}
            label="Ground Speed"
            value={`${Math.round(speed)} kts`}
          />
          <TelemetryRow
            icon={<Compass size={14} />}
            label="Heading"
            value={`${Math.round(heading)}°`}
          />
          <TelemetryRow
            icon={<NavigationArrow size={14} />}
            label="Vertical Speed"
            value={`${verticalSpeed > 0 ? '+' : ''}${Math.round(verticalSpeed)} fpm`}
          />
          {pos?.airspeedIndicated != null && (
            <TelemetryRow
              icon={<Gauge size={14} />}
              label="IAS"
              value={`${Math.round(pos.airspeedIndicated)} kts`}
            />
          )}
          {fuelRemaining != null && (
            <TelemetryRow
              icon={<Drop size={14} />}
              label="Fuel Remaining"
              value={`${fuelRemaining.toLocaleString()} lbs (${fuelPercent}%)`}
            />
          )}
        </div>

        {/* Position info */}
        <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Position
        </h3>
        <div className="space-y-0.5">
          <TelemetryRow
            icon={<span className="text-[14px]">Lat</span>}
            label=""
            value={flight.latitude.toFixed(4)}
          />
          <TelemetryRow
            icon={<span className="text-[14px]">Lon</span>}
            label=""
            value={flight.longitude.toFixed(4)}
          />
        </div>
      </div>

      {/* ACARS Chat */}
      <AcarsChat bidId={bidId} messages={messages} />
    </div>
  );
}
