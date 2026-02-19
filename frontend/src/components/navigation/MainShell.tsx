import { Outlet } from 'react-router-dom';
import { NavSidebar } from './NavSidebar';
import { HeaderBar } from './HeaderBar';
import { StatusBar } from '../layout/StatusBar';
import { useSocket } from '../../hooks/useSocket';

export function MainShell() {
  useSocket();

  return (
    <div className="flex h-full">
      {/* Left: Sidebar navigation */}
      <NavSidebar />

      {/* Right: Header + Content + StatusBar */}
      <div className="flex flex-col flex-1 min-w-0">
        <HeaderBar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
        <StatusBar />
      </div>
    </div>
  );
}
