import { useTelemetry } from '../../hooks/useTelemetry';
import { useDispatchEdit } from '../../contexts/DispatchEditContext';
import { FlightHeader } from './FlightHeader';
import { ScenarioBar } from './ScenarioBar';
import { AircraftSection } from './AircraftSection';
import { FuelSection } from './FuelSection';
import { WeightsSection } from './WeightsSection';
import { RouteSection } from './RouteSection';
import { MELSection } from './MELSection';
import { TerrainSection } from './TerrainSection';
import { RemarksSection } from './RemarksSection';
import type { SimBriefOFP, FlightPlanFormData } from '@acars/shared';

interface FlightPlanPanelProps {
  ofp?: SimBriefOFP | null;
  formData?: FlightPlanFormData | null;
}

export function FlightPlanPanel({ ofp, formData }: FlightPlanPanelProps) {
  const { aircraft, fuel } = useTelemetry();
  const { canEdit, saving, lastSavedAt } = useDispatchEdit();

  return (
    <div className="bg-acars-bg">
      <div className="border-b border-acars-border px-3 py-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-acars-muted uppercase tracking-wider">
          Flight Plan Details
        </h2>
        {canEdit && (
          <span className="text-[10px] font-medium">
            {saving ? (
              <span className="text-acars-amber">Saving...</span>
            ) : lastSavedAt ? (
              <span className="text-acars-green">Saved</span>
            ) : null}
          </span>
        )}
      </div>

      <FlightHeader ofp={ofp} formData={formData} />
      <ScenarioBar formData={formData} />

      <div className="space-y-0">
        <AircraftSection
          title={aircraft?.title ?? '---'}
          tailNumber={aircraft?.atcId ?? '---'}
          type={aircraft?.atcType ?? '---'}
        />
        <MELSection melRestrictions={formData?.melRestrictions ?? ''} />
        <RouteSection />
        <FuelSection
          totalWeight={fuel?.totalQuantityWeight ?? null}
          fuelPct={fuel?.fuelPercentage ?? null}
          ofpFuel={ofp?.fuel ?? null}
        />
        <WeightsSection ofpWeights={ofp?.weights ?? null} />
        <TerrainSection ofp={ofp} />
      </div>

      <RemarksSection
        dispatcherRemarks={formData?.dispatcherRemarks ?? ''}
        autoRemarks={formData?.autoRemarks ?? ''}
      />
    </div>
  );
}
