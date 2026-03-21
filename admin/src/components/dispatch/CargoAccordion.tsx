import type { CargoManifest } from '@acars/shared';
import AccordionSection from './AccordionSection';

const labelClass = 'text-[8px] text-[var(--text-muted)] uppercase tracking-wider';
const valueClass = 'font-mono text-[11px] tabular-nums text-[var(--text-primary)]';

export default function CargoAccordion({ cargo }: { cargo: CargoManifest | null }) {
  if (!cargo) {
    return (
      <AccordionSection title="Cargo" summary="No cargo" status="neutral">
        <div className="text-[10px] text-[var(--text-muted)]">No cargo manifest loaded.</div>
      </AccordionSection>
    );
  }

  const uldCount = cargo.ulds?.length ?? 0;
  const weight = cargo.totalWeightDisplay ?? 0;
  const unit = cargo.totalWeightUnit ?? 'lbs';
  const cg = cargo.cgPosition ?? 0;
  const notoc = cargo.notocRequired;

  const summary = `${uldCount} ULDs · ${weight.toLocaleString()} ${unit} · CG ${cg.toFixed(1)}%`;
  const status = notoc ? 'amber' : 'green';

  return (
    <AccordionSection title="Cargo" summary={summary} status={status}>
      <div className="space-y-2">
        {/* Summary grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          <div>
            <div className={labelClass}>Manifest</div>
            <div className={valueClass}>{cargo.manifestNumber}</div>
          </div>
          <div>
            <div className={labelClass}>Total Weight</div>
            <div className={valueClass}>{weight.toLocaleString()} {unit}</div>
          </div>
          <div>
            <div className={labelClass}>ULD Count</div>
            <div className={valueClass}>{uldCount}</div>
          </div>
          <div>
            <div className={labelClass}>CG Position</div>
            <div className={valueClass}>{cg.toFixed(1)}%</div>
          </div>
          <div>
            <div className={labelClass}>Utilization</div>
            <div className={valueClass}>{((cargo.payloadUtilization ?? 0) * 100).toFixed(0)}%</div>
          </div>
          <div>
            <div className={labelClass}>NOTOC</div>
            <div className={`${valueClass} ${notoc ? 'text-amber-400' : ''}`}>
              {notoc ? 'Required' : 'None'}
            </div>
          </div>
        </div>

        {/* ULD table */}
        {uldCount > 0 && (
          <div className="mt-1">
            <div className={`${labelClass} mb-1`}>ULD List</div>
            <div className="space-y-px max-h-[140px] overflow-y-auto">
              {cargo.ulds.map((uld) => (
                <div
                  key={uld.uld_id}
                  className="flex items-center justify-between px-1.5 py-0.5 bg-[var(--surface-2)] rounded text-[10px]"
                >
                  <span className="font-mono text-[var(--text-primary)]">{uld.uld_id}</span>
                  <span className="text-[var(--text-muted)]">{uld.position}</span>
                  <span className="font-mono tabular-nums text-[var(--text-secondary)]">
                    {uld.weight.toLocaleString()} lbs
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AccordionSection>
  );
}
