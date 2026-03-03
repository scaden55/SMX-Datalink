import type { ReactNode } from 'react';
import { X } from '@phosphor-icons/react';

// ── Types ───────────────────────────────────────────────────

interface DetailPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

// ── Component ───────────────────────────────────────────────

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
      className={`flex-1 flex flex-col border-l transition-[transform,opacity] duration-200 ease-out ${
        open
          ? 'translate-x-0 opacity-100'
          : 'translate-x-full opacity-0 pointer-events-none'
      }`}
      style={{
        backgroundColor: 'var(--surface-2)',
        borderLeftColor: 'var(--border-primary)',
      }}
    >
      {/* Header */}
      <div
        className="p-4 border-b"
        style={{ borderBottomColor: 'var(--border-primary)' }}
      >
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h2
              className="text-sm font-semibold truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {title}
            </h2>
            {subtitle && (
              <p
                className="text-xs mt-0.5 truncate"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-2 flex-shrink-0 transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
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
