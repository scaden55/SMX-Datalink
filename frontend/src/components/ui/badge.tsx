import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.08em]',
  {
    variants: {
      variant: {
        default: 'bg-blue-500/10 text-blue-400',
        green: 'bg-emerald-500/10 text-emerald-400',
        amber: 'bg-amber-500/10 text-amber-400',
        red: 'bg-red-500/10 text-red-400',
        blue: 'bg-[var(--accent-dark)] text-[var(--accent)]',
        muted: 'bg-acars-hover text-acars-muted',
        // Flight phase badges
        preflight: 'bg-blue-500/10 text-blue-400',
        taxi: 'bg-amber-500/10 text-amber-400',
        takeoff: 'bg-emerald-500/10 text-emerald-400',
        climb: 'bg-[#60a5fa]/10 text-[#60a5fa]',
        cruise: 'bg-blue-500/10 text-blue-400',
        descent: 'bg-emerald-500/10 text-emerald-400',
        approach: 'bg-amber-500/10 text-amber-400',
        landed: 'bg-emerald-500/10 text-emerald-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
