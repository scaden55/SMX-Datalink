import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type RowSelectionState,
  type OnChangeFn,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useState } from 'react';
import { Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  onRowClick?: (row: T) => void;
  selectedRowId?: string | number | null;
  enableRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  loading?: boolean;
  emptyMessage?: string;
  getRowId?: (row: T) => string;
}

export function DataTable<T>({
  columns,
  data,
  onRowClick,
  selectedRowId,
  enableRowSelection = false,
  rowSelection,
  onRowSelectionChange,
  loading = false,
  emptyMessage = 'No results found.',
  getRowId,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // Prepend selection checkbox column when row selection is enabled
  const allColumns: ColumnDef<T, unknown>[] = enableRowSelection
    ? [
        {
          id: '_select',
          header: ({ table }) => (
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && 'indeterminate')
              }
              onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(!!value)
              }
              aria-label="Select all"
            />
          ),
          cell: ({ row }) => (
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              onClick={(e) => e.stopPropagation()}
              aria-label="Select row"
            />
          ),
          enableSorting: false,
          enableHiding: false,
          size: 40,
        } satisfies ColumnDef<T, unknown>,
        ...columns,
      ]
    : columns;

  const table = useReactTable({
    data,
    columns: allColumns,
    state: {
      sorting,
      columnVisibility,
      ...(enableRowSelection && rowSelection !== undefined
        ? { rowSelection }
        : {}),
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    ...(enableRowSelection && onRowSelectionChange
      ? { onRowSelectionChange, enableRowSelection: true }
      : {}),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId,
  });

  // Determine which columns are toggleable (exclude _select and non-hideable)
  const toggleableColumns = table
    .getAllColumns()
    .filter((col) => col.getCanHide() && col.id !== '_select');

  const visibleColumnCount = table.getVisibleFlatColumns().length;

  return (
    <div className="space-y-0">
      {/* Toolbar: Column Visibility Toggle */}
      {toggleableColumns.length > 0 && (
        <div className="flex justify-end pb-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]"
              >
                <Eye className="h-3.5 w-3.5" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-xs">
                Toggle columns
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {toggleableColumns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.getIsVisible()}
                  onCheckedChange={(value) => col.toggleVisibility(!!value)}
                  className="text-xs capitalize"
                >
                  {typeof col.columnDef.header === 'string'
                    ? col.columnDef.header
                    : col.id.replace(/_/g, ' ')}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Table */}
      <div className="overflow-auto rounded-md border border-[var(--border-primary)]" role="region" aria-label="Data table" aria-busy={loading}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-b border-[var(--border-primary)] hover:bg-transparent"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="text-[12px] uppercase tracking-wider bg-[var(--surface-0)] sticky top-0 px-3 h-9"
                    style={{
                      color: 'var(--text-tertiary)',
                      ...(header.column.columnDef.size
                        ? { width: header.column.columnDef.size }
                        : {}),
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              // Skeleton loading rows
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`} className="border-b border-[var(--border-primary)]">
                  {table.getVisibleFlatColumns().map((col) => (
                    <TableCell
                      key={col.id}
                      className="text-sm py-2.5 px-3"
                    >
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              // Empty state
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={visibleColumnCount}
                  className="h-32 text-center"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              // Data rows
              table.getRowModel().rows.map((row, index) => {
                const isSelected =
                  selectedRowId != null && row.id === String(selectedRowId);

                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? 'selected' : undefined}
                    className={cn(
                      'border-b border-[var(--border-primary)] transition-colors',
                      index % 2 === 1 && 'bg-[var(--tint-alt-row)]',
                      'hover:bg-[var(--tint-hover)]',
                      isSelected &&
                        'bg-[var(--accent-blue-bg)] border-l-2 border-l-[var(--accent-blue)]',
                      onRowClick && 'cursor-pointer'
                    )}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="text-sm py-2.5 px-3"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
