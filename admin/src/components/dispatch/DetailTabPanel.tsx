import type { DispatchFlight, CargoManifest, AcarsMessagePayload } from '@acars/shared';
import OfpTab from '@/components/dispatch/tabs/OfpTab';
import WeatherTab from '@/components/dispatch/tabs/WeatherTab';
import AcarsTab from '@/components/dispatch/tabs/AcarsTab';
import CargoDetailTab from '@/components/dispatch/tabs/CargoDetailTab';
import ExceedancesTab from '@/components/dispatch/tabs/ExceedancesTab';
import FlightLogTab from '@/components/dispatch/tabs/FlightLogTab';

interface DetailTabPanelProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  flight: DispatchFlight;
  cargo: CargoManifest | null;
  messages: AcarsMessagePayload[];
  exceedances: any[];
  bidId: number;
  track: any[];
}

const TABS = [
  { id: 'ofp', label: 'OFP' },
  { id: 'weather', label: 'Weather' },
  { id: 'acars', label: 'ACARS' },
  { id: 'cargo', label: 'Cargo' },
  { id: 'exceedances', label: 'Exceedances' },
  { id: 'log', label: 'Log' },
];

export default function DetailTabPanel({
  activeTab,
  onTabChange,
  flight,
  cargo,
  messages,
  exceedances,
  bidId,
  track,
}: DetailTabPanelProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Tab bar */}
      <div className="flex border-b border-[var(--surface-3)] bg-[var(--surface-1)] px-3">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-3 py-2 text-[10px] uppercase tracking-wider transition-colors ${
              activeTab === tab.id
                ? 'text-[var(--accent-blue-bright)] border-b-2 border-[var(--accent)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 p-3 overflow-y-auto">
        {activeTab === 'ofp' && <OfpTab flight={flight} />}
        {activeTab === 'weather' && <WeatherTab flight={flight} />}
        {activeTab === 'acars' && <AcarsTab bidId={bidId} messages={messages} />}
        {activeTab === 'cargo' && <CargoDetailTab cargo={cargo} />}
        {activeTab === 'exceedances' && <ExceedancesTab exceedances={exceedances} />}
        {activeTab === 'log' && <FlightLogTab flight={flight} track={track} />}
      </div>
    </div>
  );
}
