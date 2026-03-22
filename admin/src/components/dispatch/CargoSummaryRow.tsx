import { useState } from 'react';
import { Package } from 'lucide-react';
import type { CargoManifest } from '@acars/shared';

export default function CargoSummaryRow({ cargo }: { cargo: CargoManifest | null }) {
  const [open, setOpen] = useState(false);

  if (!cargo) return null;

  const uldCount = cargo.ulds.length;
  const unit = cargo.totalWeightUnit === 'LBS' ? 'lbs' : 'kg';
  const displayWeight = Math.round(cargo.totalWeightDisplay).toLocaleString();

  return (
    <div className="border-b border-[var(--surface-3)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center h-8 px-3 w-full text-left hover:bg-[var(--surface-2)]/40 transition-colors duration-100"
      >
        {/* Green checkmark */}
        <svg className="w-3 h-3 text-emerald-500 shrink-0 mr-2" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <Package className="w-3 h-3 text-blue-400 mr-1.5" />
        <span className="text-[12px] font-semibold text-[var(--text-muted)]">Cargo</span>
        <span className="ml-auto text-[12px] tabular-nums text-[var(--text-primary)]">
          {uldCount} ULDs
        </span>
        <svg
          className={`w-3 h-3 text-[var(--text-muted)]/60 shrink-0 ml-2 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {open && (
        <div className="px-3 pb-2 space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-[var(--text-muted)]">Manifest</span>
            <span className="tabular-nums text-[var(--text-primary)]">{cargo.manifestNumber}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-[var(--text-muted)]">Total</span>
            <span className="tabular-nums text-[var(--text-primary)]">{displayWeight} {unit} ({cargo.payloadUtilization}%)</span>
          </div>
          {cargo.notocRequired && (
            <div className="flex justify-between text-[11px]">
              <span className="text-amber-400">NOTOC</span>
              <span className="tabular-nums text-amber-400">{cargo.notocItems.length} DG items</span>
            </div>
          )}
          <div className="flex justify-between text-[11px]">
            <span className="text-[var(--text-muted)]">CG</span>
            <span className="tabular-nums text-[var(--text-primary)]">{cargo.cgPosition}% MAC</span>
          </div>
        </div>
      )}
    </div>
  );
}
