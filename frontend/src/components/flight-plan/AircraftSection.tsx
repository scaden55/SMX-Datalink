import { CollapsibleSection } from '../common/CollapsibleSection';

interface AircraftSectionProps {
  title: string;
  tailNumber: string;
  type: string;
}

export function AircraftSection({ title, tailNumber, type }: AircraftSectionProps) {
  return (
    <CollapsibleSection
      title="Aircraft"
      summary={`${tailNumber} | ${type}`}
      defaultOpen
    >
      <div className="grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <span className="data-label">Aircraft</span>
          <div className="data-value">{title || '---'}</div>
        </div>
        <div>
          <span className="data-label">Tail Number</span>
          <div className="data-value">{tailNumber}</div>
        </div>
        <div>
          <span className="data-label">Type</span>
          <div className="data-value">{type}</div>
        </div>
        <div>
          <span className="data-label">Cruise</span>
          <div className="data-value">CI</div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
