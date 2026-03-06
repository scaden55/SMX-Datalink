import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { StatCard } from '@/components/primitives';

// ── Types ───────────────────────────────────────────────────

interface PageShellStat {
  icon: LucideIcon;
  label: string;
  value: string | number;
  accent?: 'blue' | 'emerald' | 'amber' | 'red' | 'cyan';
  trend?: { value: number; direction: 'up' | 'down' };
}

interface PageShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  stats?: PageShellStat[];
  children: ReactNode;
}

// ── Component ───────────────────────────────────────────────

export function PageShell({ title, subtitle, actions, stats, children }: PageShellProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between px-6 pt-6 pb-4">
        <div>
          <h1
            className="font-bold"
            style={{
              fontSize: 'var(--text-display-size)',
              color: 'var(--text-primary)',
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {subtitle}
            </p>
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
            {stats.map((stat) => (
              <StatCard
                key={stat.label}
                icon={stat.icon}
                label={stat.label}
                value={stat.value}
                accent={stat.accent}
                trend={stat.trend}
              />
            ))}
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
