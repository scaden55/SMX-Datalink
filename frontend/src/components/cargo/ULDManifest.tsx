import type { CargoManifest } from '@acars/shared';
import { Snowflake, Warning, BatteryFull } from '@phosphor-icons/react';

interface Props {
  manifest: CargoManifest;
}

export function ULDManifest({ manifest }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-wide text-acars-muted">ULD Manifest</span>
        <span className="text-[11px] text-acars-muted tabular-nums">{manifest.ulds.length} units</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-acars-border">
              <th className="text-left py-1 pr-2 font-medium text-acars-muted">ULD</th>
              <th className="text-left py-1 pr-2 font-medium text-acars-muted">Pos</th>
              <th className="text-right py-1 pr-2 font-medium text-acars-muted">Scales</th>
              <th className="text-left py-1 pr-2 font-medium text-acars-muted">AWB</th>
              <th className="text-left py-1 font-medium text-acars-muted">Description</th>
            </tr>
          </thead>
          <tbody>
            {manifest.ulds.map((uld, i) => (
              <tr key={uld.uld_id} className={i % 2 === 0 ? '' : 'bg-acars-bg/30'}>
                <td className="py-1 pr-2 tabular-nums text-acars-text whitespace-nowrap">
                  {uld.uld_id}
                  <span className="ml-1 text-acars-muted">({uld.uld_type})</span>
                </td>
                <td className="py-1 pr-2 tabular-nums text-acars-text">{uld.position}</td>
                <td className="py-1 pr-2 tabular-nums text-acars-text text-right">{Math.round(uld.weight).toLocaleString()}</td>
                <td className="py-1 pr-2 tabular-nums text-acars-muted whitespace-nowrap">{uld.awb_number}</td>
                <td className="py-1 text-acars-text">
                  <span className="flex items-center gap-1">
                    {uld.cargo_description}
                    {uld.temp_controlled && <Snowflake className="w-3 h-3 text-blue-400 shrink-0" />}
                    {uld.hazmat && <Warning className="w-3 h-3 text-amber-400 shrink-0" />}
                    {uld.lithium_battery && <BatteryFull className="w-3 h-3 text-yellow-400 shrink-0" />}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex justify-between mt-2 pt-2 border-t border-acars-border">
        <span className="text-[9px] text-acars-muted">
          {manifest.ulds.filter(u => u.temp_controlled).length > 0 && (
            <span className="inline-flex items-center gap-0.5 mr-2"><Snowflake className="w-2.5 h-2.5 text-blue-400" /> Temp</span>
          )}
          {manifest.ulds.filter(u => u.hazmat).length > 0 && (
            <span className="inline-flex items-center gap-0.5 mr-2"><Warning className="w-2.5 h-2.5 text-amber-400" /> DG</span>
          )}
          {manifest.ulds.filter(u => u.lithium_battery).length > 0 && (
            <span className="inline-flex items-center gap-0.5"><BatteryFull className="w-2.5 h-2.5 text-yellow-400" /> Li-Ion</span>
          )}
        </span>
        <span className="text-[9px] text-acars-muted/60 italic">Simulation only</span>
      </div>
    </div>
  );
}
