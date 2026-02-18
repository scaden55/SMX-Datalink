import { Plane } from 'lucide-react';

export function FleetPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-acars-green/10 border border-acars-green/20">
        <Plane className="w-8 h-8 text-acars-green" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-acars-text">Fleet</h2>
        <p className="text-sm text-acars-muted mt-1">Aircraft types, availability, and fleet management</p>
      </div>
    </div>
  );
}
