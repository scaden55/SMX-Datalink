import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';

interface DataTablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function DataTablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: DataTablePaginationProps) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="flex items-center justify-between py-2 px-3 border-t border-border/50 text-sm text-muted-foreground">
      <span>
        {total === 0 ? (
          'No results'
        ) : (
          <>
            Showing{' '}
            <span className="font-mono text-foreground">{start}</span>
            &ndash;
            <span className="font-mono text-foreground">{end}</span>
            {' of '}
            <span className="font-mono text-foreground">{total}</span>
          </>
        )}
      </span>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs">Rows</span>
          <Select
            value={String(pageSize)}
            onValueChange={(val) => {
              onPageSizeChange(Number(val));
              onPageChange(1);
            }}
          >
            <SelectTrigger className="h-7 w-[70px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={!hasPrev}
            onClick={() => onPageChange(page - 1)}
          >
            <CaretLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs min-w-[60px] text-center">
            <span className="font-mono text-foreground">{page}</span>
            {' / '}
            <span className="font-mono text-foreground">{totalPages}</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={!hasNext}
            onClick={() => onPageChange(page + 1)}
          >
            <CaretRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
