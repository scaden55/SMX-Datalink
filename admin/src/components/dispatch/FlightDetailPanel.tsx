import { useEffect, useState } from 'react';
import { Plane, ArrowUpDown, Gauge, Compass, Package, Thermometer, AlertTriangle } from 'lucide-react';
import type { AcarsMessagePayload, CargoManifest } from '@acars/shared';
import type { ActiveFlightHeartbeat } from '@acars/shared';
import { StatusBadge, SectionHeader, DataRow } from '@/components/primitives';
import { AcarsChat } from './AcarsChat';
import { api } from '@/lib/api';

interface FlightDetailPanelProps {
  flight: ActiveFlightHeartbeat | null;
  bidId: number | null;
  messages: AcarsMessagePayload[];
}

export function FlightDetailPanel({ flight, bidId, messages }: FlightDetailPanelProps) {
  const [manifest, setManifest] = useState<CargoManifest | null>(null);
  const [manifestLoading, setManifestLoading] = useState(false);

  // Fetch cargo manifest when bid changes
  useEffect(() => {
    setManifest(null);
    if (!bidId) return;

    setManifestLoading(true);
    api.get<CargoManifest>(`/api/cargo/${bidId}`)
      .then((data) => setManifest(data))
      .catch(() => setManifest(null))
      .finally(() => setManifestLoading(false));
  }, [bidId]);

  if (!flight) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-[var(--surface-0)] border-l border-[var(--border-primary)] text-[var(--text-quaternary)]" role="status">
        <Plane size={32} aria-hidden="true" />
        <p className="text-sm">Select a flight</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[var(--surface-2)] border-l border-[var(--border-primary)]">
      {/* Flight header */}
      <div className="border-b border-[var(--border-primary)] px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-base font-bold text-[var(--text-primary)]">{flight.callsign}</span>
          <StatusBadge status={flight.phase?.toLowerCase() || 'unknown'} />
        </div>
        <p className="mt-1 text-xs text-[var(--text-tertiary)] font-mono">
          {flight.aircraftType || 'Unknown aircraft'}
        </p>
        {flight.depIcao && flight.arrIcao && (
          <p className="mt-0.5 text-xs text-[var(--text-tertiary)] font-mono">
            {flight.depIcao} → {flight.arrIcao}
          </p>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* Telemetry data */}
        <SectionHeader title="Live Telemetry" />

        <div className="space-y-0.5">
          <DataRow
            label="Altitude"
            value={
              <span className="flex items-center gap-1.5">
                <ArrowUpDown size={14} className="text-[var(--text-tertiary)]" />
                {`FL${Math.round(flight.altitude / 100).toString().padStart(3, '0')} (${Math.round(flight.altitude).toLocaleString()} ft)`}
              </span>
            }
            mono
          />
          <DataRow
            label="Ground Speed"
            value={
              <span className="flex items-center gap-1.5">
                <Gauge size={14} className="text-[var(--text-tertiary)]" />
                {`${Math.round(flight.groundSpeed)} kts`}
              </span>
            }
            mono
          />
          <DataRow
            label="Heading"
            value={
              <span className="flex items-center gap-1.5">
                <Compass size={14} className="text-[var(--text-tertiary)]" />
                {`${Math.round(flight.heading).toString().padStart(3, '0')}°`}
              </span>
            }
            mono
          />
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

        {/* Cargo Manifest */}
        <div className="mt-4">
          <SectionHeader title="Cargo Manifest" />
          {manifestLoading ? (
            <p className="text-xs text-[var(--text-quaternary)]">Loading manifest...</p>
          ) : manifest ? (
            <div className="space-y-0.5">
              <DataRow
                label="Manifest"
                value={manifest.manifestNumber}
                mono
              />
              <DataRow
                label="Total Weight"
                value={`${Math.round(manifest.totalWeightDisplay).toLocaleString()} ${manifest.totalWeightUnit}`}
                mono
              />
              <DataRow
                label="Load Factor"
                value={`${Math.round(manifest.payloadUtilization)}%`}
                mono
              />
              <DataRow
                label="ULDs"
                value={`${manifest.ulds.length}`}
                mono
              />
              <DataRow
                label="CG"
                value={`${manifest.cgPosition.toFixed(1)}% MAC`}
                mono
              />

              {/* ULD breakdown */}
              {manifest.ulds.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {manifest.ulds.map((uld) => (
                    <div
                      key={uld.uld_id}
                      className="rounded bg-[var(--surface-0)] px-2.5 py-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-medium text-[var(--text-primary)]">{uld.uld_id}</span>
                        <span className="font-mono text-[var(--text-secondary)]">
                          {Math.round(uld.weight).toLocaleString()} kg
                        </span>
                      </div>
                      <p className="mt-0.5 text-[var(--text-tertiary)] truncate">{uld.cargo_description}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--text-quaternary)]">
                        <span className="font-mono">{uld.position}</span>
                        <span>{uld.category_name}</span>
                        {uld.temp_controlled && (
                          <span className="flex items-center gap-0.5 text-[var(--accent-blue)]">
                            <Thermometer size={10} />
                            {uld.temp_requirement}
                          </span>
                        )}
                        {uld.hazmat && (
                          <span className="flex items-center gap-0.5 text-[var(--accent-amber)]">
                            <AlertTriangle size={10} />
                            DG
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* NOTOC indicator */}
              {manifest.notocRequired && (
                <div className="mt-2 flex items-center gap-1.5 rounded bg-[var(--accent-amber)]/10 px-2.5 py-1.5 text-xs text-[var(--accent-amber)]">
                  <AlertTriangle size={14} />
                  <span>NOTOC required — {manifest.notocItems.length} DG item{manifest.notocItems.length !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-quaternary)] flex items-center gap-1.5">
              <Package size={14} />
              No cargo manifest
            </p>
          )}
        </div>
      </div>

      {/* ACARS Chat */}
      <AcarsChat bidId={bidId} messages={messages} />
    </div>
  );
}
