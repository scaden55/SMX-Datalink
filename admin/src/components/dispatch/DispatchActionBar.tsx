import type { DispatchFlight, CargoManifest } from '@acars/shared';
import { useDispatchEdit } from './DispatchEditContext';

/** Diamond caution icon -- filled amber when active, muted when clear */
function DiamondIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-3 h-3 shrink-0 ${active ? 'text-amber-400' : 'text-emerald-500'}`} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1l7 7-7 7-7-7z" />
    </svg>
  );
}

interface DispatchActionBarProps {
  flight: DispatchFlight;
  cargo?: CargoManifest | null;
}

export default function DispatchActionBar({ flight, cargo }: DispatchActionBarProps) {
  const { canEdit, hasUnreleasedChanges, releasing, releaseDispatch, editableFields } = useDispatchEdit();

  const melText = (editableFields.melRestrictions ?? flight.flightPlanData?.melRestrictions ?? '').trim();
  const hasMel = melText.length > 0;
  const hasNotoc = cargo?.notocRequired && (cargo.notocItems?.length ?? 0) > 0;

  return (
    <div className="border-b border-[var(--surface-3)] px-3 h-8 flex items-center gap-4">
      {/* Left: status indicators */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <DiamondIcon active={hasMel} />
          <span className={`text-[11px] ${hasMel ? 'text-amber-400' : 'text-[var(--text-muted)]'}`}>
            MEL & Restrictions
          </span>
        </div>
        {hasNotoc && (
          <div className="flex items-center gap-1.5">
            <DiamondIcon active />
            <span className="text-[11px] text-amber-400">NOTOC</span>
          </div>
        )}
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-2 ml-auto">
        {canEdit && (
          <button
            onClick={releaseDispatch}
            disabled={!hasUnreleasedChanges || releasing}
            className={`flex items-center gap-1.5 px-3 py-0.5 text-[11px] font-semibold rounded border transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] ${
              hasUnreleasedChanges && !releasing
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20 hover:text-blue-300'
                : 'bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--surface-3)] cursor-not-allowed opacity-50'
            }`}
          >
            {releasing ? (
              <div className="w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
            ) : (
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            )}
            {releasing ? 'Releasing...' : 'Release/File'}
          </button>
        )}
      </div>
    </div>
  );
}
