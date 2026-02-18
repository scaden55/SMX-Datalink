import { CollapsibleSection } from '../common/CollapsibleSection';

export function TerrainSection() {
  return (
    <CollapsibleSection title="Terrain" summary="M1 | METW 145.1 | Anti Ice: Auto (Engine)">
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <span className="data-label">Category</span>
          <div className="data-value">M1</div>
        </div>
        <div>
          <span className="data-label">METW</span>
          <div className="data-value">145.1</div>
        </div>
        <div>
          <span className="data-label">Anti Ice</span>
          <div className="data-value">Auto (Engine)</div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
