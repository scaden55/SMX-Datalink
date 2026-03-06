import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[60px] w-full rounded-md border border-acars-border bg-acars-input px-2.5 py-1.5 text-[12px] tabular-nums text-acars-text placeholder:text-acars-muted/40 focus:outline-none focus:border-blue-400 disabled:cursor-not-allowed disabled:opacity-50 transition-colors resize-none',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
