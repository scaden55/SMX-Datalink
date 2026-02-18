import { BarChart3 } from 'lucide-react';

export function ReportsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-acars-cyan/10 border border-acars-cyan/20">
        <BarChart3 className="w-8 h-8 text-acars-cyan" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-acars-text">Reports</h2>
        <p className="text-sm text-acars-muted mt-1">VA-wide analytics, flight trends, and performance reports</p>
      </div>
    </div>
  );
}
