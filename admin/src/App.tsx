import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { CommandPalette } from '@/components/shared/CommandPalette';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';

// Lazy-loaded pages — each becomes a separate chunk
const DispatchMapPage = lazy(() => import('@/pages/DispatchMapPage'));
const FleetPage = lazy(() => import('@/pages/FleetPage').then((m) => ({ default: m.FleetPage })));
const AircraftDetailPage = lazy(() => import('@/pages/AircraftDetailPage').then((m) => ({ default: m.AircraftDetailPage })));
const UsersPage = lazy(() => import('@/pages/UsersPage').then((m) => ({ default: m.UsersPage })));
const SchedulesPage = lazy(() => import('@/pages/SchedulesPage').then((m) => ({ default: m.SchedulesPage })));
const PirepsPage = lazy(() => import('@/pages/PirepsPage').then((m) => ({ default: m.PirepsPage })));
const MaintenancePage = lazy(() => import('@/pages/MaintenancePage').then((m) => ({ default: m.MaintenancePage })));
const FinancesPage = lazy(() => import('@/pages/FinancesPage').then((m) => ({ default: m.FinancesPage })));
const RevenueModelPage = lazy(() => import('@/pages/RevenueModelPage').then((m) => ({ default: m.RevenueModelPage })));
const ReportsPage = lazy(() => import('@/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const AuditPage = lazy(() => import('@/pages/AuditPage').then((m) => ({ default: m.AuditPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

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
          style: { background: 'var(--surface-2)', border: '1px solid var(--panel-border)', color: 'var(--text-primary)' },
        }}
        richColors
      />
      <CommandPalette />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AuthGuard><DashboardLayout /></AuthGuard>}>
          <Route index element={<DashboardPage />} />
          <Route path="dispatch" element={<Suspense fallback={null}><DispatchMapPage /></Suspense>} />
          <Route path="fleet" element={<Suspense fallback={null}><FleetPage /></Suspense>} />
          <Route path="fleet/:id" element={<Suspense fallback={null}><AircraftDetailPage /></Suspense>} />
          <Route path="users" element={<Suspense fallback={null}><UsersPage /></Suspense>} />
          <Route path="schedules" element={<Suspense fallback={null}><SchedulesPage /></Suspense>} />
          <Route path="pireps" element={<Suspense fallback={null}><PirepsPage /></Suspense>} />
          <Route path="maintenance" element={<Suspense fallback={null}><MaintenancePage /></Suspense>} />
          <Route path="finances" element={<Suspense fallback={null}><FinancesPage /></Suspense>} />
          <Route path="revenue-model" element={<Suspense fallback={null}><RevenueModelPage /></Suspense>} />
          <Route path="reports" element={<Suspense fallback={null}><ReportsPage /></Suspense>} />
          <Route path="notifications" element={<Suspense fallback={null}><NotificationsPage /></Suspense>} />
          <Route path="audit" element={<Suspense fallback={null}><AuditPage /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={null}><SettingsPage /></Suspense>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
