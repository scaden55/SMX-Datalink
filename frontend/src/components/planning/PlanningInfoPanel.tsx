import { TabBar } from '../common/TabBar';
import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { PlanningWeatherTab } from './PlanningWeatherTab';
import { PlanningNOTAMTab } from './PlanningNOTAMTab';
import { PlanningAirportInfoTab } from './PlanningAirportInfoTab';
import { PlanningOFPTab } from './PlanningOFPTab';
import { PlanningWeightBalanceTab } from './PlanningWeightBalanceTab';
import { PlanningFlightLogTab } from './PlanningFlightLogTab';
import type { PlanningInfoTab } from '@acars/shared';

const TABS: { id: PlanningInfoTab; label: string }[] = [
  { id: 'weather', label: 'Weather' },
  { id: 'notam', label: 'NOTAMs' },
  { id: 'airport-info', label: 'Airport' },
  { id: 'ofp', label: 'OFP' },
  { id: 'weight-balance', label: 'W&B' },
  { id: 'flight-log', label: 'Log' },
];

export function PlanningInfoPanel() {
  const { planningTab, setPlanningTab } = useFlightPlanStore();

  return (
    <div className="flex flex-col border-t border-acars-border flex-1 min-h-0 bg-acars-panel">
      <TabBar tabs={TABS} active={planningTab} onChange={setPlanningTab} />
      <div className="flex-1 overflow-auto min-h-0">
        {planningTab === 'weather' && <PlanningWeatherTab />}
        {planningTab === 'notam' && <PlanningNOTAMTab />}
        {planningTab === 'airport-info' && <PlanningAirportInfoTab />}
        {planningTab === 'ofp' && <PlanningOFPTab />}
        {planningTab === 'weight-balance' && <PlanningWeightBalanceTab />}
        {planningTab === 'flight-log' && <PlanningFlightLogTab />}
      </div>
    </div>
  );
}
