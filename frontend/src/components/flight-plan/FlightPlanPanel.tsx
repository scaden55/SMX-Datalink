import { useDispatchTelemetry } from '../../hooks/useDispatchTelemetry';
import { useDispatchEdit } from '../../contexts/DispatchEditContext';
import { FlightHeader } from './FlightHeader';
import { ScenarioBar } from './ScenarioBar';
import { NavProcedureRow } from './NavProcedureRow';
import { AircraftSection } from './AircraftSection';
import { WeightsSection } from './WeightsSection';
import { CargoSummaryRow } from '../cargo/CargoSummaryRow';
import { DispatchActionBar } from './DispatchActionBar';
import { RemarksSection } from './RemarksSection';
import { FlightDetailSections } from './FlightDetailSections';
import type { SimBriefOFP, FlightPlanFormData } from '@acars/shared';

interface FlightPlanPanelProps {
  ofp?: SimBriefOFP | null;
  formData?: FlightPlanFormData | null;
  ruleChips?: string[];
}

export function FlightPlanPanel({ ofp, formData, ruleChips }: FlightPlanPanelProps) {
  const { aircraft } = useDispatchTelemetry();
  const { canEdit, saving, lastSavedAt } = useDispatchEdit();

  return (
    <div className="bg-acars-bg">
      {/* Flight Plan Details header */}
      <div className="border-b border-acars-border px-3 py-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-acars-muted uppercase tracking-wider">
          Flight Plan Details
        </h2>
        {canEdit && (
          <span className="text-[10px] font-medium">
            {saving ? (
              <span className="text-amber-400">Saving...</span>
            ) : lastSavedAt ? (
              <span className="text-emerald-400">Saved</span>
            ) : null}
          </span>
        )}
      </div>

      {/* Item 1: Flight Identity Block */}
      <FlightHeader ofp={ofp} formData={formData} />

      {/* Item 3: Scenario + Flight Rules chips */}
      <ScenarioBar formData={formData} ruleChips={ruleChips} />

      {/* Dispatch actions: Release Dispatch (admin) / End Flight (pilot) */}
      <DispatchActionBar />

      {/* Item 4: Runway / SID / STAR / Dest Alt */}
      <NavProcedureRow formData={formData} />

      {/* Item 5: Aircraft / Cruise / CI / AOB + PIC */}
      <AircraftSection
        title={aircraft?.title ?? '---'}
        tailNumber={aircraft?.atcId ?? '---'}
        type={aircraft?.atcType ?? '---'}
        formData={formData}
      />

      {/* Item 6: Weights + Fuel row */}
      <WeightsSection
        ofpWeights={ofp?.weights ?? null}
        ofpFuel={ofp?.fuel ?? null}
      />

      {/* Cargo */}
      <CargoSummaryRow />

      <RemarksSection
        dispatcherRemarks={formData?.dispatcherRemarks ?? ''}
        autoRemarks={formData?.autoRemarks ?? ''}
      />

      {/* In-depth collapsible detail sections */}
      <FlightDetailSections ofp={ofp} formData={formData} />

    </div>
  );
}
