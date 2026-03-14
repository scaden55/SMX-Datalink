/**
 * HeaderBar — Branded identity bar at the top of the main content area.
 * Shows airline logo, name, and certification badges.
 */
export function HeaderBar() {
  return (
    <div className="flex items-center justify-between px-6 pt-5 pb-1 shrink-0">
      <div className="flex items-center gap-3">
        <img
          src="./logos/chevron-light.png"
          alt="SMX"
          className="h-7 w-auto opacity-90"
          draggable={false}
        />
        <div className="flex flex-col gap-0.5">
          <h1 className="text-[16px] font-semibold text-white tracking-tight leading-none">
            Special Missions Air
          </h1>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center px-1.5 py-[1px] rounded-sm text-[9px] font-mono font-bold uppercase tracking-[0.1em] bg-[#4F6CCD]/15 text-[#4F6CCD] border border-[#4F6CCD]/20">
              FAA-121
            </span>
            <span className="inline-flex items-center px-1.5 py-[1px] rounded-sm text-[9px] font-mono font-bold uppercase tracking-[0.1em] text-[var(--text-label)] border border-white/[0.06]">
              CARGO
            </span>
            <span className="inline-flex items-center px-1.5 py-[1px] rounded-sm text-[9px] font-mono uppercase tracking-[0.1em] text-[var(--text-label)] border border-white/[0.06]">
              EST 2021
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
