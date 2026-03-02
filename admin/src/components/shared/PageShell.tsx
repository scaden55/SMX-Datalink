import type { ReactNode } from 'react';

// ── Types ───────────────────────────────────────────────────────

interface StatCard {
  label: string;
  value: string | number;
  icon?: ReactNode;
  color?: 'blue' | 'emerald' | 'amber' | 'red' | 'cyan';
}

interface PageShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  stats?: StatCard[];
  children: ReactNode;
}

// ── Color Map ───────────────────────────────────────────────────

const colorMap = {
  blue: {
    border: 'border-l-blue-500',
    text: 'text-blue-500',
  },
  emerald: {
    border: 'border-l-emerald-500',
    text: 'text-emerald-500',
  },
  amber: {
    border: 'border-l-amber-500',
    text: 'text-amber-500',
  },
  red: {
    border: 'border-l-red-500',
    text: 'text-red-500',
  },
  cyan: {
    border: 'border-l-cyan-500',
    text: 'text-cyan-500',
  },
} as const;

// ── Component ───────────────────────────────────────────────────

export function PageShell({ title, subtitle, actions, stats, children }: PageShellProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between px-6 pt-6 pb-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2">{actions}</div>
        )}
      </div>

      {/* Stats Row */}
      {stats && stats.length > 0 && (
        <div className="px-6 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.map((stat) => {
              const palette = colorMap[stat.color ?? 'blue'];
              return (
                <div
                  key={stat.label}
                  className={`rounded-md bg-[#1c2033] border border-border/50 border-l-[3px] ${palette.border} p-3`}
                >
                  <div className="flex items-center gap-1.5">
                    {stat.icon && (
                      <span className={`${palette.text} flex-shrink-0`} style={{ fontSize: 13 }}>
                        {stat.icon}
                      </span>
                    )}
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {stat.label}
                    </span>
                  </div>
                  <p className="text-xl font-mono font-bold mt-1">{stat.value}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Children */}
      <div className="flex-1 overflow-hidden px-6 pb-6">
        {children}
      </div>
    </div>
  );
}
