import type { CargoManifest } from '@acars/shared';
import { Snowflake, AlertTriangle, Battery } from 'lucide-react';

interface Props {
  manifest: CargoManifest;
}

export function ULDManifest({ manifest }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wide text-acars-muted font-sans">ULD Manifest</span>
        <span className="text-[10px] text-acars-muted font-mono">{manifest.ulds.length} units</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-acars-border">
              <th className="text-left py-1 pr-2 font-medium text-acars-muted font-sans">ULD</th>
              <th className="text-left py-1 pr-2 font-medium text-acars-muted font-sans">Pos</th>
              <th className="text-right py-1 pr-2 font-medium text-acars-muted font-sans">Weight</th>
              <th className="text-left py-1 pr-2 font-medium text-acars-muted font-sans">AWB</th>
              <th className="text-left py-1 font-medium text-acars-muted font-sans">Description</th>
            </tr>
          </thead>
          <tbody>
            {manifest.ulds.map((uld, i) => (
              <tr key={uld.uld_id} className={i % 2 === 0 ? '' : 'bg-acars-bg/30'}>
                <td className="py-1 pr-2 font-mono text-acars-text whitespace-nowrap">
                  {uld.uld_id}
                  <span className="ml-1 text-acars-muted">({uld.uld_type})</span>
                </td>
                <td className="py-1 pr-2 font-mono text-acars-text">{uld.position}</td>
                <td className="py-1 pr-2 font-mono text-acars-text text-right">{Math.round(uld.weight).toLocaleString()}</td>
                <td className="py-1 pr-2 font-mono text-acars-muted whitespace-nowrap">{uld.awb_number}</td>
                <td className="py-1 text-acars-text font-sans">
                  <span className="flex items-center gap-1">
                    {uld.cargo_description}
                    {uld.temp_controlled && <Snowflake className="w-3 h-3 text-blue-400 shrink-0" />}
                    {uld.hazmat && <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />}
                    {uld.lithium_battery && <Battery className="w-3 h-3 text-yellow-400 shrink-0" />}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex justify-between mt-2 pt-2 border-t border-acars-border">
        <span className="text-[9px] text-acars-muted font-sans">
          {manifest.ulds.filter(u => u.temp_controlled).length > 0 && (
            <span className="inline-flex items-center gap-0.5 mr-2"><Snowflake className="w-2.5 h-2.5 text-blue-400" /> Temp</span>
          )}
          {manifest.ulds.filter(u => u.hazmat).length > 0 && (
            <span className="inline-flex items-center gap-0.5 mr-2"><AlertTriangle className="w-2.5 h-2.5 text-amber-400" /> DG</span>
          )}
          {manifest.ulds.filter(u => u.lithium_battery).length > 0 && (
            <span className="inline-flex items-center gap-0.5"><Battery className="w-2.5 h-2.5 text-yellow-400" /> Li-Ion</span>
          )}
        </span>
        <span className="text-[9px] text-acars-muted/60 font-sans italic">Simulation only</span>
      </div>
    </div>
  );
}
