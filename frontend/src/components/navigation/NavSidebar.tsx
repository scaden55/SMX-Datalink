import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  type Icon,
  SquaresFour,
  MapTrifold,
  CalendarDots,
  Path,
  Broadcast,
  AirplaneTilt,
  BookOpen,
  ChartBar,
  Gear,
  SidebarSimple,
  Sidebar,
  Bell,
  SignOut,
} from '@phosphor-icons/react';
import { useUIStore } from '../../stores/uiStore';
import { useTelemetry } from '../../hooks/useTelemetry';
import { useAuthStore } from '../../stores/authStore';
import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { useNotificationStore } from '../../stores/notificationStore';

interface NavItem {
  to: string;
  label: string;
  icon: Icon;
}

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: SquaresFour },
  { to: '/map', label: 'Live Map', icon: MapTrifold },
  { to: '/schedule', label: 'Schedule', icon: CalendarDots },
  { to: '/planning', label: 'Flight Planning', icon: Path },
  { to: '/dispatch', label: 'Dispatch', icon: Broadcast },
  { to: '/fleet', label: 'Fleet', icon: AirplaneTilt },
  { to: '/logbook', label: 'Logbook', icon: BookOpen },
  { to: '/reports', label: 'Reports', icon: ChartBar },
  { to: '/settings', label: 'Settings', icon: Gear },
];


function ConnectionDot({ collapsed }: { collapsed: boolean }) {
  const { connected, connectionStatus, flight } = useTelemetry();

  let color = 'bg-red-500';
  let textColor = 'text-red-400/60';
  let label = 'Disconnected';
  let tooltip = connectionStatus.lastError || 'SimConnect not connected';

  if (connected && flight) {
    color = 'bg-emerald-500';
    textColor = 'text-emerald-400/60';
    label = 'SimConnect Live';
    tooltip = `Connected to ${connectionStatus.applicationName}`;
  } else if (connected) {
    color = 'bg-amber-500';
    textColor = 'text-amber-400/60';
    label = 'Sim Connected';
    tooltip = `Connected to ${connectionStatus.applicationName}`;
  }

  return (
    <span className={`flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`} title={tooltip}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${color} ${!connected ? 'animate-pulse' : ''}`} />
      {!collapsed && (
        <span className={`text-[10px] truncate ${textColor}`}>
          {label}
          {!connected && connectionStatus.lastError && (
            <span className="block text-[9px] text-[var(--text-label)] truncate">{connectionStatus.lastError}</span>
          )}
        </span>
      )}
    </span>
  );
}

function NavItemLink({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  return (
    <li className="relative">
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#3b5bdb]" />
      )}
      <NavLink
        to={item.to}
        title={collapsed ? item.label : undefined}
        className={`group flex items-center transition-all duration-150 ${
          collapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-4 py-[7px]'
        } ${
          isActive
            ? 'bg-[#3b5bdb]/15 text-white'
            : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/[0.04]'
        }`}
      >
        <Icon
          weight="light"
          className={`w-[17px] h-[17px] shrink-0 ${
            isActive ? 'text-[#6b8aff]' : 'text-[var(--text-label)] group-hover:text-white/70'
          }`}
        />
        {!collapsed && <span className="text-[13px] font-medium truncate">{item.label}</span>}
      </NavLink>
    </li>
  );
}

export function NavSidebar() {
  const collapsed = useUIStore((s) => s.navCollapsed);
  const toggleNav = useUIStore((s) => s.toggleNav);
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const activeBidId = useFlightPlanStore((s) => s.activeBidId);

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}` : '??';
  const displayName = user ? `${user.firstName} ${user.lastName}` : 'Unknown';
  return (
    <aside
      className={`flex flex-col h-full shrink-0 transition-[width] duration-200 ease-in-out ${
        collapsed ? 'w-[60px]' : 'w-[220px]'
      }`}
      style={{ background: 'linear-gradient(to top, #000000, #1B1B1C)' }}
    >
      {/* Header: Logo */}
      <div className={`flex items-center h-12 shrink-0 ${
        collapsed ? 'justify-center px-2' : 'px-4 gap-2.5'
      }`}>
        <img src="./logos/chevron-light.png" alt="SMX" className="h-5 w-auto shrink-0 opacity-80" />
        {!collapsed && (
          <span className="text-[13px] font-semibold text-white/90 tracking-tight truncate">SMX ACARS</span>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 py-3 overflow-y-auto" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to);

            const resolvedItem = item.to === '/planning' && activeBidId
              ? { ...item, to: `/planning/${activeBidId}` }
              : item;

            return (
              <NavItemLink
                key={item.to}
                item={resolvedItem}
                isActive={isActive}
                collapsed={collapsed}
              />
            );
          })}
        </ul>
      </nav>

      {/* Bottom section */}
      <div className={`py-3 space-y-2.5 shrink-0 ${
        collapsed ? 'px-2' : 'px-3'
      }`} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <ConnectionDot collapsed={collapsed} />

        {/* Notifications indicator */}
        {unreadCount > 0 && (
          <NavLink
            to="/settings"
            title={collapsed ? `${unreadCount} notifications` : undefined}
            className={`flex items-center gap-2 text-[var(--text-secondary)] hover:text-white ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <div className="relative">
              <Bell className="w-3.5 h-3.5" weight="light" />
              <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[14px] h-[14px] rounded-full bg-red-500 text-[8px] font-bold text-white px-0.5">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            </div>
            {!collapsed && (
              <span className="text-[10px]">{unreadCount} new</span>
            )}
          </NavLink>
        )}

        {/* User Info */}
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-white/[0.08] text-white/70 text-[10px] font-semibold shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[12px] text-white/90 truncate leading-tight">{displayName}</span>
              <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--text-label)]">{user?.role ?? 'pilot'}</span>
            </div>
          )}
        </div>

        {/* Logout + Collapse toggle */}
        <div className={`flex items-center ${collapsed ? 'flex-col gap-0.5' : 'justify-between'} pt-1`}>
          {!collapsed && (
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-[10px] text-[var(--text-label)] hover:text-red-400 transition-colors"
              title="Sign out"
            >
              <SignOut className="w-3 h-3" weight="light" />
              Sign Out
            </button>
          )}
          <button
            onClick={toggleNav}
            className="flex items-center justify-center w-6 h-6 rounded text-[var(--text-label)] hover:text-white hover:bg-white/[0.04] transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <Sidebar className="w-3.5 h-3.5" weight="light" />
            ) : (
              <SidebarSimple className="w-3.5 h-3.5" weight="light" />
            )}
          </button>
          {collapsed && (
            <button
              onClick={logout}
              className="flex items-center justify-center w-6 h-6 rounded text-[var(--text-label)] hover:text-red-400 transition-colors"
              title="Sign out"
            >
              <SignOut className="w-3 h-3" weight="light" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
