import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Map,
  CalendarDays,
  Route,
  Radio,
  Plane,
  BookOpen,
  BarChart3,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useTelemetry } from '../../hooks/useTelemetry';
import { useAuthStore } from '../../stores/authStore';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/map', label: 'Live Map', icon: Map },
  { to: '/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/planning', label: 'Flight Planning', icon: Route },
  { to: '/dispatch', label: 'Dispatch', icon: Radio },
  { to: '/fleet', label: 'Fleet', icon: Plane },
  { to: '/logbook', label: 'Logbook', icon: BookOpen },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function ConnectionDot() {
  const { connected, connectionStatus, flight } = useTelemetry();

  let color = 'bg-acars-red';
  let label = 'Disconnected';

  if (connected && flight) {
    color = 'bg-acars-green';
    label = 'SimConnect Live';
  } else if (connected) {
    color = 'bg-acars-amber';
    label = 'Sim Connected';
  }

  return (
    <span className="flex items-center gap-2">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      <span className="text-[11px] text-acars-muted truncate">{label}</span>
    </span>
  );
}

export function NavSidebar() {
  const collapsed = useUIStore((s) => s.navCollapsed);
  const toggleNav = useUIStore((s) => s.toggleNav);
  const location = useLocation();
  const user = useAuthStore((s) => s.user);

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}` : '??';
  const displayName = user ? `${user.firstName} ${user.lastName}` : 'Unknown';
  const roleBadge = user?.role ?? 'pilot';

  return (
    <aside
      className={`flex flex-col h-full border-r border-acars-border bg-[#0d1117] transition-[width] duration-200 ease-in-out ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-4 h-12 border-b border-acars-border shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-acars-blue/20">
          <Radio className="w-4 h-4 text-acars-blue" />
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-acars-text truncate">SMA ACARS</span>
            <span className="text-[10px] text-acars-muted uppercase tracking-wider">Flight Ops</span>
          </div>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 py-2 overflow-y-auto">
        <ul className="space-y-0.5 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to);

            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150 ${
                    isActive
                      ? 'bg-[#1c2433] text-acars-blue border-l-[3px] border-acars-blue pl-[9px]'
                      : 'text-acars-muted hover:text-acars-text hover:bg-[#161b22] border-l-[3px] border-transparent pl-[9px]'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-acars-blue' : 'text-acars-muted group-hover:text-acars-text'}`} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-acars-border px-3 py-3 space-y-3 shrink-0">
        {/* Connection Status */}
        {!collapsed && <ConnectionDot />}
        {collapsed && (
          <div className="flex justify-center">
            <ConnectionDot />
          </div>
        )}

        {/* User Info */}
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-acars-blue/20 text-acars-blue text-xs font-semibold shrink-0">
              {initials}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-acars-text truncate">{displayName}</span>
              <span className="inline-flex items-center gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-acars-blue bg-acars-blue/10 px-1.5 py-0.5 rounded">{roleBadge}</span>
              </span>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-acars-blue/20 text-acars-blue text-xs font-semibold">
              {initials}
            </div>
          </div>
        )}

        {/* Collapse Toggle */}
        <button
          onClick={toggleNav}
          className="flex items-center justify-center w-full gap-2 rounded-md px-2 py-1.5 text-acars-muted hover:text-acars-text hover:bg-[#161b22] transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <>
              <PanelLeftClose className="w-4 h-4" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
