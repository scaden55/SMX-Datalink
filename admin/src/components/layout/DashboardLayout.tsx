import { Outlet, useLocation } from 'react-router-dom';
import { TopBar } from './TopBar';
import { SharedMapContainer } from './SharedMapContainer';

export function DashboardLayout() {
  const { pathname } = useLocation();
  const isMapRoute = pathname === '/' || pathname === '' || pathname === '/dispatch';

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--surface-0)' }}>
      <TopBar />
      <main className="flex-1 relative overflow-hidden">
        {isMapRoute ? (
          <SharedMapContainer>
            <Outlet />
          </SharedMapContainer>
        ) : (
          <div className="h-full overflow-y-auto">
            <Outlet />
          </div>
        )}
      </main>
    </div>
  );
}
