import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import type { NavdataSearchResult } from '@acars/shared';

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

// ── Type colors for result dots ─────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  VOR: 'var(--cyan)',
  NDB: 'var(--status-amber)',
  fix: 'var(--text-secondary)',
  airway: 'var(--cyan)',
  DME: 'var(--text-secondary)',
  TACAN: 'var(--cyan)',
  ILS_LOC: 'var(--cyan)',
  DME_STANDALONE: 'var(--text-secondary)',
};

const TYPE_LABELS: Record<string, string> = {
  VOR: 'VOR',
  NDB: 'NDB',
  fix: 'FIX',
  airway: 'AWY',
  DME: 'DME',
  TACAN: 'TCN',
  ILS_LOC: 'ILS',
  DME_STANDALONE: 'DME',
};

// ── Component ───────────────────────────────────────────────

export function RouteAutocomplete({ value, onChange, placeholder }: Props) {
  const [results, setResults] = useState<NavdataSearchResult[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const [currentToken, setCurrentToken] = useState('');
  const [tokenStart, setTokenStart] = useState(0);
  const [tokenEnd, setTokenEnd] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ── Extract token at cursor position ────────────────────

  const extractToken = useCallback((text: string, cursor: number) => {
    let start = cursor;
    let end = cursor;

    while (start > 0 && text[start - 1] !== ' ' && text[start - 1] !== '\n') start--;
    while (end < text.length && text[end] !== ' ' && text[end] !== '\n') end++;

    const token = text.slice(start, end);
    return { token, start, end };
  }, []);

  // ── Search API ──────────────────────────────────────────

  const searchNavdata = useCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    try {
      const data = await api.get<NavdataSearchResult[]>(
        `/api/navdata/search?q=${encodeURIComponent(query)}&limit=15`
      );
      setResults(data);
      setSelectedIdx(0);
      setOpen(data.length > 0);
    } catch {
      setResults([]);
      setOpen(false);
    }
  }, []);

  // ── Handle input change ─────────────────────────────────

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    const cursor = e.target.selectionStart ?? 0;
    const { token, start, end } = extractToken(newValue, cursor);
    setCurrentToken(token);
    setTokenStart(start);
    setTokenEnd(end);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchNavdata(token);
    }, 300);
  };

  // ── Handle cursor movement ──────────────────────────────

  const handleSelect = () => {
    const el = textareaRef.current;
    if (!el) return;
    const cursor = el.selectionStart ?? 0;
    const { token, start, end } = extractToken(value, cursor);
    setCurrentToken(token);
    setTokenStart(start);
    setTokenEnd(end);
  };

  // ── Insert selected result ──────────────────────────────

  const insertResult = useCallback((result: NavdataSearchResult) => {
    const before = value.slice(0, tokenStart);
    const after = value.slice(tokenEnd);
    const newValue = before + result.ident + (after.startsWith(' ') ? '' : ' ') + after;
    onChange(newValue);
    setOpen(false);
    setResults([]);

    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        const pos = tokenStart + result.ident.length + 1;
        el.setSelectionRange(pos, pos);
      }
    });
  }, [value, tokenStart, tokenEnd, onChange]);

  // ── Keyboard handling ───────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      insertResult(results[selectedIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // ── Scroll selected item into view ──────────────────────

  useEffect(() => {
    if (!open || !dropdownRef.current) return;
    const items = dropdownRef.current.children;
    if (items[selectedIdx]) {
      (items[selectedIdx] as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIdx, open]);

  const handleBlur = () => {
    setTimeout(() => setOpen(false), 200);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onSelect={handleSelect}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={handleSelect}
        placeholder={placeholder}
        rows={3}
        className="planning-textarea"
      />

      {/* Autocomplete dropdown */}
      {open && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 left-0 right-0 mt-0.5 max-h-52 overflow-y-auto rounded-md border border-acars-border bg-acars-panel shadow-lg"
        >
          {results.map((r, i) => (
            <button
              key={`${r.ident}-${r.type}-${i}`}
              onMouseDown={(e) => {
                e.preventDefault();
                insertResult(r);
              }}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors ${
                i === selectedIdx
                  ? 'bg-blue-500/15'
                  : 'hover:bg-acars-input'
              }`}
            >
              {/* Type indicator dot */}
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: TYPE_COLORS[r.type] ?? 'var(--text-secondary)' }}
              />

              {/* Ident */}
              <span className="font-mono text-[12px] font-semibold text-acars-mono min-w-[52px]">
                {r.ident}
              </span>

              {/* Type badge */}
              <span className="text-[10px] px-[3px] rounded-[2px] bg-acars-badge-bg text-acars-badge-text font-mono">
                {TYPE_LABELS[r.type] ?? r.type}
              </span>

              {/* Name / frequency */}
              <span className="text-[11px] text-acars-muted font-mono truncate ml-auto">
                {r.frequency ? `${r.frequency.toFixed(r.type === 'NDB' ? 0 : 2)}` : ''}
                {r.name ? ` ${r.name}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
