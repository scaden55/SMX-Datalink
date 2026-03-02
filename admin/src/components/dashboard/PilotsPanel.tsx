import { Users } from '@phosphor-icons/react';

interface PilotActivity {
  callsign: string;
  firstName: string;
  lastName: string;
  hoursThisMonth: number;
}

interface PilotsPanelProps {
  pilotActivity: PilotActivity[];
}

export function PilotsPanel({ pilotActivity }: PilotsPanelProps) {
  const pilots = pilotActivity.slice(0, 5);
  const maxHours = Math.max(...pilots.map((p) => p.hoursThisMonth), 1);

  return (
    <div className="rounded-md bg-[#1c2033]/90 border border-border/50 shadow-inner">
      {/* Header */}
      <div className="flex items-center justify-between p-3 pb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top Pilots</h2>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Users size={12} weight="duotone" className="text-blue-400" />
          <span>this month</span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-border/30" />

      {/* Pilot list with inline bars */}
      <div className="p-3 space-y-1.5">
        {pilots.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">
            No pilot activity data
          </p>
        ) : (
          pilots.map((p, i) => {
            const name = p.callsign || `${p.firstName} ${p.lastName}`;
            const pct = (p.hoursThisMonth / maxHours) * 100;
            return (
              <div key={i} className="group">
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono text-muted-foreground w-4 text-right shrink-0">
                      {i + 1}.
                    </span>
                    <span className="text-[11px] font-medium text-foreground truncate">{name}</span>
                  </div>
                  <span className="text-[11px] font-mono font-medium text-blue-400 shrink-0 ml-2">
                    {p.hoursThisMonth.toFixed(1)}h
                  </span>
                </div>
                <div className="ml-6 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500/60 transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
