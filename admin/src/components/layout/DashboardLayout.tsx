import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';

export function DashboardLayout() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--surface-0)' }}>
      <AppSidebar />
      <div className="flex flex-1 flex-col min-w-0" style={{ background: 'linear-gradient(to top right, #000000, #1B1B1C)' }}>
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
