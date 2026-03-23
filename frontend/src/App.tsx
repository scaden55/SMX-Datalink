import { lazy, Suspense, useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Minus, Square, X, Copy } from '@phosphor-icons/react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MainShell } from './components/navigation/MainShell';
import { AuthGuard } from './components/auth/AuthGuard';
import { Toaster } from './components/ui/Toaster';
import { useLocalSimConnect } from './hooks/useLocalSimConnect';
import './stores/flightEventStore'; // activate client-side flight event tracking
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DispatchPage } from './pages/DispatchPage';
import { FleetPage } from './pages/FleetPage';
import { LogbookPage } from './pages/LogbookPage';
import { FlightDetailPage } from './pages/FlightDetailPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

// Lazy-load pages that import Leaflet/react-leaflet to split the map chunk
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const LiveMapPage = lazy(() =>
  import('./pages/LiveMapPage').then((m) => ({ default: m.LiveMapPage }))
);
const SchedulePage = lazy(() =>
  import('./pages/SchedulePage').then((m) => ({ default: m.SchedulePage }))
);
const FlightPlanningPage = lazy(() =>
  import('./pages/FlightPlanningPage').then((m) => ({ default: m.FlightPlanningPage }))
);

const isElectron = !!window.electronAPI;

const PageFallback = () => <div className="flex-1 h-full" />;

/** Floating window controls for pages outside MainShell (login, register) */
function FloatingWindowControls() {
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
      className="fixed top-0 right-0 flex items-center h-8 z-[9999]"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <button
        onClick={() => window.electronAPI!.windowMinimize()}
        className="flex items-center justify-center w-12 h-full text-white/30 hover:bg-white/[0.06] hover:text-white/70 transition-colors"
        title="Minimize"
      >
        <Minus className="w-4 h-4" weight="regular" />
      </button>
      <button
        onClick={() => window.electronAPI!.windowMaximizeToggle()}
        className="flex items-center justify-center w-12 h-full text-white/30 hover:bg-white/[0.06] hover:text-white/70 transition-colors"
        title={maximized ? 'Restore' : 'Maximize'}
      >
        {maximized ? <Copy className="w-3.5 h-3.5" weight="regular" /> : <Square className="w-3.5 h-3.5" weight="regular" />}
      </button>
      <button
        onClick={() => window.electronAPI!.windowClose()}
        className="flex items-center justify-center w-12 h-full text-white/30 hover:bg-[#e81123] hover:text-white transition-colors"
        title="Close"
      >
        <X className="w-4 h-4" weight="regular" />
      </button>
    </div>
  );
}

export function App() {
  useLocalSimConnect();

  return (
    <ErrorBoundary>
    <div
      className="flex flex-col h-full"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div
        className="flex-1 min-h-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <HashRouter>
          <Routes>
            <Route path="/login" element={<><FloatingWindowControls /><LoginPage /></>} />
            <Route path="/register" element={<><FloatingWindowControls /><RegisterPage /></>} />
            <Route element={<AuthGuard />}>
              <Route element={<MainShell />}>
                <Route path="/" element={<Suspense fallback={<PageFallback />}><DashboardPage /></Suspense>} />
                <Route path="/map" element={<Suspense fallback={<PageFallback />}><LiveMapPage /></Suspense>} />
                <Route path="/schedule" element={<Suspense fallback={<PageFallback />}><SchedulePage /></Suspense>} />
                <Route path="/planning/:bidId?" element={<Suspense fallback={<PageFallback />}><FlightPlanningPage /></Suspense>} />
                <Route path="/dispatch" element={<DispatchPage />} />
                <Route path="/fleet" element={<FleetPage />} />
                <Route path="/logbook" element={<LogbookPage />} />
                <Route path="/logbook/:id" element={<FlightDetailPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Routes>
        </HashRouter>
      </div>
    </div>
    <Toaster />
    </ErrorBoundary>
  );
}
