import { type ReactNode } from 'react';

interface CollapsibleSectionProps {
  title: string;
  summary?: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  /** Status indicator dot: green = data present, amber = warning, grey = empty */
  status?: 'green' | 'amber' | 'grey';
  /** Use checkmark icon instead of dot for completed status */
  useCheckmark?: boolean;
}

const STATUS_COLORS = {
  green: 'var(--status-green)',
  amber: 'var(--status-amber)',
  grey: 'var(--border-panel)',
};

function CheckmarkIcon() {
  return (
    <svg className="w-3 h-3 shrink-0" style={{ color: 'var(--status-green)' }} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CollapsibleSection({
  title,
  icon,
  children,
  status = 'grey',
  useCheckmark = false,
}: CollapsibleSectionProps) {
  return (
    <div className="border-b" style={{ borderColor: 'var(--border-panel)' }}>
      {/* Section header — static, no toggle */}
      <div className="flex items-center gap-2 px-3 h-8">
        {/* Status indicator */}
        {useCheckmark && status === 'green' ? (
          <CheckmarkIcon />
        ) : (
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[status] }} />
        )}

        {/* Icon (optional) */}
        {icon && <span className="text-blue-400 shrink-0">{icon}</span>}

        {/* Title */}
        <span className="text-[11px] uppercase tracking-[0.06em] font-medium" style={{ color: 'var(--text-label)' }}>
          {title}
        </span>
      </div>

      {/* Content — always visible */}
      <div className="px-3 pb-3 pt-1">{children}</div>
    </div>
  );
}
