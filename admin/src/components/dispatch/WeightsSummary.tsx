import type { DispatchFlight } from '@acars/shared';

function formatWeight(val: number | string | undefined): string {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (!num || isNaN(num)) return '—';
  return `${(num / 1000).toFixed(1)}K`;
}

function weightColor(est: number, max: number): string {
  if (!est || !max) return 'text-[var(--text-primary)]';
  const ratio = est / max;
  if (ratio > 1) return 'text-red-400';
  if (ratio > 0.95) return 'text-amber-400';
  return 'text-emerald-400';
}

function WeightCell({
  label,
  estValue,
  maxValue,
}: {
  label: string;
  estValue: number | string | undefined;
  maxValue: number | undefined;
}) {
  const est = typeof estValue === 'string' ? parseFloat(estValue) : (estValue ?? 0);
  const max = maxValue ?? 0;

  return (
    <div className="text-center">
      <div className="text-[8px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">{label}</div>
      <div className={`font-mono text-[13px] font-semibold tabular-nums ${weightColor(est, max)}`}>
        {formatWeight(estValue)}
      </div>
      {max > 0 && (
        <div className="font-mono text-[9px] tabular-nums text-[var(--text-muted)]">
          / {formatWeight(max)}
        </div>
      )}
    </div>
  );
}

export default function WeightsSummary({ flight }: { flight: DispatchFlight }) {
  const fpd = flight.flightPlanData;
  const weights = flight.ofpJson?.weights;

  return (
    <div className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-md px-3 py-2.5">
      <div className="grid grid-cols-3 gap-3">
        <WeightCell label="ZFW" estValue={fpd?.estZfw} maxValue={weights?.maxZfw} />
        <WeightCell label="TOW" estValue={fpd?.estTow} maxValue={weights?.maxTow} />
        <WeightCell label="LDW" estValue={fpd?.estLdw} maxValue={weights?.maxLdw} />
      </div>
    </div>
  );
}
