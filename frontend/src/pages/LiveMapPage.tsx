import { Map } from 'lucide-react';

export function LiveMapPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-acars-cyan/10 border border-acars-cyan/20">
        <Map className="w-8 h-8 text-acars-cyan" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-acars-text">Live Map</h2>
        <p className="text-sm text-acars-muted mt-1">Full-screen map with active flights, weather, and FIR boundaries</p>
      </div>
    </div>
  );
}
