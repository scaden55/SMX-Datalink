import { CollapsibleSection } from '../common/CollapsibleSection';
import type { SimBriefOFP } from '@acars/shared';

interface TerrainSectionProps {
  ofp?: SimBriefOFP | null;
}

export function TerrainSection({ ofp }: TerrainSectionProps) {
  const cruiseAlt = ofp?.cruiseAltitude;
  const cruiseStr = cruiseAlt ? `FL${Math.round(cruiseAlt / 100)}` : '---';
  const costIndex = ofp?.costIndex;
  const costStr = costIndex != null && costIndex > 0 ? String(costIndex) : '---';

  const summary = cruiseAlt ? `Cruise ${cruiseStr} | CI ${costStr}` : '---';

  return (
    <CollapsibleSection
      title="Terrain"
      summary={summary}
      useCheckmark
      status={cruiseAlt ? 'green' : 'grey'}
      defaultOpen
    >
      <div className="grid grid-cols-3 gap-2 text-[12px]">
        <div>
          <span className="data-label">Cruise Alt</span>
          <div className="data-value">{cruiseStr}</div>
        </div>
        <div>
          <span className="data-label">Cost Index</span>
          <div className="data-value">{costStr}</div>
        </div>
        <div>
          <span className="data-label">Aircraft</span>
          <div className="data-value">{ofp?.aircraftType ?? '---'}</div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
