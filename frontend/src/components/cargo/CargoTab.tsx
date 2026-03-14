import { useCargoStore } from '../../stores/cargoStore';
import { LoadSummary } from './LoadSummary';
import { ULDManifest } from './ULDManifest';
import { NOTOCSection } from './NOTOCSection';

export function CargoTab() {
  const manifest = useCargoStore((s) => s.manifest);

  if (!manifest) {
    return (
      <div className="flex items-center justify-center h-32">
        <span className="text-[12px] text-acars-muted">No cargo manifest available</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <LoadSummary manifest={manifest} />
      <ULDManifest manifest={manifest} />
      {manifest.notocRequired && <NOTOCSection manifest={manifest} />}
    </div>
  );
}
