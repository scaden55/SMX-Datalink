/**
 * HeaderBar — Branded identity bar at the top of the main content area.
 * Shows airline logo, name, and certification badges.
 */
export function HeaderBar() {
  return (
    <div className="flex items-center gap-4 px-6 pt-6 pb-2 shrink-0">
      <img
        src="./logos/chevron-light.png"
        alt="SMX"
        className="h-8 w-auto opacity-90"
        draggable={false}
      />
      <div className="flex flex-col gap-1">
        <h1 className="text-[18px] font-semibold text-white tracking-tight leading-none">
          Special Missions Air
        </h1>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-[1px] rounded text-[9px] font-semibold uppercase tracking-wider bg-[#3b5bdb]/20 text-[#6b8aff] border border-[#3b5bdb]/30">
            FAA - 121
          </span>
          <span className="inline-flex items-center px-2 py-[1px] rounded text-[9px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] border border-white/[0.08]">
            Est. 2021
          </span>
        </div>
      </div>
    </div>
  );
}
