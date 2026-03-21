import { Search } from 'lucide-react';

export type PhaseFilter = 'all' | 'flying' | 'planning' | 'completed';

interface FilterBarProps {
  phaseCounts: { flying: number; planning: number; completed: number };
  activeFilter: PhaseFilter;
  onFilterChange: (filter: PhaseFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const badges: { key: Exclude<PhaseFilter, 'all'>; label: string; color: string; dotColor: string }[] = [
  { key: 'flying', label: 'Flying', color: 'text-emerald-400', dotColor: 'bg-emerald-400' },
  { key: 'planning', label: 'Planning', color: 'text-amber-400', dotColor: 'bg-amber-400' },
  { key: 'completed', label: 'Completed', color: 'text-gray-400', dotColor: 'bg-gray-500' },
];

export function FilterBar({ phaseCounts, activeFilter, onFilterChange, searchQuery, onSearchChange }: FilterBarProps) {
  return (
    <div className="absolute top-3 left-3 right-3 z-[1000] flex items-center gap-2 bg-[var(--surface-1)]/90 border border-[var(--surface-3)] rounded-lg px-3 py-2">
      {/* Phase badges */}
      <div className="flex items-center gap-1.5">
        {badges.map(({ key, label, color, dotColor }) => {
          const isActive = activeFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onFilterChange(isActive ? 'all' : key)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-[var(--surface-3)] ring-1 ring-[var(--accent)]'
                  : 'hover:bg-[var(--surface-2)]'
              } ${color}`}
            >
              <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />
              <span className="font-mono tabular-nums">{phaseCounts[key]}</span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search flights..."
          className="h-7 w-48 rounded-md border border-[var(--surface-3)] bg-[var(--surface-2)] pl-7 pr-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </div>
    </div>
  );
}
