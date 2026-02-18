import { PlanningBidSelector } from './PlanningBidSelector';
import { PlanningHeader } from './PlanningHeader';
import { PlanningAircraftSection } from './PlanningAircraftSection';
import { PlanningRouteSection } from './PlanningRouteSection';
import { PlanningOptionsSection } from './PlanningOptionsSection';
import { PlanningAlternatesSection } from './PlanningAlternatesSection';
import { PlanningFuelSection } from './PlanningFuelSection';
import { PlanningWeightsSection } from './PlanningWeightsSection';
import { PlanningSimBriefSection } from './PlanningSimBriefSection';
import { PlanningMELSection } from './PlanningMELSection';
import { PlanningTerrainSection } from './PlanningTerrainSection';
import { PlanningRemarksSection } from './PlanningRemarksSection';
import { PlanningGenerateBar } from './PlanningGenerateBar';
import type { BidWithDetails } from '@acars/shared';

interface Props {
  bids: BidWithDetails[];
  onSelectBid: (bidId: number) => void;
  onGenerate: () => void;
  onFetchLatest: () => void;
  onSave: () => void;
}

export function PlanningLeftPanel({ bids, onSelectBid, onGenerate, onFetchLatest, onSave }: Props) {
  return (
    <div className="w-[380px] shrink-0 border-r border-acars-border flex flex-col bg-acars-panel overflow-hidden">
      <PlanningBidSelector bids={bids} onSelect={onSelectBid} />
      <div className="flex-1 overflow-auto">
        <PlanningHeader />
        <PlanningAircraftSection />
        <PlanningRouteSection />
        <PlanningOptionsSection />
        <PlanningAlternatesSection />
        <PlanningFuelSection />
        <PlanningWeightsSection />
        <PlanningSimBriefSection />
        <PlanningMELSection />
        <PlanningTerrainSection />
        <PlanningRemarksSection />
      </div>
      <PlanningGenerateBar onGenerate={onGenerate} onFetchLatest={onFetchLatest} onSave={onSave} />
    </div>
  );
}
