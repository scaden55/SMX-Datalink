import { CalendarDays } from 'lucide-react';

export function SchedulePage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-acars-amber/10 border border-acars-amber/20">
        <CalendarDays className="w-8 h-8 text-acars-amber" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-acars-text">Schedule</h2>
        <p className="text-sm text-acars-muted mt-1">Browse available flights, filter by hub/aircraft/duration, and place bids</p>
      </div>
    </div>
  );
}
