import { Package } from 'lucide-react';
import { useCargoStore } from '../../stores/cargoStore';

export function CargoSummaryRow() {
  const manifest = useCargoStore((s) => s.manifest);
  if (!manifest) return null;

  const uldCount = manifest.ulds.length;
  const unit = manifest.totalWeightUnit === 'LBS' ? 'lbs' : 'kg';
  const displayWeight = Math.round(manifest.totalWeightDisplay).toLocaleString();

  return (
    <div className="border-b border-acars-border">
      <div className="flex items-center h-8 px-3">
        {/* Green checkmark */}
        <svg className="w-3 h-3 text-[#22c55e] shrink-0 mr-2" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <Package className="w-3 h-3 text-blue-400 mr-1.5" />
        <span className="text-[11px] font-sans text-[#949aa2]">Cargo</span>
        <span className="ml-auto text-[11px] font-mono text-[#cdd1d8]">
          {uldCount} ULDs
        </span>
      </div>
      <div className="px-3 pb-2 space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-acars-muted font-sans">Manifest</span>
          <span className="font-mono text-acars-text">{manifest.manifestNumber}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-acars-muted font-sans">Total</span>
          <span className="font-mono text-acars-text">{displayWeight} {unit} ({manifest.payloadUtilization}%)</span>
        </div>
        {manifest.notocRequired && (
          <div className="flex justify-between text-[10px]">
            <span className="text-amber-400 font-sans">NOTOC</span>
            <span className="font-mono text-amber-400">{manifest.notocItems.length} DG items</span>
          </div>
        )}
        <div className="flex justify-between text-[10px]">
          <span className="text-acars-muted font-sans">CG</span>
          <span className="font-mono text-acars-text">{manifest.cgPosition}% MAC</span>
        </div>
      </div>
    </div>
  );
}
