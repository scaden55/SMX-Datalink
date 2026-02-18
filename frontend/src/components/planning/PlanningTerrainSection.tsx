import { Mountain } from 'lucide-react';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

export function PlanningTerrainSection() {
  const { steps } = useFlightPlanStore();

  if (steps.length === 0) {
    return (
      <CollapsibleSection title="Terrain" icon={<Mountain className="w-3.5 h-3.5" />} defaultOpen>
        <p className="text-[10px] text-acars-muted">Generate OFP to see terrain data</p>
      </CollapsibleSection>
    );
  }

  const maxAlt = Math.max(...steps.map((s) => s.altitudeFt));
  const totalDist = steps[steps.length - 1]?.distanceFromOriginNm ?? 0;

  return (
    <CollapsibleSection title="Terrain" summary={`Max FL${Math.round(maxAlt / 100)}`} icon={<Mountain className="w-3.5 h-3.5" />} defaultOpen>
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <span className="text-acars-muted block">Max Altitude</span>
          <span className="text-acars-text font-mono">{maxAlt.toLocaleString()} ft</span>
        </div>
        <div>
          <span className="text-acars-muted block">Total Distance</span>
          <span className="text-acars-text font-mono">{Math.round(totalDist).toLocaleString()} nm</span>
        </div>
        <div>
          <span className="text-acars-muted block">Waypoints</span>
          <span className="text-acars-text font-mono">{steps.length}</span>
        </div>
      </div>
    </CollapsibleSection>
  );
}
