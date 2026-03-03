import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Accent = 'blue' | 'emerald' | 'amber' | 'red' | 'cyan';
type Elevation = 0 | 1 | 2 | 3;
type Padding = 'none' | 'compact' | 'default' | 'spacious';

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: Elevation;
  accent?: Accent;
  padding?: Padding;
}

const elevationStyles: Record<Elevation, string> = {
  0: '',
  1: 'border border-[var(--border-primary)]',
  2: 'border border-[var(--border-primary)] shadow-[var(--elevation-1)]',
  3: 'border border-[var(--border-primary)] shadow-[var(--elevation-2)]',
};

const bgStyles: Record<Elevation, string> = {
  0: 'bg-[var(--surface-0)]',
  1: 'bg-[var(--surface-2)]',
  2: 'bg-[var(--surface-2)]',
  3: 'bg-[var(--surface-3)]',
};

const paddingStyles: Record<Padding, string> = {
  none: '',
  compact: 'p-3',
  default: 'p-4',
  spacious: 'p-6',
};

const accentBorder: Record<Accent, string> = {
  blue: 'border-l-[3px] border-l-[var(--accent-blue)]',
  emerald: 'border-l-[3px] border-l-[var(--accent-emerald)]',
  amber: 'border-l-[3px] border-l-[var(--accent-amber)]',
  red: 'border-l-[3px] border-l-[var(--accent-red)]',
  cyan: 'border-l-[3px] border-l-[var(--accent-cyan)]',
};

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(
  ({ elevation = 1, accent, padding = 'default', className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-lg',
          bgStyles[elevation],
          elevationStyles[elevation],
          paddingStyles[padding],
          accent && accentBorder[accent],
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
Surface.displayName = 'Surface';
