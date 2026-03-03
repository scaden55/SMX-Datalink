import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

const statusConfig: Record<string, { bg: string; text: string; ring: string; label: string }> = {
  approved: { bg: 'bg-[var(--accent-emerald-bg)]', text: 'text-[var(--accent-emerald)]', ring: 'ring-[var(--accent-emerald-ring)]', label: 'Approved' },
  active: { bg: 'bg-[var(--accent-emerald-bg)]', text: 'text-[var(--accent-emerald)]', ring: 'ring-[var(--accent-emerald-ring)]', label: 'Active' },
  completed: { bg: 'bg-[var(--accent-blue-bg)]', text: 'text-[var(--accent-blue)]', ring: 'ring-[var(--accent-blue-ring)]', label: 'Completed' },
  published: { bg: 'bg-[var(--accent-blue-bg)]', text: 'text-[var(--accent-blue)]', ring: 'ring-[var(--accent-blue-ring)]', label: 'Published' },
  pending: { bg: 'bg-[var(--accent-amber-bg)]', text: 'text-[var(--accent-amber)]', ring: 'ring-[var(--accent-amber-ring)]', label: 'Pending' },
  scheduled: { bg: 'bg-[var(--accent-amber-bg)]', text: 'text-[var(--accent-amber)]', ring: 'ring-[var(--accent-amber-ring)]', label: 'Scheduled' },
  in_progress: { bg: 'bg-[var(--accent-cyan-bg)]', text: 'text-[var(--accent-cyan)]', ring: 'ring-[var(--accent-cyan-ring)]', label: 'In Progress' },
  rejected: { bg: 'bg-[var(--accent-red-bg)]', text: 'text-[var(--accent-red)]', ring: 'ring-[var(--accent-red-ring)]', label: 'Rejected' },
  suspended: { bg: 'bg-[var(--accent-red-bg)]', text: 'text-[var(--accent-red)]', ring: 'ring-[var(--accent-red-ring)]', label: 'Suspended' },
  overdue: { bg: 'bg-[var(--accent-red-bg)]', text: 'text-[var(--accent-red)]', ring: 'ring-[var(--accent-red-ring)]', label: 'Overdue' },
  critical: { bg: 'bg-[var(--accent-red-bg)]', text: 'text-[var(--accent-red)]', ring: 'ring-[var(--accent-red-ring)]', label: 'Critical' },
  info: { bg: 'bg-[var(--accent-cyan-bg)]', text: 'text-[var(--accent-cyan)]', ring: 'ring-[var(--accent-cyan-ring)]', label: 'Info' },
  filed: { bg: 'bg-[var(--accent-blue-bg)]', text: 'text-[var(--accent-blue)]', ring: 'ring-[var(--accent-blue-ring)]', label: 'Filed' },
  warning: { bg: 'bg-[var(--accent-amber-bg)]', text: 'text-[var(--accent-amber)]', ring: 'ring-[var(--accent-amber-ring)]', label: 'Warning' },
  success: { bg: 'bg-[var(--accent-emerald-bg)]', text: 'text-[var(--accent-emerald)]', ring: 'ring-[var(--accent-emerald-ring)]', label: 'Success' },
  error: { bg: 'bg-[var(--accent-red-bg)]', text: 'text-[var(--accent-red)]', ring: 'ring-[var(--accent-red-ring)]', label: 'Error' },
  // User roles
  admin: { bg: 'bg-[var(--accent-red-bg)]', text: 'text-[var(--accent-red)]', ring: 'ring-[var(--accent-red-ring)]', label: 'Admin' },
  dispatcher: { bg: 'bg-[var(--accent-blue-bg)]', text: 'text-[var(--accent-blue)]', ring: 'ring-[var(--accent-blue-ring)]', label: 'Dispatcher' },
  pilot: { bg: 'bg-[var(--accent-emerald-bg)]', text: 'text-[var(--accent-emerald)]', ring: 'ring-[var(--accent-emerald-ring)]', label: 'Pilot' },
  // Finance types
  income: { bg: 'bg-[var(--accent-emerald-bg)]', text: 'text-[var(--accent-emerald)]', ring: 'ring-[var(--accent-emerald-ring)]', label: 'Income' },
  expense: { bg: 'bg-[var(--accent-red-bg)]', text: 'text-[var(--accent-red)]', ring: 'ring-[var(--accent-red-ring)]', label: 'Expense' },
  bonus: { bg: 'bg-[var(--accent-cyan-bg)]', text: 'text-[var(--accent-cyan)]', ring: 'ring-[var(--accent-cyan-ring)]', label: 'Bonus' },
  deduction: { bg: 'bg-[var(--accent-amber-bg)]', text: 'text-[var(--accent-amber)]', ring: 'ring-[var(--accent-amber-ring)]', label: 'Deduction' },
  pay: { bg: 'bg-[var(--accent-blue-bg)]', text: 'text-[var(--accent-blue)]', ring: 'ring-[var(--accent-blue-ring)]', label: 'Pay' },
  voided: { bg: 'bg-[var(--surface-3)]', text: 'text-[var(--text-quaternary)]', ring: 'ring-[var(--border-secondary)]', label: 'Voided' },
  // Schedule types
  charter: { bg: 'bg-[var(--accent-amber-bg)]', text: 'text-[var(--accent-amber)]', ring: 'ring-[var(--accent-amber-ring)]', label: 'Charter' },
  cargo: { bg: 'bg-[var(--accent-blue-bg)]', text: 'text-[var(--accent-blue)]', ring: 'ring-[var(--accent-blue-ring)]', label: 'Cargo' },
  passenger: { bg: 'bg-[var(--accent-emerald-bg)]', text: 'text-[var(--accent-emerald)]', ring: 'ring-[var(--accent-emerald-ring)]', label: 'Passenger' },
  inactive: { bg: 'bg-[var(--surface-3)]', text: 'text-[var(--text-quaternary)]', ring: 'ring-[var(--border-secondary)]', label: 'Inactive' },
  enabled: { bg: 'bg-[var(--accent-emerald-bg)]', text: 'text-[var(--accent-emerald)]', ring: 'ring-[var(--accent-emerald-ring)]', label: 'Enabled' },
  disabled: { bg: 'bg-[var(--surface-3)]', text: 'text-[var(--text-quaternary)]', ring: 'ring-[var(--border-secondary)]', label: 'Disabled' },
  hub: { bg: 'bg-[var(--accent-blue-bg)]', text: 'text-[var(--accent-blue)]', ring: 'ring-[var(--accent-blue-ring)]', label: 'Hub' },
  // Inactive statuses
  deleted: { bg: 'bg-[var(--surface-3)]', text: 'text-[var(--text-quaternary)]', ring: 'ring-[var(--border-secondary)]', label: 'Deleted' },
  diverted: { bg: 'bg-[var(--accent-blue-bg)]', text: 'text-[var(--accent-blue)]', ring: 'ring-[var(--accent-blue-ring)]', label: 'Diverted' },
  cancelled: { bg: 'bg-[var(--surface-3)]', text: 'text-[var(--text-quaternary)]', ring: 'ring-[var(--border-secondary)]', label: 'Cancelled' },
  // Maintenance-specific statuses
  open: { bg: 'bg-[var(--accent-amber-bg)]', text: 'text-[var(--accent-amber)]', ring: 'ring-[var(--accent-amber-ring)]', label: 'Open' },
  complied: { bg: 'bg-[var(--accent-emerald-bg)]', text: 'text-[var(--accent-emerald)]', ring: 'ring-[var(--accent-emerald-ring)]', label: 'Complied' },
  recurring: { bg: 'bg-[var(--accent-cyan-bg)]', text: 'text-[var(--accent-cyan)]', ring: 'ring-[var(--accent-cyan-ring)]', label: 'Recurring' },
  not_applicable: { bg: 'bg-[var(--surface-3)]', text: 'text-[var(--text-quaternary)]', ring: 'ring-[var(--border-secondary)]', label: 'N/A' },
  rectified: { bg: 'bg-[var(--accent-emerald-bg)]', text: 'text-[var(--accent-emerald)]', ring: 'ring-[var(--accent-emerald-ring)]', label: 'Rectified' },
  expired: { bg: 'bg-[var(--accent-red-bg)]', text: 'text-[var(--accent-red)]', ring: 'ring-[var(--accent-red-ring)]', label: 'Expired' },
  deferred: { bg: 'bg-[var(--accent-amber-bg)]', text: 'text-[var(--accent-amber)]', ring: 'ring-[var(--accent-amber-ring)]', label: 'Deferred' },
  installed: { bg: 'bg-[var(--accent-emerald-bg)]', text: 'text-[var(--accent-emerald)]', ring: 'ring-[var(--accent-emerald-ring)]', label: 'Installed' },
  removed: { bg: 'bg-[var(--accent-amber-bg)]', text: 'text-[var(--accent-amber)]', ring: 'ring-[var(--accent-amber-ring)]', label: 'Removed' },
  in_shop: { bg: 'bg-[var(--accent-cyan-bg)]', text: 'text-[var(--accent-cyan)]', ring: 'ring-[var(--accent-cyan-ring)]', label: 'In Shop' },
  scrapped: { bg: 'bg-[var(--accent-red-bg)]', text: 'text-[var(--accent-red)]', ring: 'ring-[var(--accent-red-ring)]', label: 'Scrapped' },
  maintenance: { bg: 'bg-[var(--accent-amber-bg)]', text: 'text-[var(--accent-amber)]', ring: 'ring-[var(--accent-amber-ring)]', label: 'Maintenance' },
  stored: { bg: 'bg-[var(--surface-3)]', text: 'text-[var(--text-quaternary)]', ring: 'ring-[var(--border-secondary)]', label: 'Stored' },
  retired: { bg: 'bg-[var(--accent-red-bg)]', text: 'text-[var(--accent-red)]', ring: 'ring-[var(--accent-red-ring)]', label: 'Retired' },
  ok: { bg: 'bg-[var(--accent-emerald-bg)]', text: 'text-[var(--accent-emerald)]', ring: 'ring-[var(--accent-emerald-ring)]', label: 'OK' },
  overflight: { bg: 'bg-[var(--accent-amber-bg)]', text: 'text-[var(--accent-amber)]', ring: 'ring-[var(--accent-amber-ring)]', label: 'Overflight' },
  // Flight phases — airborne (emerald)
  climb: { bg: 'bg-[var(--accent-emerald-bg)]', text: 'text-[var(--accent-emerald)]', ring: 'ring-[var(--accent-emerald-ring)]', label: 'Climb' },
  cruise: { bg: 'bg-[var(--accent-emerald-bg)]', text: 'text-[var(--accent-emerald)]', ring: 'ring-[var(--accent-emerald-ring)]', label: 'Cruise' },
  descent: { bg: 'bg-[var(--accent-emerald-bg)]', text: 'text-[var(--accent-emerald)]', ring: 'ring-[var(--accent-emerald-ring)]', label: 'Descent' },
  approach: { bg: 'bg-[var(--accent-emerald-bg)]', text: 'text-[var(--accent-emerald)]', ring: 'ring-[var(--accent-emerald-ring)]', label: 'Approach' },
  takeoff: { bg: 'bg-[var(--accent-emerald-bg)]', text: 'text-[var(--accent-emerald)]', ring: 'ring-[var(--accent-emerald-ring)]', label: 'Takeoff' },
  landing: { bg: 'bg-[var(--accent-emerald-bg)]', text: 'text-[var(--accent-emerald)]', ring: 'ring-[var(--accent-emerald-ring)]', label: 'Landing' },
  // Flight phases — ground (blue)
  preflight: { bg: 'bg-[var(--accent-blue-bg)]', text: 'text-[var(--accent-blue)]', ring: 'ring-[var(--accent-blue-ring)]', label: 'Preflight' },
  taxi_out: { bg: 'bg-[var(--accent-blue-bg)]', text: 'text-[var(--accent-blue)]', ring: 'ring-[var(--accent-blue-ring)]', label: 'Taxi Out' },
  taxi_in: { bg: 'bg-[var(--accent-blue-bg)]', text: 'text-[var(--accent-blue)]', ring: 'ring-[var(--accent-blue-ring)]', label: 'Taxi In' },
  parked: { bg: 'bg-[var(--accent-blue-bg)]', text: 'text-[var(--accent-blue)]', ring: 'ring-[var(--accent-blue-ring)]', label: 'Parked' },
};

const fallback = { bg: 'bg-[var(--accent-blue-bg)]', text: 'text-[var(--accent-blue)]', ring: 'ring-[var(--accent-blue-ring)]', label: '' };

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? fallback;
  const displayLabel = label ?? (config.label || status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ring-1',
        config.bg, config.text, config.ring,
        className,
      )}
    >
      {displayLabel}
    </span>
  );
}
