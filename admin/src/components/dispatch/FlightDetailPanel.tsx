import { Plane, Gauge, ArrowUpDown, Compass, Droplet, Navigation } from 'lucide-react';
import type { TelemetrySnapshot, AcarsMessagePayload } from '@acars/shared';
import type { ActiveFlightHeartbeat } from '@acars/shared';
import { StatusBadge, SectionHeader, DataRow } from '@/components/primitives';
import { AcarsChat } from './AcarsChat';

interface FlightDetailPanelProps {
  flight: ActiveFlightHeartbeat | null;
  telemetry: TelemetrySnapshot | null;
  bidId: number | null;
  messages: AcarsMessagePayload[];
}

export function FlightDetailPanel({ flight, telemetry, bidId, messages }: FlightDetailPanelProps) {
  if (!flight) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 border-l border-[var(--border-primary)] text-[var(--text-quaternary)]">
        <Plane size={32} />
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
    <div className="flex h-full flex-col bg-[var(--surface-2)] border-l border-[var(--border-primary)]">
      {/* Flight header */}
      <div className="border-b border-[var(--border-primary)] px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-base font-bold text-[var(--text-primary)]">{flight.callsign}</span>
          <StatusBadge status={phase?.toLowerCase() || 'unknown'} />
        </div>
        <p className="mt-1 text-xs text-[var(--text-tertiary)] font-mono">
          {flight.aircraftType || 'Unknown aircraft'}
        </p>
      </div>

      {/* Telemetry data */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <SectionHeader title="Live Telemetry" />

        <div className="space-y-0.5">
          <DataRow
            label="Altitude"
            value={
              <span className="flex items-center gap-1.5">
                <ArrowUpDown size={14} className="text-[var(--text-tertiary)]" />
                {`${Math.round(altitude).toLocaleString()} ft`}
              </span>
            }
            mono
          />
          <DataRow
            label="Ground Speed"
            value={
              <span className="flex items-center gap-1.5">
                <Gauge size={14} className="text-[var(--text-tertiary)]" />
                {`${Math.round(speed)} kts`}
              </span>
            }
            mono
          />
          <DataRow
            label="Heading"
            value={
              <span className="flex items-center gap-1.5">
                <Compass size={14} className="text-[var(--text-tertiary)]" />
                {`${Math.round(heading)}\u00B0`}
              </span>
            }
            mono
          />
          <DataRow
            label="Vertical Speed"
            value={
              <span className="flex items-center gap-1.5">
                <Navigation size={14} className="text-[var(--text-tertiary)]" />
                {`${verticalSpeed > 0 ? '+' : ''}${Math.round(verticalSpeed)} fpm`}
              </span>
            }
            mono
          />
          {pos?.airspeedIndicated != null && (
            <DataRow
              label="IAS"
              value={
                <span className="flex items-center gap-1.5">
                  <Gauge size={14} className="text-[var(--text-tertiary)]" />
                  {`${Math.round(pos.airspeedIndicated)} kts`}
                </span>
              }
              mono
            />
          )}
          {fuelRemaining != null && (
            <DataRow
              label="Fuel Remaining"
              value={
                <span className="flex items-center gap-1.5">
                  <Droplet size={14} className="text-[var(--text-tertiary)]" />
                  {`${fuelRemaining.toLocaleString()} lbs (${fuelPercent}%)`}
                </span>
              }
              mono
            />
          )}
        </div>

        {/* Position info */}
        <div className="mt-4">
          <SectionHeader title="Position" />
          <div className="space-y-0.5">
            <DataRow
              label="Lat"
              value={flight.latitude.toFixed(4)}
              mono
            />
            <DataRow
              label="Lon"
              value={flight.longitude.toFixed(4)}
              mono
            />
          </div>
        </div>
      </div>

      {/* ACARS Chat */}
      <AcarsChat bidId={bidId} messages={messages} />
    </div>
  );
}
