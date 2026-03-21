import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricDisplayProps {
  value: string | number;
  label: string;
  icon?: LucideIcon;
  trend?: { value: number; direction: 'up' | 'down' };
  className?: string;
}

export function MetricDisplay({ value, label, icon: Icon, trend, className }: MetricDisplayProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      {Icon && <Icon size={16} className="text-[var(--text-tertiary)] mb-1" />}
      <span className="data-lg text-[var(--text-primary)]" style={{ fontSize: 'var(--text-display-size)' }}>{value}</span>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-caption">{label}</span>
        {trend && (
          <span className={cn(
            'inline-flex items-center gap-0.5 text-[11px] font-medium',
            trend.direction === 'up' ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-red)]',
          )}>
            {trend.direction === 'up' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {trend.value}%
          </span>
        )}
      </div>
    </div>
  );
}
