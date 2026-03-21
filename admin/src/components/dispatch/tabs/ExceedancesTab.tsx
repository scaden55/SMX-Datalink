import { ShieldAlert } from 'lucide-react';

interface ExceedancesTabProps {
  exceedances: any[];
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  caution: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  info: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
};

export default function ExceedancesTab({ exceedances }: ExceedancesTabProps) {
  if (!exceedances || exceedances.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-xs text-[var(--text-muted)] gap-2">
        <ShieldAlert size={20} />
        No exceedances recorded
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {exceedances.map((exc, i) => {
        const severity = exc.severity ?? 'warning';
        const colorClass = severityColors[severity] ?? severityColors.warning;

        return (
          <div key={exc.id ?? i} className="rounded bg-[var(--surface-1)] p-3">
            <div className="flex items-center gap-2 mb-1.5">
              {/* Severity badge */}
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${colorClass}`}>
                {severity}
              </span>
              {/* Type */}
              <span className="text-[11px] font-semibold text-[var(--text-primary)]">
                {exc.type ?? exc.message ?? 'Exceedance'}
              </span>
              {/* Timestamp */}
              {exc.timestamp && (
                <span className="ml-auto font-mono text-[9px] tabular-nums text-[var(--text-muted)]">
                  {new Date(exc.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>

            {/* Details */}
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

            {/* Message */}
            {exc.message && exc.type && (
              <p className="text-[10px] text-[var(--text-muted)] mt-1">{exc.message}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
