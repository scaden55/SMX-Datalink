import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Minus, Square, X, Copy } from '@phosphor-icons/react';
import { NavSidebar } from './NavSidebar';
import { HeaderBar } from './HeaderBar';
import { StatusBar } from '../layout/StatusBar';
import { DebugOverlay } from '../debug/DebugOverlay';
import { useSocket } from '../../hooks/useSocket';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { toast } from '../../stores/toastStore';

const isElectron = !!window.electronAPI;

function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isElectron) return;

    window.electronAPI!.isMaximized().then(setMaximized);

    const unsub = window.electronAPI!.on('window:maximized-change', (isMax: unknown) => {
      setMaximized(isMax as boolean);
    });

    return unsub;
  }, []);

  if (!isElectron) return null;

  return (
    <div
      className="absolute top-0 right-0 flex items-center h-8 z-50"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <button
        onClick={() => window.electronAPI!.windowMinimize()}
        className="flex items-center justify-center w-12 h-full text-white/30 hover:bg-white/[0.06] hover:text-white/70 transition-colors"
        title="Minimize"
      >
        <Minus className="w-4 h-4" weight="light" />
      </button>
      <button
        onClick={() => window.electronAPI!.windowMaximizeToggle()}
        className="flex items-center justify-center w-12 h-full text-white/30 hover:bg-white/[0.06] hover:text-white/70 transition-colors"
        title={maximized ? 'Restore' : 'Maximize'}
      >
        {maximized ? <Copy className="w-3.5 h-3.5" weight="light" /> : <Square className="w-3.5 h-3.5" weight="light" />}
      </button>
      <button
        onClick={() => window.electronAPI!.windowClose()}
        className="flex items-center justify-center w-12 h-full text-white/30 hover:bg-[#e81123] hover:text-white transition-colors"
        title="Close"
      >
        <X className="w-4 h-4" weight="light" />
      </button>
    </div>
  );
}

export function MainShell() {
  useSocket();

  const user = useAuthStore((s) => s.user);
  const devMode = useUIStore((s) => s.devMode);
  const setDevMode = useUIStore((s) => s.setDevMode);
  const toggleDebugOverlay = useUIStore((s) => s.toggleDebugOverlay);

  // Dev mode defaults off for non-admin users
  useEffect(() => {
    if (user?.role !== 'admin') setDevMode(false);
  }, [user?.role, setDevMode]);

  // Auto-updater notifications (Electron only)
  useEffect(() => {
    if (!isElectron) return;
    const api = window.electronAPI!;

    const unsubs = [
      api.on('update:available', () => {
        toast.info('A new update is available. Downloading...');
      }),
      api.on('update:downloaded', () => {
        toast.success('Update downloaded — it will install on next restart.');
      }),
      api.on('update:error', (msg: unknown) => {
        toast.error(`Update failed: ${msg}`);
      }),
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        if (user?.role === 'admin' && devMode) {
          toggleDebugOverlay();
        }
        return;
      }

      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        if (isElectron && user?.role === 'admin' && devMode) {
          e.preventDefault();
          window.electronAPI!.toggleDevTools();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user?.role, devMode, toggleDebugOverlay]);

  return (
    <div
      className="flex h-full"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Fixed sidebar — extends to top */}
      <NavSidebar />

      {/* Main content column */}
      <div
        className="flex flex-col flex-1 min-w-0 relative"
        style={{
          background: 'linear-gradient(to top right, #000000, #1B1B1C)',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      >
        {/* Draggable region at top for window movement */}
        <div
          className="absolute top-0 left-0 right-0 h-8 z-40"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        />

        {/* Window controls (min/max/close) */}
        <WindowControls />

        <HeaderBar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
        <StatusBar />
      </div>

      {/* Debug overlay (conditionally rendered) */}
      <DebugOverlay />
    </div>
  );
}
