/**
 * Shared formatting utilities for the admin dashboard.
 * Consolidates date, number, currency, and time formatters
 * previously duplicated across 12+ files.
 */

/** Format ISO date → "Mar 20, 2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return String(iso);
  }
}

/** Format ISO date → "Mar 20, 2026, 02:15 PM" */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

/** Format hours with 1 decimal → "1,234.5" */
export function formatHours(h: number | null | undefined): string {
  if (h == null) return '—';
  return h.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

/** Format number with locale separators → "1,234" */
export function fmtNum(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toLocaleString();
}

/** Format currency → "$1,234" or "$1,234.50" */
export function formatCurrency(amount: number, decimals = 0): string {
  return '$' + Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Compact currency → "$1.2M", "$45.3K", "$500" */
export function fmtCompact(n: number, prefix = '$'): string {
  if (Math.abs(n) >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${prefix}${(n / 1_000).toFixed(1)}K`;
  return `${prefix}${n.toFixed(n % 1 === 0 ? 0 : 2)}`;
}

/** Format minutes → "2h 15m" */
export function fmtTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}

/** Relative time → "just now", "5min ago", "2h ago" */
export function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
