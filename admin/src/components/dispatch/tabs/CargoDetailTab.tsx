import { Package, AlertTriangle } from 'lucide-react';
import type { CargoManifest } from '@acars/shared';

interface CargoDetailTabProps {
  cargo: CargoManifest | null;
}

export default function CargoDetailTab({ cargo }: CargoDetailTabProps) {
  if (!cargo) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-xs text-[var(--text-muted)] gap-2">
        <Package size={20} />
        No cargo manifest loaded
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary row */}
      <div className="grid grid-cols-4 gap-2">
        <SummaryCell label="Manifest" value={cargo.manifestNumber} />
        <SummaryCell label="Total Weight" value={`${cargo.totalWeightDisplay?.toLocaleString() ?? '--'} ${cargo.totalWeightUnit ?? 'LBS'}`} />
        <SummaryCell label="Utilization" value={`${Math.round(cargo.payloadUtilization ?? 0)}%`} />
        <SummaryCell label="CG Position" value={cargo.cgPosition != null ? `${cargo.cgPosition.toFixed(1)}%` : '--'} />
      </div>

      {/* ULD table */}
      {cargo.ulds && cargo.ulds.length > 0 && (
        <div className="rounded bg-[var(--surface-1)] overflow-hidden">
          <div className="px-3 py-1.5 border-b border-[var(--surface-3)]">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">
              ULD Breakdown ({cargo.ulds.length})
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--surface-3)]">
                  <th className="text-left px-3 py-1.5 font-semibold">ULD ID</th>
                  <th className="text-left px-3 py-1.5 font-semibold">Position</th>
                  <th className="text-right px-3 py-1.5 font-semibold">Weight</th>
                  <th className="text-left px-3 py-1.5 font-semibold">Description</th>
                  <th className="text-left px-3 py-1.5 font-semibold">Category</th>
                  <th className="text-center px-3 py-1.5 font-semibold">Temp</th>
                  <th className="text-center px-3 py-1.5 font-semibold">HazMat</th>
                </tr>
              </thead>
              <tbody>
                {cargo.ulds.map((uld) => (
                  <tr
                    key={uld.uld_id}
                    className={`border-b border-[var(--surface-3)] ${uld.hazmat ? 'bg-amber-500/5' : ''}`}
                  >
                    <td className="px-3 py-1.5 font-mono tabular-nums text-[var(--text-primary)]">{uld.uld_id}</td>
                    <td className="px-3 py-1.5 font-mono tabular-nums text-[var(--text-secondary)]">{uld.position}</td>
                    <td className="px-3 py-1.5 font-mono tabular-nums text-right text-[var(--text-primary)]">
                      {uld.weight?.toLocaleString() ?? '--'}
                    </td>
                    <td className="px-3 py-1.5 text-[var(--text-secondary)] max-w-[200px] truncate">{uld.cargo_description}</td>
                    <td className="px-3 py-1.5 text-[var(--text-muted)]">{uld.category_name || uld.category}</td>
                    <td className="px-3 py-1.5 text-center">
                      {uld.temp_controlled ? (
                        <span className="text-sky-400 font-mono text-[9px]">{uld.temp_requirement ?? 'CTRL'}</span>
                      ) : (
                        <span className="text-[var(--text-muted)]">--</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      {uld.hazmat ? (
                        <span className="inline-flex items-center gap-0.5 text-amber-400">
                          <AlertTriangle size={10} />
                          <span className="text-[9px] font-semibold">HAZ</span>
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">--</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NOTOC section */}
      {cargo.notocRequired && cargo.notocItems && cargo.notocItems.length > 0 && (
        <div className="rounded bg-amber-500/5 border border-amber-500/20 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle size={12} className="text-amber-400" />
            <span className="text-[10px] uppercase tracking-wider font-bold text-amber-400">
              NOTOC — Notification to Captain
            </span>
          </div>
          <div className="space-y-1.5">
            {cargo.notocItems.map((item, i) => (
              <div key={i} className="flex gap-3 text-[10px] font-mono">
                <span className="text-[var(--text-primary)] min-w-[60px]">{item.uld_id}</span>
                <span className="text-amber-400 min-w-[70px]">UN{item.un_number}</span>
                <span className="text-[var(--text-secondary)] min-w-[40px]">CLS {item.class}</span>
                <span className="text-[var(--text-muted)] flex-1 truncate">{item.proper_shipping_name}</span>
                <span className="text-[var(--text-secondary)]">{item.net_weight}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-[var(--surface-1)] px-3 py-2">
      <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] mb-0.5">{label}</div>
      <div className="font-mono text-[11px] tabular-nums text-[var(--text-primary)]">{value}</div>
    </div>
  );
}
