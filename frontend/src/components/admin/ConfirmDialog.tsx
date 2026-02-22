import { AlertTriangle, Info, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  variant?: 'danger' | 'warning' | 'default';
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_STYLES = {
  danger: {
    icon: AlertTriangle,
    iconColor: 'text-red-400',
    iconBg: 'bg-red-500/10',
    btn: 'bg-red-500 hover:bg-red-500/80',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/10',
    btn: 'bg-amber-500 hover:bg-amber-500/80 text-black',
  },
  default: {
    icon: Info,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
    btn: 'bg-blue-500 hover:bg-blue-500/80',
  },
};

export function ConfirmDialog({
  open,
  title,
  message,
  variant = 'default',
  confirmLabel = 'Confirm',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const styles = VARIANT_STYLES[variant];
  const Icon = styles.icon;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative w-full max-w-md mx-4 rounded-md border border-acars-border bg-acars-panel shadow-2xl">
        <div className="flex items-start gap-3 p-4">
          <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${styles.iconBg}`}>
            <Icon className={`w-5 h-5 ${styles.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-acars-text">{title}</h3>
            <p className="text-xs text-acars-muted mt-1 leading-relaxed">{message}</p>
          </div>
          <button onClick={onCancel} className="text-acars-muted hover:text-acars-text p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-acars-border">
          <button
            onClick={onCancel}
            disabled={loading}
            className="btn-secondary btn-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-3 py-1.5 text-xs font-medium text-white rounded-md transition-colors disabled:opacity-50 ${styles.btn}`}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
