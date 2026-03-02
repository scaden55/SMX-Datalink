import type { ReactNode } from 'react';
import { X } from '@phosphor-icons/react';

// ── Types ───────────────────────────────────────────────────────

interface DetailPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

// ── Component ───────────────────────────────────────────────────

export function DetailPanel({
  open,
  onClose,
  title,
  subtitle,
  actions,
  children,
}: DetailPanelProps) {
  return (
    <div
      className={`flex-1 flex flex-col bg-[#1c2033] border-l border-border/50 transition-[transform,opacity] duration-200 ease-out ${
        open
          ? 'translate-x-0 opacity-100'
          : 'translate-x-full opacity-0 pointer-events-none'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-border/30">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-2 flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close panel"
          >
            <X size={16} weight="bold" />
          </button>
        </div>
        {actions && <div className="flex gap-2 mt-3">{actions}</div>}
      </div>

      {/* Content */}
      <div className="p-4 overflow-y-auto flex-1">{children}</div>
    </div>
  );
}
