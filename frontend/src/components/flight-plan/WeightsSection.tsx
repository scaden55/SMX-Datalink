import type { SimBriefWeights } from '@acars/shared';

interface WeightsSectionProps {
  ofpWeights?: SimBriefWeights | null;
}

function fmt(val: number | undefined | null): string {
  if (!val) return '---';
  return Math.round(val).toLocaleString();
}

interface WeightFieldProps {
  label: string;
  value: string;
  maxLabel?: string;
  warn?: boolean;
}

function WeightField({ label, value, maxLabel, warn }: WeightFieldProps) {
  return (
    <div className="flex flex-col items-start min-w-0 flex-1">
      <span className="text-[9px] font-medium uppercase tracking-[0.06em] text-[#5e646e]">{label}</span>
      <span
        className="text-[12px] font-mono leading-tight"
        style={{ color: warn ? '#f59e0b' : '#dde1e8' }}
      >
        {value}
      </span>
      {maxLabel && (
        <span className="text-[9px] font-sans text-[#454a52]">{maxLabel}</span>
      )}
    </div>
  );
}

export function WeightsSection({ ofpWeights }: WeightsSectionProps) {
  const w = ofpWeights;

  return (
    <div className="border-b border-acars-border px-3 py-2">
      <div className="flex items-start gap-2">
        <WeightField
          label="ZFW"
          value={fmt(w?.estZfw)}
          maxLabel={w?.maxZfw ? `Max ${fmt(w.maxZfw)}` : undefined}
        />
        <WeightField
          label="Plan Gate T/O"
          value={fmt(w?.estTow)}
          maxLabel={w?.maxTow ? `Max ${fmt(w.maxTow)}` : undefined}
        />
        <WeightField label="Taxi Out" value={fmt(w?.payload)} />
        <WeightField label="CF" value="---" />
        <WeightField label="Extra" value="---" />
        <WeightField
          label="ACF"
          value={fmt(w?.estLdw)}
          maxLabel={w?.maxLdw ? `Max ${fmt(w.maxLdw)}` : undefined}
        />
        <WeightField label="REMF" value="---" />
      </div>
    </div>
  );
}
