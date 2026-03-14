import { ClipboardText } from '@phosphor-icons/react';

export function PlanningFlightLogTab() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-2 p-4">
      <ClipboardText className="w-6 h-6 text-acars-muted/20" />
      <p className="text-[11px] text-acars-muted">Flight log will be available after the flight</p>
      <p className="text-[9px] text-acars-muted/60">PIREP data, phase times, and fuel tracking</p>
    </div>
  );
}
