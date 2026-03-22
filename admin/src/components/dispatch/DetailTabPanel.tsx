import type { DispatchFlight, CargoManifest, AcarsMessagePayload } from '@acars/shared';
import WeatherTab from '@/components/dispatch/tabs/WeatherTab';
import NotamTab from '@/components/dispatch/tabs/NotamTab';
import AirportInfoTab from '@/components/dispatch/tabs/AirportInfoTab';
import OfpTab from '@/components/dispatch/tabs/OfpTab';
import AcarsTab from '@/components/dispatch/tabs/AcarsTab';
import AdvisoriesTab from '@/components/dispatch/tabs/AdvisoriesTab';
import FlightLogTab from '@/components/dispatch/tabs/FlightLogTab';
import CargoDetailTab from '@/components/dispatch/tabs/CargoDetailTab';

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
  { id: 'weather', label: 'Weather' },
  { id: 'notam', label: 'NOTAM' },
  { id: 'airport', label: 'Airport Info' },
  { id: 'ofp', label: 'OFP' },
  { id: 'messages', label: 'Messages' },
  { id: 'advisories', label: 'Advisories' },
  { id: 'log', label: 'Flight Log' },
  { id: 'cargo', label: 'Cargo' },
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
      <div className="flex overflow-x-auto border-b border-white/[0.06] shrink-0" style={{ scrollbarWidth: 'none' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`whitespace-nowrap px-3 py-2 text-[12px] uppercase tracking-[0.08em] font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] ${
              activeTab === tab.id
                ? 'text-[var(--accent-blue-bright)] border-b-2 border-[var(--accent)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content — scrollable */}
      <div className="flex-1 min-h-0 p-3 overflow-y-auto">
        {activeTab === 'weather' && <WeatherTab flight={flight} />}
        {activeTab === 'notam' && <NotamTab />}
        {activeTab === 'airport' && <AirportInfoTab flight={flight} />}
        {activeTab === 'ofp' && <OfpTab flight={flight} />}
        {activeTab === 'messages' && <AcarsTab bidId={bidId} messages={messages} />}
        {activeTab === 'advisories' && <AdvisoriesTab exceedances={exceedances} />}
        {activeTab === 'log' && <FlightLogTab flight={flight} track={track} />}
        {activeTab === 'cargo' && <CargoDetailTab cargo={cargo} />}
      </div>
    </div>
  );
}
