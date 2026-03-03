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
      <span className="text-[12px] text-[var(--text-tertiary)] shrink-0">{label}</span>
      <span className={cn('text-[13px] text-[var(--text-primary)] text-right', mono && 'font-mono')}>
        {value}
      </span>
    </div>
  );
}
