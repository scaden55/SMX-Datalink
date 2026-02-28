import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TitleBar } from './components/navigation/TitleBar';
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
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminSchedulesPage } from './pages/admin/AdminSchedulesPage';
import { AdminPirepsPage } from './pages/admin/AdminPirepsPage';
import { AdminFinancesPage } from './pages/admin/AdminFinancesPage';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { AdminAuditPage } from './pages/admin/AdminAuditPage';
import { AdminMaintenancePage } from './pages/admin/AdminMaintenancePage';

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

const PageFallback = () => <div className="flex-1 h-full bg-acars-bg" />;

export function App() {
  useLocalSimConnect();

  return (
    <ErrorBoundary>
    <div className="flex flex-col h-full">
      <TitleBar />
      <div className="flex-1 min-h-0">
        <HashRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
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
            {/* Dispatcher admin routes (dispatcher + admin) */}
            <Route element={<AuthGuard minRole="dispatcher" />}>
              <Route element={<MainShell />}>
                <Route path="/admin/schedules" element={<AdminSchedulesPage />} />
                <Route path="/admin/pireps" element={<AdminPirepsPage />} />
              </Route>
            </Route>
            {/* Admin-only routes */}
            <Route element={<AuthGuard minRole="admin" />}>
              <Route element={<MainShell />}>
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/maintenance" element={<AdminMaintenancePage />} />
                <Route path="/admin/finances" element={<AdminFinancesPage />} />
                <Route path="/admin/reports" element={<AdminReportsPage />} />
                <Route path="/admin/settings" element={<AdminSettingsPage />} />
                <Route path="/admin/audit" element={<AdminAuditPage />} />
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
