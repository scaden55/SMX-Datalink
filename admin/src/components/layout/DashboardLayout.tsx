import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';

export function DashboardLayout() {
  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--surface-0)' }}>
      <TopBar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
