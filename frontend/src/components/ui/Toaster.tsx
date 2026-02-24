import { useToastStore, type Toast } from '../../stores/toastStore';
import { X } from '@phosphor-icons/react';

const colorMap: Record<Toast['type'], { border: string; bg: string; text: string }> = {
  success: {
    border: 'border-green-500/30',
    bg: 'bg-green-500/10',
    text: 'text-green-400',
  },
  error: {
    border: 'border-red-500/30',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
  },
  warning: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
  },
  info: {
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
  },
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[10000] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => {
        const colors = colorMap[t.type];
        return (
          <div
            key={t.id}
            className={`
              flex items-start gap-2 px-3 py-2.5 rounded-md border
              ${colors.border} ${colors.bg}
              font-sans text-[11px] shadow-lg
              animate-in slide-in-from-right duration-200
            `}
          >
            <span className={`${colors.text} flex-1 leading-relaxed`}>
              {t.message}
            </span>
            <button
              onClick={() => removeToast(t.id)}
              className={`${colors.text} opacity-60 hover:opacity-100 transition-opacity shrink-0 mt-0.5`}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
