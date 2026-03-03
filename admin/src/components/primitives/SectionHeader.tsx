import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  count?: number;
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, count, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between pb-2 mb-3 border-b border-[var(--border-primary)]', className)}>
      <div className="flex items-center gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          {title}
        </h3>
        {count != null && (
          <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-md bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] text-[10px] font-semibold">
            {count}
          </span>
        )}
      </div>
      {action && <div className="text-[11px]">{action}</div>}
    </div>
  );
}
