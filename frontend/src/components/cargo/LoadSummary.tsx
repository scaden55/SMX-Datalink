import type { CargoManifest } from '@acars/shared';

interface Props {
  manifest: CargoManifest;
}

function ProgressBar({ value, max, color = 'bg-blue-500' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-1.5 rounded-full bg-acars-input overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function LoadSummary({ manifest }: Props) {
  const unit = manifest.totalWeightUnit === 'LBS' ? 'lbs' : 'kg';
  const weight = Math.round(manifest.totalWeightDisplay).toLocaleString();
  const utilPct = manifest.payloadUtilization;

  // CG visualization
  const cgMin = manifest.cgRange.forward || 10;
  const cgMax = manifest.cgRange.aft || 45;
  const cgRange = cgMax - cgMin;
  const cgPct = cgRange > 0 ? ((manifest.cgPosition - cgMin) / cgRange) * 100 : 50;
  const cgTargetPct = cgRange > 0 ? ((manifest.cgTarget - cgMin) / cgRange) * 100 : 50;

  const sections = Object.entries(manifest.sectionWeights);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wide text-acars-muted">Load Summary</span>
        <span className="text-[10px] text-acars-muted tabular-nums">{manifest.manifestNumber}</span>
      </div>

      {/* Total weight + utilization */}
      <div>
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[18px] tabular-nums text-acars-text font-semibold">{weight} <span className="text-[11px] text-acars-muted font-normal">{unit}</span></span>
          <span className="text-[11px] tabular-nums text-blue-400">{utilPct}%</span>
        </div>
        <ProgressBar value={utilPct} max={100} />
        <div className="flex justify-between mt-0.5">
          <span className="text-[9px] text-acars-muted">Payload utilization</span>
          <span className="text-[9px] text-acars-muted tabular-nums">{manifest.ulds.length} ULDs</span>
        </div>
      </div>

      {/* CG Position */}
      <div>
        <span className="text-[10px] text-acars-muted block mb-1">CG Position (% MAC)</span>
        <div className="relative h-4 bg-acars-input rounded-sm overflow-hidden">
          {/* Green envelope */}
          <div
            className="absolute top-0 bottom-0 bg-green-500/20 border-x border-green-500/40"
            style={{ left: '0%', right: '0%' }}
          />
          {/* Target marker */}
          <div
            className="absolute top-0 bottom-0 w-px bg-green-500/60"
            style={{ left: `${cgTargetPct}%` }}
          />
          {/* Current CG indicator */}
          <div
            className="absolute top-0.5 bottom-0.5 w-2 rounded-sm bg-blue-500"
            style={{ left: `calc(${Math.max(0, Math.min(100, cgPct))}% - 4px)` }}
          />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[9px] text-acars-muted tabular-nums">{cgMin}%</span>
          <span className="text-[9px] tabular-nums text-acars-text">{manifest.cgPosition}% MAC</span>
          <span className="text-[9px] text-acars-muted tabular-nums">{cgMax}%</span>
        </div>
      </div>

      {/* Deck utilization breakdown */}
      <div className="space-y-1.5">
        <span className="text-[10px] text-acars-muted">Deck Utilization</span>
        {sections.map(([key, sec]) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-acars-text">{sec.name}</span>
              <span className="text-[10px] tabular-nums text-acars-muted">
                {Math.round(sec.weight).toLocaleString()} kg — {sec.utilization}%
              </span>
            </div>
            <ProgressBar value={sec.utilization} max={100} />
          </div>
        ))}
      </div>
    </div>
  );
}
