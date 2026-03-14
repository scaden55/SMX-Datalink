import { useDispatchTelemetry } from '../../hooks/useDispatchTelemetry';
import { useDispatchEdit } from '../../contexts/DispatchEditContext';
import { useAuthStore } from '../../stores/authStore';
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
  pilot?: { callsign: string; name: string };
  flightNumber?: string;
}

export function FlightPlanPanel({ ofp, formData, ruleChips, pilot, flightNumber }: FlightPlanPanelProps) {
  const { aircraft } = useDispatchTelemetry();
  const { canEdit, saving, lastSavedAt, isOwnFlight } = useDispatchEdit();
  const user = useAuthStore((s) => s.user);
  const callsign = pilot?.callsign ?? (isOwnFlight ? user?.callsign : undefined);

  return (
    <div className="bg-acars-bg">
      {/* Observing banner — shown when admin is viewing another pilot's flight */}
      {!isOwnFlight && pilot && (
        <div className="border-b border-amber-400/30 bg-amber-400/5 px-3 py-1.5 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Observing</span>
          <span className="text-[11px] text-acars-text font-mono">
            {pilot.callsign} — {flightNumber}
          </span>
        </div>
      )}

      {/* Flight Plan Details header */}
      <div className="border-b border-acars-border px-3 py-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-acars-muted uppercase tracking-wider">
          Flight Plan Details
        </h2>
        {canEdit && (
          <span className="text-[11px] font-medium">
            {saving ? (
              <span className="text-amber-400">Saving...</span>
            ) : lastSavedAt ? (
              <span className="text-emerald-400">Saved</span>
            ) : null}
          </span>
        )}
      </div>

      {/* Item 1: Flight Identity Block */}
      <FlightHeader ofp={ofp} formData={formData} pilotCallsign={callsign} />

      {/* Item 3: Scenario + Flight Rules chips */}
      <ScenarioBar formData={formData} ruleChips={ruleChips} />

      {/* Dispatch actions: Release Dispatch (admin) / End Flight (pilot) */}
      <DispatchActionBar />

      {/* Item 4: Runway / SID / STAR / Dest Alt */}
      <NavProcedureRow formData={formData} ofpSid={ofp?.sid} ofpStar={ofp?.star} />

      {/* Item 5: Aircraft / Cruise / CI / AOB + PIC */}
      <AircraftSection
        title={aircraft?.title ?? '---'}
        tailNumber={aircraft?.atcId ?? '---'}
        type={aircraft?.atcType ?? '---'}
        formData={formData}
        ofpPilotName={ofp?.pilotName}
        pilotName={pilot?.name}
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
      <FlightDetailSections ofp={ofp} formData={formData} pilotName={pilot?.name} />

    </div>
  );
}
