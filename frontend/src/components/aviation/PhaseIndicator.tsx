import { cn } from '@/lib/utils';

const PHASE_STYLES: Record<string, { bg: string; text: string }> = {
  preflight:  { bg: 'bg-blue-500/10',     text: 'text-blue-400' },
  pushback:   { bg: 'bg-blue-500/10',     text: 'text-blue-400' },
  taxi_out:   { bg: 'bg-amber-500/10',    text: 'text-amber-400' },
  takeoff:    { bg: 'bg-emerald-500/10',   text: 'text-emerald-400' },
  climb:      { bg: 'bg-[#60a5fa]/10',    text: 'text-[#60a5fa]' },
  cruise:     { bg: 'bg-blue-500/10',      text: 'text-blue-400' },
  descent:    { bg: 'bg-emerald-500/10',   text: 'text-emerald-400' },
  approach:   { bg: 'bg-amber-500/10',     text: 'text-amber-400' },
  landing:    { bg: 'bg-emerald-500/10',   text: 'text-emerald-400' },
  taxi_in:    { bg: 'bg-amber-500/10',     text: 'text-amber-400' },
  arrived:    { bg: 'bg-emerald-500/10',   text: 'text-emerald-400' },
  completed:  { bg: 'bg-acars-muted/10',   text: 'text-acars-muted' },
};

interface PhaseIndicatorProps {
  phase: string;
  className?: string;
}

/**
 * Flight phase pill badge. Displays the current flight phase with
 * color-coded styling matching aviation conventions.
 */
export function PhaseIndicator({ phase, className }: PhaseIndicatorProps) {
  const key = (phase || 'preflight').toLowerCase();
  const style = PHASE_STYLES[key] ?? PHASE_STYLES.preflight;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.08em]',
        style.bg,
        style.text,
        className,
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', style.text.replace('text-', 'bg-'))} />
      {(phase || 'preflight').replace('_', ' ')}
    </span>
  );
}
