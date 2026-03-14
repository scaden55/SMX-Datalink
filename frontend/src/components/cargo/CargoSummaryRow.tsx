import { useState } from 'react';
import { Package } from '@phosphor-icons/react';
import { useCargoStore } from '../../stores/cargoStore';

export function CargoSummaryRow() {
  const manifest = useCargoStore((s) => s.manifest);
  const [open, setOpen] = useState(false);

  if (!manifest) return null;

  const uldCount = manifest.ulds.length;
  const unit = manifest.totalWeightUnit === 'LBS' ? 'lbs' : 'kg';
  const displayWeight = Math.round(manifest.totalWeightDisplay).toLocaleString();

  return (
    <div className="border-b border-acars-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center h-8 px-3 w-full text-left hover:bg-acars-input/40 transition-colors duration-100"
      >
        {/* Green checkmark */}
        <svg className="w-3 h-3 text-emerald-500 shrink-0 mr-2" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <Package className="w-3 h-3 text-blue-400 mr-1.5" />
        <span className="text-[12px] font-semibold text-acars-muted">Cargo</span>
        <span className="ml-auto text-[12px] tabular-nums text-acars-text">
          {uldCount} ULDs
        </span>
        <svg
          className={`w-3 h-3 text-acars-muted/60 shrink-0 ml-2 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {open && (
        <div className="px-3 pb-2 space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-acars-muted">Manifest</span>
            <span className="tabular-nums text-acars-text">{manifest.manifestNumber}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-acars-muted">Total</span>
            <span className="tabular-nums text-acars-text">{displayWeight} {unit} ({manifest.payloadUtilization}%)</span>
          </div>
          {manifest.notocRequired && (
            <div className="flex justify-between text-[11px]">
              <span className="text-amber-400">NOTOC</span>
              <span className="tabular-nums text-amber-400">{manifest.notocItems.length} DG items</span>
            </div>
          )}
          <div className="flex justify-between text-[11px]">
            <span className="text-acars-muted">CG</span>
            <span className="tabular-nums text-acars-text">{manifest.cgPosition}% MAC</span>
          </div>
        </div>
      )}
    </div>
  );
}
