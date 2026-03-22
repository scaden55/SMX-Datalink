import type { DispatchFlight } from '@acars/shared';

/** Map chip prefix/content to a Tailwind color pair [text, bg] */
function chipColor(chip: string): [string, string] {
  if (chip.startsWith('R-121'))  return ['text-[#93c5fd]', 'bg-[#1b2b3d]'];
  if (chip === 'ETOPS')          return ['text-[#fbbf24]', 'bg-[#78350f]'];
  if (chip === 'D-RVSM')        return ['text-[#67e8f9]', 'bg-[#164e63]'];
  if (chip === 'RTE-FAA')       return ['text-[#a5b4fc]', 'bg-[#312e81]'];
  if (/^[A-F]\d{3}$/.test(chip)) return ['text-[#949aa2]', 'bg-[#1e293b]'];
  return ['text-[#93c5fd]', 'bg-[#1b2b3d]'];
}

export default function ScenarioBar({ flight }: { flight: DispatchFlight }) {
  const flightRules = flight.flightPlanData?.flightRules ?? 'IFR';
  // ruleChips come from regulatory assessment, not available in admin context yet
  const chips = ['UNCLASSIFIED'];

  return (
    <div className="border-b border-[var(--surface-3)] px-3 h-8 flex items-center gap-3 overflow-x-auto">
      {/* Left: Scenario dropdown */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[9px] font-medium text-[var(--text-muted)]/70 uppercase tracking-[0.06em]">Scenario</span>
        <select className="bg-[var(--surface-2)] border border-[var(--surface-3)] text-[12px] tabular-nums text-[var(--text-primary)] rounded-md px-1.5 py-0.5 outline-none focus:border-blue-400">
          <option>{flightRules} Standard</option>
          <option>IFR Standard</option>
          <option>VFR Standard</option>
        </select>
      </div>

      {/* Center: Flight Rules chips */}
      <div
        className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {chips.map((chip) => {
          const [textCls, bgCls] = chipColor(chip);
          return (
            <span
              key={chip}
              className={`text-[11px] uppercase font-semibold ${textCls} ${bgCls} px-1.5 rounded-md leading-[18px] shrink-0 whitespace-nowrap`}
            >
              {chip}
            </span>
          );
        })}
      </div>

      {/* Right: Edit button */}
      <button className="text-[11px] font-medium text-blue-400/70 hover:text-blue-400 transition-colors duration-150 shrink-0 ml-auto">
        Edit
      </button>
    </div>
  );
}
