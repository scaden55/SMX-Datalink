import { CollapsibleSection } from '../common/CollapsibleSection';
import { DataField } from '../common/DataField';
import type { SimBriefWeights } from '@acars/shared';

interface WeightsSectionProps {
  ofpWeights?: SimBriefWeights | null;
}

function fmt(val: number | undefined | null): string {
  if (!val) return '---';
  return Math.round(val).toLocaleString();
}

export function WeightsSection({ ofpWeights }: WeightsSectionProps) {
  const w = ofpWeights;

  const summaryParts: string[] = [];
  if (w) {
    summaryParts.push(`ZFW: ${fmt(w.estZfw)}`);
    summaryParts.push(`TOW: ${fmt(w.estTow)}`);
    summaryParts.push(`LDW: ${fmt(w.estLdw)}`);
    summaryParts.push(`PAX: ${w.paxCount ?? '---'}`);
  }

  return (
    <CollapsibleSection title="Weights" summary={summaryParts.length > 0 ? summaryParts.join(' | ') : '---'} defaultOpen>
      <div className="grid grid-cols-5 gap-2">
        <div>
          <div className="data-label">ZFW</div>
          <div className="data-value">{fmt(w?.estZfw)}</div>
          {w?.maxZfw ? <div className="text-[9px] text-acars-muted">Max {fmt(w.maxZfw)}</div> : null}
        </div>
        <div>
          <div className="data-label">TOW</div>
          <div className="data-value">{fmt(w?.estTow)}</div>
          {w?.maxTow ? <div className="text-[9px] text-acars-muted">Max {fmt(w.maxTow)}</div> : null}
        </div>
        <div>
          <div className="data-label">LDW</div>
          <div className="data-value">{fmt(w?.estLdw)}</div>
          {w?.maxLdw ? <div className="text-[9px] text-acars-muted">Max {fmt(w.maxLdw)}</div> : null}
        </div>
        <DataField label="Payload" value={fmt(w?.payload)} unit="lbs" />
        <DataField label="PAX" value={w?.paxCount != null ? String(w.paxCount) : '---'} />
      </div>
    </CollapsibleSection>
  );
}
