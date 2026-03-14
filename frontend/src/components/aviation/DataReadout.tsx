import { cn } from '@/lib/utils';

interface DataField {
  label: string;
  value: string | number | undefined;
  mono?: boolean; // Use monospace font (default: true)
}

interface DataReadoutProps {
  fields: DataField[];
  columns?: 2 | 3 | 4;
  className?: string;
}

/**
 * ACARS-style data readout grid. Displays label/value pairs in
 * an aviation terminal layout with uppercase labels and monospace values.
 */
export function DataReadout({ fields, columns = 3, className }: DataReadoutProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  };

  return (
    <div className={cn('grid gap-x-4 gap-y-2.5', gridCols[columns], className)}>
      {fields.map((field) => (
        <div key={field.label} className="flex flex-col gap-0.5">
          <span className="text-[11px] uppercase tracking-[0.06em] font-medium text-[var(--text-label)]">
            {field.label}
          </span>
          <span
            className={cn(
              'text-[12px] text-acars-text',
              (field.mono ?? true) && 'tabular-nums',
            )}
          >
            {field.value ?? '—'}
          </span>
        </div>
      ))}
    </div>
  );
}
