import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DataRowProps {
  label: string;
  value: ReactNode;
  mono?: boolean;
  className?: string;
}

export function DataRow({ label, value, mono = false, className }: DataRowProps) {
  return (
    <div className={cn('flex items-center justify-between py-1.5', className)}>
      <span className="text-caption shrink-0">{label}</span>
      <span className={cn('text-[var(--text-primary)] text-right', mono ? 'data-sm' : 'text-[13px]')}>
        {value}
      </span>
    </div>
  );
}
