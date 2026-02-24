import { useState, useEffect } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';

const isElectron = !!window.electronAPI;

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  // Query initial maximize state + listen for changes
  useEffect(() => {
    if (!isElectron) return;

    window.electronAPI!.isMaximized().then(setMaximized);

    const unsub = window.electronAPI!.on('window:maximized-change', (isMax: unknown) => {
      setMaximized(isMax as boolean);
    });

    return unsub;
  }, []);

  return (
    <div
      className="flex items-center justify-between h-8 min-h-[32px] bg-acars-bg border-b border-acars-border select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left: branding */}
      <div className="flex items-center gap-2 pl-3">
        <img src="./logos/chevron-light.png" alt="SMA" className="h-4 w-auto opacity-80" />
        <span className="text-[11px] font-semibold tracking-wide text-acars-muted/80 uppercase">
          SMA ACARS
        </span>
      </div>

      {/* Right: window controls (Electron only) */}
      {isElectron && (
        <div
          className="flex items-center h-full"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={() => window.electronAPI!.windowMinimize()}
            className="flex items-center justify-center w-12 h-full text-acars-muted/70 hover:bg-white/[0.06] hover:text-acars-text transition-colors"
            title="Minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => window.electronAPI!.windowMaximizeToggle()}
            className="flex items-center justify-center w-12 h-full text-acars-muted/70 hover:bg-white/[0.06] hover:text-acars-text transition-colors"
            title={maximized ? 'Restore' : 'Maximize'}
          >
            {maximized ? <Copy className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => window.electronAPI!.windowClose()}
            className="flex items-center justify-center w-12 h-full text-acars-muted/70 hover:bg-[#e81123] hover:text-white transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
