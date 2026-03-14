import { useCargoStore } from '../../stores/cargoStore';
import { LoadSummary } from './LoadSummary';
import { ULDManifest } from './ULDManifest';
import { NOTOCSection } from './NOTOCSection';

export function PlanningCargoTab() {
  const { manifest, generating } = useCargoStore();

  if (generating) {
    return (
      <div className="flex items-center justify-center h-32">
        <span className="text-[12px] text-acars-muted animate-pulse">Generating cargo manifest...</span>
      </div>
    );
  }

  if (!manifest) {
    return (
      <div className="flex items-center justify-center h-32">
        <span className="text-[12px] text-acars-muted">Generate OFP to see cargo manifest</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-3">
      <LoadSummary manifest={manifest} />
      <ULDManifest manifest={manifest} />
      {manifest.notocRequired && <NOTOCSection manifest={manifest} />}
    </div>
  );
}
