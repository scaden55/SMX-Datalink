import { TabBar } from '../common/TabBar';
import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { PlanningWeatherTab } from './PlanningWeatherTab';
import { PlanningNOTAMTab } from './PlanningNOTAMTab';
import { PlanningAirportInfoTab } from './PlanningAirportInfoTab';
import { PlanningOFPTab } from './PlanningOFPTab';
import { PlanningWeightBalanceTab } from './PlanningWeightBalanceTab';
import { PlanningFlightLogTab } from './PlanningFlightLogTab';
import { PlanningCargoTab } from '../cargo/PlanningCargoTab';
import type { PlanningInfoTab } from '@acars/shared';

const TABS: { id: PlanningInfoTab; label: string }[] = [
  { id: 'weather', label: 'WX' },
  { id: 'notam', label: 'NOTAMs' },
  { id: 'airport-info', label: 'Airport' },
  { id: 'ofp', label: 'OFP' },
  { id: 'weight-balance', label: 'W&B' },
  { id: 'flight-log', label: 'Log' },
  { id: 'cargo', label: 'Cargo' },
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
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] transition-colors duration-100 ${
        active
          ? 'bg-acars-input border border-acars-border text-acars-text'
          : 'text-acars-muted hover:text-acars-text hover:bg-acars-input/50'
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="uppercase tracking-[0.08em] font-medium">{label}</span>
      <span className="tabular-nums font-semibold text-acars-text">{icao}</span>
    </button>
  );
}

export function PlanningInfoPanel() {
  const { planningTab, setPlanningTab, form, selectedAirportIcao, setSelectedAirportIcao } = useFlightPlanStore();

  const handleAirportClick = (icao: string) => {
    setSelectedAirportIcao(icao);
  };

  return (
    <div className="flex flex-col border-t border-white/[0.06] flex-[2] min-h-0">
      <TabBar tabs={TABS} active={planningTab} onChange={setPlanningTab} />
      {planningTab === 'airport-info' && (
        <div className="flex items-center gap-1 px-3 py-1 border-b border-white/[0.06] bg-white/[0.02]">
          <AirportButton
            label="Orig"
            icao={form.origin}
            color="var(--status-green)"
            active={selectedAirportIcao === form.origin}
            onClick={() => handleAirportClick(form.origin)}
          />
          <AirportButton
            label="Dest"
            icao={form.destination}
            color="var(--status-red)"
            active={selectedAirportIcao === form.destination}
            onClick={() => handleAirportClick(form.destination)}
          />
          <AirportButton
            label="Alt1"
            icao={form.alternate1}
            color="var(--status-amber)"
            active={selectedAirportIcao === form.alternate1}
            onClick={() => handleAirportClick(form.alternate1)}
          />
          <AirportButton
            label="Alt2"
            icao={form.alternate2}
            color="var(--status-amber)"
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
        {planningTab === 'cargo' && <PlanningCargoTab />}
      </div>
    </div>
  );
}
