import { Route } from 'lucide-react';

export function FlightPlanningPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-acars-magenta/10 border border-acars-magenta/20">
        <Route className="w-8 h-8 text-acars-magenta" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-acars-text">Flight Planning</h2>
        <p className="text-sm text-acars-muted mt-1">Route builder, weight &amp; balance, NOTAMs, and flight plan library</p>
      </div>
    </div>
  );
}
