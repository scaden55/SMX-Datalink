import { useTelemetry } from '../../hooks/useTelemetry';
import { FlightHeader } from './FlightHeader';
import { ScenarioBar } from './ScenarioBar';
import { AircraftSection } from './AircraftSection';
import { FuelSection } from './FuelSection';
import { WeightsSection } from './WeightsSection';
import { RouteSection } from './RouteSection';
import { MELSection } from './MELSection';
import { TerrainSection } from './TerrainSection';
import { RemarksSection } from './RemarksSection';

export function FlightPlanPanel() {
  const { aircraft, fuel } = useTelemetry();

  return (
    <div className="bg-acars-bg">
      <div className="border-b border-acars-border px-3 py-2">
        <h2 className="text-xs font-semibold text-acars-muted uppercase tracking-wider">
          Flight Plan Details
        </h2>
      </div>

      <FlightHeader />
      <ScenarioBar />

      <div className="space-y-0">
        <AircraftSection
          title={aircraft?.title ?? '---'}
          tailNumber={aircraft?.atcId ?? '---'}
          type={aircraft?.atcType ?? '---'}
        />
        <MELSection />
        <RouteSection />
        <FuelSection
          totalWeight={fuel?.totalQuantityWeight ?? null}
          fuelPct={fuel?.fuelPercentage ?? null}
        />
        <WeightsSection />
        <TerrainSection />
      </div>

      <RemarksSection />
    </div>
  );
}
