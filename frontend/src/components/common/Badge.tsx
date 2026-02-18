import type { ReactNode } from 'react';

const variants = {
  green: 'badge-green',
  amber: 'badge-amber',
  red: 'badge-red',
  blue: 'badge-blue',
  magenta: 'badge-magenta',
} as const;

interface BadgeProps {
  variant: keyof typeof variants;
  children: ReactNode;
}

export function Badge({ variant, children }: BadgeProps) {
  return <span className={variants[variant]}>{children}</span>;
}
