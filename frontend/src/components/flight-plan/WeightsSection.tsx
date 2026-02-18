import { CollapsibleSection } from '../common/CollapsibleSection';
import { DataField } from '../common/DataField';

export function WeightsSection() {
  return (
    <CollapsibleSection title="Weights" summary="PTOG: 248.5 | ATOG: 255.1-TO | PLDW: 189.0 | ALDW: 195.0-LD | PZFW: 175.0">
      <div className="grid grid-cols-5 gap-2">
        <DataField label="PTOG" value="248.5" />
        <DataField label="ATOG" value="255.1-TO" />
        <DataField label="PLDW" value="189.0" />
        <DataField label="ALDW" value="195.0-LD" />
        <DataField label="PZFW" value="175.0" />
      </div>
    </CollapsibleSection>
  );
}
