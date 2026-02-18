import { HashRouter, Routes, Route } from 'react-router-dom';
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
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<AuthGuard />}>
          <Route element={<MainShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/map" element={<LiveMapPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/planning" element={<FlightPlanningPage />} />
            <Route path="/dispatch" element={<DispatchPage />} />
            <Route path="/fleet" element={<FleetPage />} />
            <Route path="/logbook" element={<LogbookPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </HashRouter>
  );
}
