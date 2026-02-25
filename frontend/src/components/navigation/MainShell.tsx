import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { NavSidebar } from './NavSidebar';
import { HeaderBar } from './HeaderBar';
import { StatusBar } from '../layout/StatusBar';
import { DebugOverlay } from '../debug/DebugOverlay';
import { useSocket } from '../../hooks/useSocket';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { toast } from '../../stores/toastStore';
import { api } from '../../lib/api';
import type { VaSettingsResponse } from '@acars/shared';

const isElectron = !!window.electronAPI;

export function MainShell() {
  useSocket();

  const user = useAuthStore((s) => s.user);
  const devMode = useUIStore((s) => s.devMode);
  const setDevMode = useUIStore((s) => s.setDevMode);
  const toggleDebugOverlay = useUIStore((s) => s.toggleDebugOverlay);

  // Sync dev mode from server on mount
  useEffect(() => {
    if (user?.role !== 'admin') {
      setDevMode(false);
      return;
    }

    api.get<VaSettingsResponse>('/api/admin/settings')
      .then((data) => {
        const devSetting = data.settings.find((s) => s.key === 'dev.enabled');
        setDevMode(devSetting?.value === 'true');
      })
      .catch(() => {
        // Silently fail — keep local state
      });
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
    <div className="flex h-full">
      {/* Fixed sidebar */}
      <NavSidebar />

      {/* Main content column */}
      <div className="flex flex-col flex-1 min-w-0">
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
