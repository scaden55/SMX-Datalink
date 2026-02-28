import { TopBar } from './TopBar';
import { FlightPlanPanel } from '../flight-plan/FlightPlanPanel';
import { InfoPanel } from '../info-panel/InfoPanel';
import { SidebarPanel } from '../sidebar/SidebarPanel';
import { useUIStore } from '../../stores/uiStore';
import type { DispatchFlight } from '@acars/shared';

interface AppShellProps {
  dispatchFlight?: DispatchFlight | null;
  flights?: DispatchFlight[];
  selectedBidId?: number | null;
  onSelectFlight?: (bidId: number) => void;
  ruleChips?: string[];
}

export function AppShell({ dispatchFlight, flights, selectedBidId, onSelectFlight, ruleChips }: AppShellProps) {
  const viewMode = useUIStore((s) => s.viewMode);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);

  return (
    <div className="flex h-full flex-col">
      {/* Dispatch-specific toolbar (view mode toggle, connection badges) */}
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — Flight Plan Details */}
        {(viewMode === 'planning' || viewMode === 'both') && (
          <div className="w-[38%] min-w-[380px] overflow-y-auto border-r border-acars-border">
            <FlightPlanPanel
              ofp={dispatchFlight?.ofpJson ?? null}
              formData={dispatchFlight?.flightPlanData ?? null}
              ruleChips={ruleChips}
              pilot={dispatchFlight?.pilot}
              flightNumber={dispatchFlight?.bid.flightNumber}
            />
          </div>
        )}

        {/* Right panel — Map / Info tabs (flush against divider, no gap) */}
        {(viewMode === 'map' || viewMode === 'both') && (
          <div className="flex-1 overflow-hidden">
            <InfoPanel />
          </div>
        )}

        {/* Right sidebar — Airport cards or admin flight selector */}
        {sidebarOpen && (
          <div className="w-[180px] border-l border-acars-border overflow-y-auto">
            <SidebarPanel
              flights={flights}
              selectedBidId={selectedBidId}
              onSelectFlight={onSelectFlight}
            />
          </div>
        )}
      </div>
    </div>
  );
}
