import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type Accent = 'blue' | 'emerald' | 'amber' | 'red' | 'cyan';

interface StatCardProps {
  icon: LucideIcon;
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
        'rounded-lg border border-[var(--border-primary)] bg-[var(--surface-2)] px-3 py-2.5',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn('flex items-center justify-center w-8 h-8 rounded-lg', iconBg[accent])}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-caption font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            {label}
          </p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="data-lg font-mono font-bold text-[var(--text-primary)]">
              {value}
            </span>
            {trend && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-xs font-mono font-medium',
                  trend.direction === 'up' ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-red)]',
                )}
              >
                {trend.direction === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {trend.value}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
