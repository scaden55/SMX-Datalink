import { PlanningHeader } from './PlanningHeader';
import { PlanningAircraftSection } from './PlanningAircraftSection';
import { PlanningRouteSection } from './PlanningRouteSection';
import { PlanningOptionsSection } from './PlanningOptionsSection';
import { PlanningAlternatesSection } from './PlanningAlternatesSection';
import { PlanningFuelSection } from './PlanningFuelSection';
import { PlanningWeightsSection } from './PlanningWeightsSection';
import { CargoConfigPanel } from '../cargo/CargoConfigPanel';
import { PlanningSimBriefSection } from './PlanningSimBriefSection';
import { PlanningMELSection } from './PlanningMELSection';
import { PlanningTerrainSection } from './PlanningTerrainSection';
import { PlanningRemarksSection } from './PlanningRemarksSection';
import { PlanningGenerateBar } from './PlanningGenerateBar';

interface Props {
  onGenerate: () => void;
  onFetch: () => void;
  onStartFlight: () => void;
}

export function PlanningLeftPanel({ onGenerate, onFetch, onStartFlight }: Props) {
  return (
    <div className="w-[420px] shrink-0 border-r border-white/[0.06] flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        <PlanningHeader />
        <PlanningAircraftSection />
        <PlanningRouteSection />
        <PlanningOptionsSection />
        <PlanningAlternatesSection />
        <PlanningFuelSection />
        <PlanningWeightsSection />
        <CargoConfigPanel />
        <PlanningSimBriefSection />
        <PlanningMELSection />
        <PlanningTerrainSection />
        <PlanningRemarksSection />
      </div>
      <PlanningGenerateBar onGenerate={onGenerate} onFetch={onFetch} onStartFlight={onStartFlight} />
    </div>
  );
}
