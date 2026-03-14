import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[12px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-br from-[#4d9cf6] to-[#3478e0] text-white shadow-[0_2px_8px_rgba(77,156,246,0.30)] hover:shadow-[0_4px_16px_rgba(77,156,246,0.45)] hover:brightness-110 active:brightness-95',
        destructive:
          'bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 active:bg-destructive/25',
        outline:
          'border border-acars-border bg-transparent text-acars-muted hover:bg-acars-input hover:text-acars-text',
        secondary:
          'bg-blue-500/10 text-blue-400 border border-blue-400/20 hover:bg-blue-500/20 active:bg-blue-500/25',
        ghost:
          'text-acars-muted hover:bg-acars-hover hover:text-acars-text',
        link: 'text-blue-400 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-8 px-4 py-2',
        sm: 'h-7 px-3 py-1.5 text-[11px]',
        lg: 'h-10 px-6 py-2.5 text-xs',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
