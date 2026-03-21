import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

interface AccordionSectionProps {
  title: string;
  summary?: string;
  status?: 'green' | 'amber' | 'red' | 'neutral';
  defaultOpen?: boolean;
  children: ReactNode;
}

const statusColors: Record<string, string> = {
  green: 'bg-emerald-400',
  amber: 'bg-amber-400',
  red: 'bg-red-400',
  neutral: 'bg-[var(--text-muted)]',
};

export default function AccordionSection({
  title,
  summary,
  status = 'neutral',
  defaultOpen = false,
  children,
}: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-md">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-2.5 py-2 text-left"
      >
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${statusColors[status]}`} />
          <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {summary && (
            <span className="font-mono text-[10px] text-[var(--text-secondary)]">{summary}</span>
          )}
          <ChevronRight
            className={`w-3 h-3 text-[var(--text-muted)] transition-transform ${open ? 'rotate-90' : ''}`}
          />
        </div>
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 border-t border-[var(--surface-3)] pt-2">{children}</div>
      )}
    </div>
  );
}
