import { useState, type ReactNode } from 'react';

interface CollapsibleSectionProps {
  title: string;
  summary?: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  summary,
  icon,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-acars-border">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-acars-bg/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-acars-blue">{icon}</span>}
          <span className="text-xs font-semibold text-acars-text">{title}</span>
          {!open && summary && (
            <span className="ml-2 text-[11px] text-acars-muted truncate max-w-[280px]">
              {summary}
            </span>
          )}
        </div>
        <svg
          className={`h-3.5 w-3.5 text-acars-muted transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}
