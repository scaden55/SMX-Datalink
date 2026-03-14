import { cn } from '@/lib/utils';

interface OOOIEvent {
  label: 'OUT' | 'OFF' | 'ON' | 'IN';
  time?: string; // Zulu time string like "14:32Z"
}

interface OOOITimelineProps {
  events: OOOIEvent[];
  className?: string;
}

/**
 * Horizontal OOOI (Out-Off-On-In) timeline for flight event tracking.
 * Standard airline ACARS event sequence: gate departure → takeoff → landing → gate arrival.
 */
export function OOOITimeline({ events, className }: OOOITimelineProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {events.map((event, i) => {
        const isCompleted = !!event.time;
        const isLast = i === events.length - 1;

        return (
          <div key={event.label} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-1">
              {/* Dot */}
              <div
                className={cn(
                  'w-2.5 h-2.5 rounded-full border-2',
                  isCompleted
                    ? 'bg-emerald-500 border-emerald-400'
                    : 'bg-transparent border-acars-muted/30',
                )}
              />
              {/* Label */}
              <span className="text-[9px] font-semibold uppercase tracking-wider text-acars-muted">
                {event.label}
              </span>
              {/* Time */}
              <span
                className={cn(
                  'text-[12px] tabular-nums',
                  isCompleted ? 'text-acars-text' : 'text-acars-muted/30',
                )}
              >
                {event.time ?? '--:--Z'}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className={cn(
                  'h-[2px] w-8 -mt-6',
                  isCompleted && events[i + 1]?.time
                    ? 'bg-emerald-500'
                    : 'bg-acars-muted/20',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
