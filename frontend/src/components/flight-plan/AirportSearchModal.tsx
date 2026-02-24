import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '../../lib/api';

interface AirportSearchResult {
  ident: string;
  name: string;
  iata_code: string | null;
  municipality: string | null;
  iso_country: string | null;
}

interface AirportSearchDropdownProps {
  value: string;
  onChange: (icao: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Inline airport search input with dropdown results.
 * Typing filters airports; selecting one fills the ICAO code and collapses the dropdown.
 */
export function AirportSearchDropdown({ value, onChange, disabled, placeholder = '---' }: AirportSearchDropdownProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<AirportSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sync external value changes (e.g. from SimBrief import)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await api.get<AirportSearchResult[]>(`/api/airports/search?q=${encodeURIComponent(q)}&limit=8`);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (val: string) => {
    const upper = val.toUpperCase();
    setQuery(upper);
    onChange(upper);
    clearTimeout(debounceRef.current);
    if (upper.length >= 2) {
      setOpen(true);
      debounceRef.current = setTimeout(() => doSearch(upper), 300);
    } else {
      setResults([]);
      setOpen(false);
    }
  };

  const handleSelect = (icao: string) => {
    setQuery(icao);
    onChange(icao);
    setOpen(false);
    inputRef.current?.blur();
  };

  const inputCls = "bg-acars-input border border-acars-border text-[11px] font-mono text-[#cdd1d8] rounded-md px-1.5 py-0.5 outline-none focus:border-blue-400 truncate w-full";

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center gap-0.5">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (query.length >= 2) { setOpen(true); doSearch(query); } }}
          readOnly={disabled}
          placeholder={placeholder}
          maxLength={4}
          className={inputCls}
        />
        {loading && <Loader2 className="w-3 h-3 text-acars-muted animate-spin shrink-0" />}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 mt-0.5 w-[260px] z-50 bg-[#1c2033] border border-acars-border rounded-md shadow-2xl overflow-hidden">
          {results.map((r) => (
            <button
              key={r.ident}
              onClick={() => handleSelect(r.ident)}
              className="w-full px-2 py-1.5 flex items-center gap-2 hover:bg-white/5 transition-colors text-left border-b border-acars-border/30 last:border-0"
            >
              <span className="text-[11px] font-mono font-semibold text-sky-400 shrink-0 w-[40px]">
                {r.ident}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-acars-text truncate">{r.name}</div>
                <div className="text-[9px] text-acars-muted truncate">
                  {[r.municipality, r.iso_country].filter(Boolean).join(', ')}
                  {r.iata_code && ` (${r.iata_code})`}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
