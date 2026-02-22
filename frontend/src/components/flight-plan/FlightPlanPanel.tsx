import { useTelemetry } from '../../hooks/useTelemetry';
import { useDispatchEdit } from '../../contexts/DispatchEditContext';
import { FlightHeader } from './FlightHeader';
import { ScenarioBar } from './ScenarioBar';
import { NavProcedureRow } from './NavProcedureRow';
import { AircraftSection } from './AircraftSection';
import { WeightsSection } from './WeightsSection';
import { FuelSection } from './FuelSection';
import { RouteSection } from './RouteSection';
import { MELSection } from './MELSection';
import { TerrainSection } from './TerrainSection';
import { RemarksSection } from './RemarksSection';
import type { SimBriefOFP, FlightPlanFormData } from '@acars/shared';

interface FlightPlanPanelProps {
  ofp?: SimBriefOFP | null;
  formData?: FlightPlanFormData | null;
  ruleChips?: string[];
}

export function FlightPlanPanel({ ofp, formData, ruleChips }: FlightPlanPanelProps) {
  const { aircraft, fuel } = useTelemetry();
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

      {/* Item 4: Runway / SID / STAR / Dest Alt */}
      <NavProcedureRow formData={formData} />

      {/* Item 5: Aircraft / Cruise / CI / AOB + PIC */}
      <AircraftSection
        title={aircraft?.title ?? '---'}
        tailNumber={aircraft?.atcId ?? '---'}
        type={aircraft?.atcType ?? '---'}
        formData={formData}
      />

      {/* Item 6: Weights row */}
      <WeightsSection ofpWeights={ofp?.weights ?? null} />

      {/* Item 7: Bottom collapsible sections with checkmarks */}
      <div className="space-y-0">
        <AircraftDetailRow
          label="Aircraft"
          summary={`${aircraft?.atcId ?? '---'} | ${aircraft?.atcType ?? '---'}`}
          complete={!!aircraft}
        />
        <MELSection melRestrictions={formData?.melRestrictions ?? ''} />
        <RouteSection />
        <FuelSection
          totalWeight={fuel?.totalQuantityWeight ?? null}
          fuelPct={fuel?.fuelPercentage ?? null}
          ofpFuel={ofp?.fuel ?? null}
        />
        <TerrainSection ofp={ofp} />
      </div>

      <RemarksSection
        dispatcherRemarks={formData?.dispatcherRemarks ?? ''}
        autoRemarks={formData?.autoRemarks ?? ''}
      />
    </div>
  );
}

/** Lightweight summary row for the bottom section list */
function AircraftDetailRow({ label, summary, complete }: { label: string; summary: string; complete: boolean }) {
  return (
    <div className="border-b border-acars-border flex items-center h-8 px-3">
      {complete ? (
        <svg className="w-3 h-3 text-[#22c55e] shrink-0 mr-2" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <span className="w-2 h-2 rounded-full bg-[#333840] shrink-0 mr-2" />
      )}
      <span className="text-[11px] font-sans text-[#949aa2]">{label}</span>
      <span className="ml-auto text-[11px] font-mono text-[#cdd1d8] truncate max-w-[200px]">{summary}</span>
      <svg className="w-3 h-3 text-acars-muted/60 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}
