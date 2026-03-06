import type { CargoManifest } from '@acars/shared';
import { Warning } from '@phosphor-icons/react';

interface Props {
  manifest: CargoManifest;
}

export function NOTOCSection({ manifest }: Props) {
  if (!manifest.notocRequired || manifest.notocItems.length === 0) return null;

  return (
    <div className="border border-amber-500/30 rounded-md overflow-hidden">
      {/* Amber header */}
      <div className="bg-amber-500/10 px-3 py-2 flex items-center gap-2">
        <Warning className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-[11px] font-semibold text-amber-400">
          NOTOC — Dangerous Goods / Special Cargo
        </span>
      </div>

      {/* NOTOC items table */}
      <div className="p-3">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-amber-500/20">
              <th className="text-left py-1 pr-2 font-medium text-acars-muted">ULD/Pos</th>
              <th className="text-left py-1 pr-2 font-medium text-acars-muted">Proper Shipping Name</th>
              <th className="text-left py-1 pr-2 font-medium text-acars-muted">UN No.</th>
              <th className="text-left py-1 pr-2 font-medium text-acars-muted">Class</th>
              <th className="text-left py-1 pr-2 font-medium text-acars-muted">PG</th>
              <th className="text-right py-1 font-medium text-acars-muted">Net Wt</th>
            </tr>
          </thead>
          <tbody>
            {manifest.notocItems.map((item, i) => (
              <tr key={i} className={i % 2 === 0 ? '' : 'bg-amber-500/5'}>
                <td className="py-1 pr-2 tabular-nums text-acars-text whitespace-nowrap">
                  {item.uld_id} / {item.position}
                </td>
                <td className="py-1 pr-2 text-acars-text">{item.proper_shipping_name}</td>
                <td className="py-1 pr-2 tabular-nums text-amber-400">{item.un_number}</td>
                <td className="py-1 pr-2 tabular-nums text-acars-text">{item.class}</td>
                <td className="py-1 pr-2 tabular-nums text-acars-text">{item.packing_group}</td>
                <td className="py-1 tabular-nums text-acars-text text-right">{item.net_weight}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Handling instructions */}
        <div className="mt-3 pt-2 border-t border-amber-500/20">
          <span className="text-[10px] text-acars-muted block mb-1">Handling Instructions</span>
          <p className="text-[10px] text-acars-text leading-relaxed">
            All dangerous goods must be handled in accordance with IATA DGR. Ensure proper separation
            from incompatible materials. Temperature-controlled items must be monitored throughout flight.
            Notify captain of all DG items prior to departure.
          </p>
        </div>

        {/* Simulation disclaimer */}
        <p className="text-[9px] text-acars-muted/50 italic mt-2">
          SIMULATION ONLY — This NOTOC is generated for flight simulation purposes and does not
          represent actual dangerous goods documentation.
        </p>
      </div>
    </div>
  );
}
