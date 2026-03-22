import { ShieldAlert } from 'lucide-react';

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  caution: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  info: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
};

interface AdvisoriesTabProps {
  exceedances: any[];
}

export default function AdvisoriesTab({ exceedances }: AdvisoriesTabProps) {
  const hasExceedances = exceedances && exceedances.length > 0;

  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Advisories</h3>

      {hasExceedances ? (
        <div className="space-y-2">
          {exceedances.map((exc, i) => {
            const severity = exc.severity ?? 'warning';
            const colorClass = severityColors[severity] ?? severityColors.warning;

            return (
              <div
                key={exc.id ?? i}
                className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-md p-3"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${colorClass}`}
                  >
                    {severity}
                  </span>
                  <span className="text-[11px] font-semibold text-[var(--text-primary)]">
                    {exc.type ?? exc.message ?? 'Exceedance'}
                  </span>
                  {exc.timestamp && (
                    <span className="ml-auto font-mono text-[9px] tabular-nums text-[var(--text-muted)]">
                      {new Date(exc.timestamp).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  )}
                </div>

                <div className="flex gap-4 text-[10px]">
                  {exc.value != null && exc.threshold != null && (
                    <span className="font-mono tabular-nums text-[var(--text-secondary)]">
                      Value: <span className="text-[var(--text-primary)]">{exc.value}</span>
                      {' / '}
                      Limit: <span className="text-[var(--text-primary)]">{exc.threshold}</span>
                    </span>
                  )}
                  {exc.phase && (
                    <span className="text-[var(--text-muted)]">
                      Phase: <span className="font-mono uppercase">{exc.phase.replace('_', ' ')}</span>
                    </span>
                  )}
                </div>

                {exc.message && exc.type && (
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">{exc.message}</p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-md p-3">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <ShieldAlert size={14} />
            <span className="italic">No advisories at this time.</span>
          </div>
        </div>
      )}
    </div>
  );
}
