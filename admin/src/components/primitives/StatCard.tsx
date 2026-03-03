import type { ComponentType } from 'react';
import type { IconProps } from '@phosphor-icons/react';
import { TrendUp, TrendDown } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

type Accent = 'blue' | 'emerald' | 'amber' | 'red' | 'cyan';

interface StatCardProps {
  icon: ComponentType<IconProps>;
  label: string;
  value: string | number;
  accent?: Accent;
  trend?: { value: number; direction: 'up' | 'down' };
  className?: string;
}

const iconBg: Record<Accent, string> = {
  blue: 'bg-[var(--accent-blue-bg)] text-[var(--accent-blue)]',
  emerald: 'bg-[var(--accent-emerald-bg)] text-[var(--accent-emerald)]',
  amber: 'bg-[var(--accent-amber-bg)] text-[var(--accent-amber)]',
  red: 'bg-[var(--accent-red-bg)] text-[var(--accent-red)]',
  cyan: 'bg-[var(--accent-cyan-bg)] text-[var(--accent-cyan)]',
};

export function StatCard({ icon: Icon, label, value, accent = 'blue', trend, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--border-primary)] bg-[var(--surface-2)] p-4',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn('flex items-center justify-center w-9 h-9 rounded-lg', iconBg[accent])}>
          <Icon size={18} weight="duotone" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            {label}
          </p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl font-mono font-bold text-[var(--text-primary)]">
              {value}
            </span>
            {trend && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-xs font-medium',
                  trend.direction === 'up' ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-red)]',
                )}
              >
                {trend.direction === 'up' ? <TrendUp size={12} /> : <TrendDown size={12} />}
                {trend.value}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
