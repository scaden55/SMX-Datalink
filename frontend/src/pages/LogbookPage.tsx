import { BookOpen } from 'lucide-react';

export function LogbookPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-5">
      <img src="/logos/chevron-light.png" alt="SMA" className="h-14 w-auto opacity-15" />
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-acars-amber/10 border border-acars-amber/20">
        <BookOpen className="w-8 h-8 text-acars-amber" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-acars-text">Logbook</h2>
        <p className="text-sm text-acars-muted mt-1">PIREPs, flight history, and cargo operations statistics</p>
      </div>
    </div>
  );
}
