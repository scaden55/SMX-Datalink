import { type Column } from '@tanstack/react-table';
import { ArrowUp, ArrowDown, CaretUpDown } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface DataTableColumnHeaderProps<T, V> {
  column: Column<T, V>;
  title: string;
  className?: string;
}

export function DataTableColumnHeader<T, V>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<T, V>) {
  if (!column.getCanSort()) {
    return <span className={className}>{title}</span>;
  }

  const sorted = column.getIsSorted();

  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1 hover:text-foreground transition-colors -ml-1 px-1 py-0.5 rounded',
        className
      )}
      onClick={column.getToggleSortingHandler()}
    >
      <span>{title}</span>
      {sorted === 'asc' ? (
        <ArrowUp className="h-3.5 w-3.5" />
      ) : sorted === 'desc' ? (
        <ArrowDown className="h-3.5 w-3.5" />
      ) : (
        <CaretUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
      )}
    </button>
  );
}
