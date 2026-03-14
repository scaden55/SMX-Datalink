import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { CommandPalette } from '@/components/shared/CommandPalette';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { UsersPage } from '@/pages/UsersPage';
import { SchedulesPage } from '@/pages/SchedulesPage';
import { PirepsPage } from '@/pages/PirepsPage';
import { MaintenancePage } from '@/pages/MaintenancePage';
import { FinancesPage } from '@/pages/FinancesPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { DispatchBoardPage } from '@/pages/DispatchBoardPage';
import { AuditPage } from '@/pages/AuditPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { FleetPage } from '@/pages/FleetPage';
import { AircraftDetailPage } from '@/pages/AircraftDetailPage';
import { RevenueModelPage } from '@/pages/RevenueModelPage';

export function App() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <ErrorBoundary>
    <BrowserRouter basename="/admin">
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: { background: 'var(--surface-3)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' },
        }}
        richColors
      />
      <CommandPalette />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AuthGuard><DashboardLayout /></AuthGuard>}>
          <Route index element={<DashboardPage />} />
          <Route path="dispatch" element={<DispatchBoardPage />} />
          <Route path="fleet" element={<FleetPage />} />
          <Route path="fleet/:id" element={<AircraftDetailPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="schedules" element={<SchedulesPage />} />
          <Route path="pireps" element={<PirepsPage />} />
          <Route path="maintenance" element={<MaintenancePage />} />
          <Route path="finances" element={<FinancesPage />} />
          <Route path="revenue-model" element={<RevenueModelPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
