import { TabBar } from '../common/TabBar';
import { useUIStore, type InfoTab } from '../../stores/uiStore';
import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { useDispatchData } from '../../hooks/useDispatchData';
import { WeatherTab } from './WeatherTab';
import { NOTAMTab } from './NOTAMTab';
import { AirportInfoTab } from './AirportInfoTab';
import { SuitabilityTab } from './SuitabilityTab';
import { OFPTab } from './OFPTab';
import { MessagesTab } from './MessagesTab';
import { TracksTab } from './TracksTab';
import { AdvisoriesTab } from './AdvisoriesTab';
import { FlightLogTab } from './FlightLogTab';
import { FlightMap } from '../map/FlightMap';

const TABS: { id: InfoTab; label: string }[] = [
  { id: 'weather', label: 'Weather' },
  { id: 'notam', label: 'NOTAM' },
  { id: 'airport-info', label: 'Airport Info' },
  { id: 'suitability', label: 'Suitability' },
  { id: 'ofp', label: 'OFP' },
  { id: 'messages', label: 'Messages' },
  { id: 'tracks', label: 'Tracks' },
  { id: 'advisories', label: 'Advisories' },
  { id: 'flight-log', label: 'Flight Log' },
];

export function InfoPanel() {
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const flightPlan = useFlightPlanStore((s) => s.flightPlan);

  const origin = flightPlan?.origin;
  const destination = flightPlan?.destination;
  const dispatchData = useDispatchData(origin, destination);

  function renderTab() {
    switch (activeTab) {
      case 'weather':
        return <WeatherTab dispatchData={dispatchData} />;
      case 'notam':
        return <NOTAMTab dispatchData={dispatchData} />;
      case 'airport-info':
        return <AirportInfoTab dispatchData={dispatchData} />;
      case 'suitability':
        return <SuitabilityTab dispatchData={dispatchData} />;
      case 'ofp':
        return <OFPTab />;
      case 'messages':
        return <MessagesTab />;
      case 'tracks':
        return <TracksTab />;
      case 'advisories':
        return <AdvisoriesTab />;
      case 'flight-log':
        return <FlightLogTab />;
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Map section — top half */}
      <div className="h-1/2 min-h-[200px]">
        <FlightMap />
      </div>

      {/* Tab section — bottom half */}
      <div className="flex flex-1 flex-col overflow-hidden border-t border-acars-border">
        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
        <div className="flex-1 overflow-y-auto p-3">
          {renderTab()}
        </div>
      </div>
    </div>
  );
}
