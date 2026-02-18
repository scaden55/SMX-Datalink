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

interface AirportButtonProps {
  label: string;
  icao: string;
  color: string;
  active: boolean;
  onClick: () => void;
}

function AirportButton({ label, icao, color, active, onClick }: AirportButtonProps) {
  if (!icao) return null;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
        active
          ? 'bg-acars-bg border border-acars-border text-acars-text'
          : 'text-acars-muted hover:text-acars-text hover:bg-acars-bg/50'
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-[9px] uppercase tracking-wider font-medium">{label}</span>
      <span className="font-mono font-semibold">{icao}</span>
    </button>
  );
}

export function PlanningInfoPanel() {
  const { planningTab, setPlanningTab, form, selectedAirportIcao, setSelectedAirportIcao } = useFlightPlanStore();

  const handleAirportClick = (icao: string) => {
    setSelectedAirportIcao(icao);
  };

  return (
    <div className="flex flex-col border-t border-acars-border flex-1 min-h-0 bg-acars-panel">
      <TabBar tabs={TABS} active={planningTab} onChange={setPlanningTab} />
      {planningTab === 'airport-info' && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-acars-border bg-acars-bg/30">
          <AirportButton
            label="Orig"
            icao={form.origin}
            color="#3fb950"
            active={selectedAirportIcao === form.origin}
            onClick={() => handleAirportClick(form.origin)}
          />
          <AirportButton
            label="Dest"
            icao={form.destination}
            color="#f85149"
            active={selectedAirportIcao === form.destination}
            onClick={() => handleAirportClick(form.destination)}
          />
          <AirportButton
            label="Alt1"
            icao={form.alternate1}
            color="#d29922"
            active={selectedAirportIcao === form.alternate1}
            onClick={() => handleAirportClick(form.alternate1)}
          />
          <AirportButton
            label="Alt2"
            icao={form.alternate2}
            color="#d29922"
            active={selectedAirportIcao === form.alternate2}
            onClick={() => handleAirportClick(form.alternate2)}
          />
        </div>
      )}
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
