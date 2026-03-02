import { Outlet, useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';

export function DashboardLayout() {
  const { pathname } = useLocation();
  const isFullBleed = pathname === '/';

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <TopBar />
        {isFullBleed ? (
          <div className="flex-1 relative overflow-hidden">
            <Outlet />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 bg-[#141820]">
            <Outlet />
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
