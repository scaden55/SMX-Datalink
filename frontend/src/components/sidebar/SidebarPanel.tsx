import { AirportCard } from './AirportCard';
import { VatsimBadge } from '../common/VatsimBadge';
import { useFlightPlanStore } from '../../stores/flightPlanStore';
import type { DispatchFlight } from '@acars/shared';

interface SidebarPanelProps {
  flights?: DispatchFlight[];
  selectedBidId?: number | null;
  onSelectFlight?: (bidId: number) => void;
}

export function SidebarPanel({ flights, selectedBidId, onSelectFlight }: SidebarPanelProps) {
  const flightPlan = useFlightPlanStore((s) => s.flightPlan);

  // Admin flight selector mode
  if (flights && flights.length > 0 && onSelectFlight) {
    return (
      <div className="p-2 space-y-1.5">
        <div className="px-1 pb-1">
          <span className="text-[9px] font-semibold text-[var(--text-label)] uppercase tracking-wider">
            Active Flights
          </span>
        </div>
        {flights.map((f) => {
          const isSelected = f.bid.id === selectedBidId;
          return (
            <button
              key={f.bid.id}
              onClick={() => onSelectFlight(f.bid.id)}
              className={`w-full text-left rounded-md p-2 border transition-all duration-150 ${
                isSelected
                  ? 'border-[#3b5bdb]/60 bg-[#3b5bdb]/10'
                  : 'border-white/[0.04] bg-white/[0.02] hover:border-[#3b5bdb]/30 hover:bg-white/[0.04]'
              }`}
            >
              <div className="text-[10px] font-bold text-[#6b8aff]">
                {f.bid.flightNumber}
              </div>
              <div className="text-[9px] text-[var(--text-primary)] mt-0.5">
                {f.bid.depIcao} → {f.bid.arrIcao}
              </div>
              {f.pilot && (
                <div className="text-[9px] text-[var(--text-secondary)] mt-0.5">
                  {f.pilot.callsign} - {f.pilot.name}
                </div>
              )}
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[8px] text-[var(--text-label)]">{f.bid.aircraftType}</span>
                <VatsimBadge connected={f.vatsimConnected} callsign={f.vatsimCallsign} />
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // Default: Airport cards
  return (
    <div className="p-2 space-y-2">
      <AirportCard
        label="Origin"
        icao={flightPlan?.origin ?? '----'}
        active
      />
      <AirportCard
        label="Destination"
        icao={flightPlan?.destination ?? '----'}
      />
      {flightPlan?.alternates.map((alt) => (
        <AirportCard key={alt} label="Dest Alt" icao={alt} />
      ))}
      {(!flightPlan || flightPlan.alternates.length === 0) && (
        <>
          <AirportCard label="Dest Alt 1" icao="----" />
          <AirportCard label="Dest Alt 2" icao="----" />
        </>
      )}
    </div>
  );
}
