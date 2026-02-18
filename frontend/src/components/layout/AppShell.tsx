import { TopBar } from './TopBar';
import { FlightPlanPanel } from '../flight-plan/FlightPlanPanel';
import { InfoPanel } from '../info-panel/InfoPanel';
import { SidebarPanel } from '../sidebar/SidebarPanel';
import { useUIStore } from '../../stores/uiStore';

export function AppShell() {
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
            <FlightPlanPanel />
          </div>
        )}

        {/* Right panel — Map / Info tabs */}
        {(viewMode === 'map' || viewMode === 'both') && (
          <div className="flex-1 overflow-hidden">
            <InfoPanel />
          </div>
        )}

        {/* Right sidebar — Airport cards */}
        {sidebarOpen && (
          <div className="w-[180px] border-l border-acars-border overflow-y-auto">
            <SidebarPanel />
          </div>
        )}
      </div>
    </div>
  );
}
