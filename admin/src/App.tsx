import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { ToastContainer } from '@/components/ToastContainer';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { UsersPage } from '@/pages/UsersPage';
import { SchedulesPage } from '@/pages/SchedulesPage';

// Placeholder pages - will be replaced in later tasks
function PageStub({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <h1 className="text-xl font-semibold text-muted-foreground">{name}</h1>
    </div>
  );
}
const DispatchBoardPage = () => <PageStub name="Dispatch Board" />;
const PirepsPage = () => <PageStub name="PIREPs" />;
const MaintenancePage = () => <PageStub name="Maintenance" />;
const FinancesPage = () => <PageStub name="Finances" />;
const ReportsPage = () => <PageStub name="Reports" />;
const NotificationsPage = () => <PageStub name="Notifications" />;
const AuditPage = () => <PageStub name="Audit Log" />;
const SettingsPage = () => <PageStub name="Settings" />;

export function App() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <BrowserRouter basename="/admin">
      <ToastContainer />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AuthGuard><DashboardLayout /></AuthGuard>}>
          <Route index element={<DashboardPage />} />
          <Route path="dispatch" element={<DispatchBoardPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="schedules" element={<SchedulesPage />} />
          <Route path="pireps" element={<PirepsPage />} />
          <Route path="maintenance" element={<MaintenancePage />} />
          <Route path="finances" element={<FinancesPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
