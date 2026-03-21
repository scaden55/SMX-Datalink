import type { ReactNode } from 'react';
import { X } from 'lucide-react';

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
    <aside
      role="complementary"
      aria-label={title}
      aria-hidden={!open}
      className={`flex-1 flex flex-col border-l transition-[transform,opacity] duration-200 ease-out ${
        open
          ? 'translate-x-0 opacity-100'
          : 'translate-x-full opacity-0 pointer-events-none'
      }`}
      style={{
        backgroundColor: 'transparent',
        borderLeftColor: 'var(--panel-border)',
      }}
    >
      {/* Header */}
      <div
        className="p-4 border-b"
        style={{ borderBottomColor: 'var(--border-primary)' }}
      >
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-heading truncate" style={{ fontSize: 14 }}>
              {title}
            </h2>
            {subtitle && (
              <p className="text-caption mt-0.5 truncate">{subtitle}</p>
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
            <X size={16} />
          </button>
        </div>
        {actions && <div className="flex gap-2 mt-3">{actions}</div>}
      </div>

      {/* Content */}
      <div className="p-4 overflow-y-auto flex-1">{children}</div>
    </aside>
  );
}
