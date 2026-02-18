import { useState } from 'react';

export function RemarksSection() {
  const [dispatcherRemarks, setDispatcherRemarks] = useState('');
  const [fuelAutoRemarks, setFuelAutoRemarks] = useState('');

  return (
    <div className="border-t border-acars-border px-3 py-3">
      <div className="grid grid-cols-2 gap-3">
        {/* Left: Remarks */}
        <div className="space-y-3">
          <div>
            <label className="data-label block mb-1">Dispatcher Remarks</label>
            <textarea
              value={dispatcherRemarks}
              onChange={(e) => setDispatcherRemarks(e.target.value)}
              className="w-full h-16 rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1.5 font-mono resize-none focus:outline-none focus:border-acars-blue"
              placeholder="Enter dispatcher remarks..."
            />
          </div>
          <div>
            <label className="data-label block mb-1">Fuel/Auto Remarks</label>
            <textarea
              value={fuelAutoRemarks}
              onChange={(e) => setFuelAutoRemarks(e.target.value)}
              className="w-full h-16 rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1.5 font-mono resize-none focus:outline-none focus:border-acars-blue"
              placeholder="Enter fuel/auto remarks..."
            />
          </div>
        </div>

        {/* Right: System Info */}
        <div>
          <label className="data-label block mb-1">System Info</label>
          <div className="h-[140px] rounded bg-acars-bg border border-acars-border text-[10px] font-mono px-2 py-1.5 overflow-y-auto leading-relaxed">
            <div className="text-acars-text">This is a staPECO -5 USD/14btsPECO -5 USD/14bts</div>
            <div className="text-acars-text">Blk Hrs/Min Route</div>
            <div className="text-acars-amber">BURN includes 1200lbs due MEL XX-XXXX</div>
            <div className="text-acars-text">COLDS ENRT FUEL TEMP MINC (-) JNA223.8 W11116.8) 4.26/1858NM</div>
            <div className="text-acars-text">JA KKOS-AMSN-KBL KEKD-KSFO</div>
            <div className="text-acars-text">M1 CLEARS TERRAIN</div>
            <div className="text-acars-text">PTOG 181460 ENRT ATOG 263200 ENG AND WING ANTI-ICE ON</div>
          </div>
        </div>
      </div>
    </div>
  );
}
