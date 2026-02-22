import { Mountain } from 'lucide-react';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

export function PlanningTerrainSection() {
  const { steps } = useFlightPlanStore();

  if (steps.length === 0) {
    return (
      <CollapsibleSection title="Terrain" icon={<Mountain className="w-3.5 h-3.5" />} defaultOpen>
        <p className="text-[11px] text-acars-muted font-sans">Generate OFP to see terrain data</p>
      </CollapsibleSection>
    );
  }

  const maxAlt = Math.max(...steps.map((s) => s.altitudeFt));
  const totalDist = steps[steps.length - 1]?.distanceFromOriginNm ?? 0;

  return (
    <CollapsibleSection
      title="Terrain"
      summary={`Max FL${Math.round(maxAlt / 100)}`}
      icon={<Mountain className="w-3.5 h-3.5" />}
      status="green"
      defaultOpen
    >
      <div className="grid grid-cols-3 gap-2.5">
        <div>
          <span className="planning-label">Max Alt</span>
          <span className="data-value">{maxAlt.toLocaleString()} ft</span>
        </div>
        <div>
          <span className="planning-label">Distance</span>
          <span className="data-value">{Math.round(totalDist).toLocaleString()} nm</span>
        </div>
        <div>
          <span className="planning-label">Waypoints</span>
          <span className="data-value">{steps.length}</span>
        </div>
      </div>
    </CollapsibleSection>
  );
}
