import { HashRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MainShell } from './components/navigation/MainShell';
import { AuthGuard } from './components/auth/AuthGuard';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { LiveMapPage } from './pages/LiveMapPage';
import { SchedulePage } from './pages/SchedulePage';
import { FlightPlanningPage } from './pages/FlightPlanningPage';
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

export function App() {
  return (
    <ErrorBoundary>
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<AuthGuard />}>
          <Route element={<MainShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/map" element={<LiveMapPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/planning/:bidId?" element={<FlightPlanningPage />} />
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
            <Route path="/admin/finances" element={<AdminFinancesPage />} />
            <Route path="/admin/reports" element={<AdminReportsPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
            <Route path="/admin/audit" element={<AdminAuditPage />} />
          </Route>
        </Route>
      </Routes>
    </HashRouter>
    </ErrorBoundary>
  );
}
