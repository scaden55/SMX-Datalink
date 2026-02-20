import { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

export interface ColumnDef<T> {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  render: (row: T) => React.ReactNode;
}

interface AdminTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  selectable?: boolean;
  selectedIds?: Set<number>;
  onSelectChange?: (ids: Set<number>) => void;
  getRowId?: (row: T) => number;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

export function AdminTable<T>({
  columns,
  data,
  total,
  page,
  pageSize,
  onPageChange,
  loading,
  selectable,
  selectedIds,
  onSelectChange,
  getRowId,
  onRowClick,
  emptyMessage = 'No records found',
}: AdminTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const allSelected = selectable && data.length > 0 && getRowId && selectedIds
    && data.every(row => selectedIds.has(getRowId(row)));

  const toggleAll = () => {
    if (!getRowId || !onSelectChange) return;
    if (allSelected) {
      onSelectChange(new Set());
    } else {
      onSelectChange(new Set(data.map(r => getRowId(r))));
    }
  };

  const toggleRow = (id: number) => {
    if (!onSelectChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectChange(next);
  };

  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-acars-border bg-[#0d1117]">
              {selectable && (
                <th className="w-8 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={!!allSelected}
                    onChange={toggleAll}
                    className="rounded border-acars-border"
                  />
                </th>
              )}
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`px-3 py-2.5 text-left text-[10px] uppercase tracking-wider font-semibold text-acars-muted ${col.sortable ? 'cursor-pointer select-none hover:text-acars-text' : ''}`}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-3 py-12 text-center">
                  <Loader2 className="w-5 h-5 animate-spin text-acars-muted mx-auto" />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-3 py-12 text-center text-acars-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => {
                const rowId = getRowId?.(row);
                const isSelected = rowId !== undefined && selectedIds?.has(rowId);

                return (
                  <tr
                    key={rowId ?? idx}
                    onClick={() => onRowClick?.(row)}
                    className={`border-b border-acars-border/50 last:border-0 transition-colors ${
                      isSelected ? 'bg-acars-blue/5' : idx % 2 === 0 ? 'bg-transparent' : 'bg-[#0d1117]/30'
                    } ${onRowClick ? 'cursor-pointer hover:bg-[#1c2433]' : 'hover:bg-[#161b22]'}`}
                  >
                    {selectable && (
                      <td className="w-8 px-3 py-2" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={!!isSelected}
                          onChange={() => rowId !== undefined && toggleRow(rowId)}
                          className="rounded border-acars-border"
                        />
                      </td>
                    )}
                    {columns.map(col => (
                      <td key={col.key} className="px-3 py-2 text-acars-text">
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      {total > pageSize && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-acars-border bg-[#0d1117]/50">
          <span className="text-[10px] text-acars-muted">
            Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-1 rounded text-acars-muted hover:text-acars-text disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p: number;
              if (totalPages <= 5) p = i + 1;
              else if (page <= 3) p = i + 1;
              else if (page >= totalPages - 2) p = totalPages - 4 + i;
              else p = page - 2 + i;
              return (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  className={`min-w-[24px] h-6 rounded text-[10px] font-medium ${
                    p === page ? 'bg-acars-blue text-white' : 'text-acars-muted hover:text-acars-text hover:bg-[#161b22]'
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-1 rounded text-acars-muted hover:text-acars-text disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
