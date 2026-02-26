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
  Users,
  ClipboardText,
  CurrencyDollar,
  Scroll,
  SidebarSimple,
  Sidebar,
  Bell,
  SignOut,
  Shield,
  Wrench,
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

// Dispatcher sees only Schedules + PIREPs; admin sees all
const dispatcherAdminItems: NavItem[] = [
  { to: '/admin/schedules', label: 'Schedules', icon: CalendarDots },
  { to: '/admin/pireps', label: 'PIREPs', icon: ClipboardText },
];

const adminOnlyItems: NavItem[] = [
  { to: '/admin/maintenance', label: 'Maintenance', icon: Wrench },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/finances', label: 'Finances', icon: CurrencyDollar },
  { to: '/admin/reports', label: 'Admin Reports', icon: ChartBar },
  { to: '/admin/settings', label: 'VA Settings', icon: Gear },
  { to: '/admin/audit', label: 'Audit Log', icon: Scroll },
];

function ConnectionDot({ collapsed }: { collapsed: boolean }) {
  const { connected, connectionStatus, flight } = useTelemetry();

  let color = 'bg-red-500';
  let textColor = 'text-red-400/70';
  let label = 'Disconnected';
  let tooltip = connectionStatus.lastError || 'SimConnect not connected';

  if (connected && flight) {
    color = 'bg-emerald-500';
    textColor = 'text-emerald-400/70';
    label = 'SimConnect Live';
    tooltip = `Connected to ${connectionStatus.applicationName}`;
  } else if (connected) {
    color = 'bg-amber-500';
    textColor = 'text-amber-400/70';
    label = 'Sim Connected';
    tooltip = `Connected to ${connectionStatus.applicationName}`;
  }

  return (
    <span className={`flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`} title={tooltip}>
      <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${color} ${!connected ? 'animate-pulse' : ''}`} />
      {!collapsed && (
        <span className={`text-[10px] truncate ${textColor}`}>
          {label}
          {!connected && connectionStatus.lastError && (
            <span className="block text-[9px] text-acars-muted/50 truncate">{connectionStatus.lastError}</span>
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
  accentClass = 'blue',
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  accentClass?: 'blue' | 'orange';
}) {
  const Icon = item.icon;

  const isOrange = accentClass === 'orange';

  // Active styles
  const activeText = isOrange ? 'text-orange-500' : 'text-blue-400';
  const activeBg = isOrange ? 'bg-orange-500/10' : 'bg-blue-500/10';
  const activeBorder = isOrange ? 'border-orange-500' : 'border-blue-400';

  // Hover styles — tinted with the section's accent color
  const hoverBg = isOrange ? 'hover:bg-orange-500/[0.08]' : 'hover:bg-blue-500/[0.08]';
  const hoverText = isOrange ? 'hover:text-orange-400' : 'hover:text-blue-400';
  const hoverIcon = isOrange ? 'group-hover:text-orange-400' : 'group-hover:text-blue-400';

  return (
    <li>
      <NavLink
        to={item.to}
        title={collapsed ? item.label : undefined}
        className={`group flex items-center rounded-md transition-all duration-100 ${
          collapsed ? 'justify-center p-2' : 'gap-2.5 px-3 py-[7px]'
        } ${
          isActive
            ? `${activeBg} ${activeText} ${collapsed ? '' : `border-l-2 ${activeBorder} pl-[10px]`}`
            : `text-acars-muted ${hoverText} ${hoverBg} ${collapsed ? '' : 'border-l-2 border-transparent pl-[10px]'}`
        }`}
      >
        <Icon
          className={`w-[17px] h-[17px] shrink-0 ${
            isActive ? activeText : `text-acars-muted/70 ${hoverIcon}`
          }`}
        />
        {!collapsed && <span className="text-[13px] truncate">{item.label}</span>}
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
  const roleBadge = user?.role ?? 'pilot';

  return (
    <aside
      className={`flex flex-col h-full bg-acars-bg border-r border-acars-border shrink-0 transition-[width] duration-200 ease-in-out ${
        collapsed ? 'w-[60px]' : 'w-[220px]'
      }`}
    >
      {/* Header: Logo */}
      <div className={`flex items-center h-11 border-b border-acars-border shrink-0 ${
        collapsed ? 'justify-center px-2' : 'px-4 gap-2.5'
      }`}>
        <img src="./logos/chevron-light.png" alt="SMX" className="h-6 w-auto shrink-0 opacity-90" />
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-semibold text-acars-text tracking-tight truncate">SMX ACARS</span>
            <span className="text-[9px] text-acars-muted/60 uppercase tracking-[0.1em]">Flight Ops</span>
          </div>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 py-2 overflow-y-auto">
        <ul className={`space-y-0.5 ${collapsed ? 'px-1.5' : 'px-2'}`}>
          {navItems.map((item) => {
            const isActive = item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to);

            // Restore last-used bid in the Planning link
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

        {/* Admin Section */}
        {(roleBadge === 'admin' || roleBadge === 'dispatcher') && (
          <>
            <div className={`flex items-center gap-2 my-3 ${collapsed ? 'mx-2' : 'mx-4'}`}>
              {collapsed ? (
                <div className="w-full flex flex-col items-center gap-1">
                  <div className="w-full h-px bg-orange-500/30" />
                  <Shield className="w-3 h-3 text-orange-500/60" />
                </div>
              ) : (
                <>
                  <div className="flex-1 h-px bg-acars-border" />
                  <Shield className="w-3 h-3 text-orange-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-500">Admin</span>
                  <div className="flex-1 h-px bg-acars-border" />
                </>
              )}
            </div>
            <ul className={`space-y-0.5 ${collapsed ? 'px-1.5' : 'px-2'}`}>
              {[...dispatcherAdminItems, ...(roleBadge === 'admin' ? adminOnlyItems : [])].map((item) => {
                const isActive = location.pathname.startsWith(item.to);

                return (
                  <NavItemLink
                    key={item.to}
                    item={item}
                    isActive={isActive}
                    collapsed={collapsed}
                    accentClass="orange"
                  />
                );
              })}
            </ul>
          </>
        )}
      </nav>

      {/* Bottom section */}
      <div className={`border-t border-acars-border py-2.5 space-y-2 shrink-0 ${
        collapsed ? 'px-2' : 'px-3'
      }`}>
        <ConnectionDot collapsed={collapsed} />

        {/* Notifications indicator */}
        {unreadCount > 0 && (
          <NavLink
            to="/settings"
            title={collapsed ? `${unreadCount} notifications` : undefined}
            className={`flex items-center gap-2 text-acars-muted hover:text-acars-text ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <div className="relative">
              <Bell className="w-3.5 h-3.5" />
              <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[14px] h-[14px] rounded-full bg-red-500 text-[8px] font-bold text-white px-0.5 shadow-sm shadow-red-500/30">
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
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/15 border border-blue-400/20 text-blue-400 text-[10px] font-semibold shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[12px] text-acars-text truncate leading-tight">{displayName}</span>
              <span className="text-[9px] font-medium uppercase tracking-wider text-acars-muted/60">{roleBadge}</span>
            </div>
          )}
        </div>

        {/* Logout + Collapse toggle */}
        <div className={`flex items-center ${collapsed ? 'flex-col gap-0.5' : 'justify-between'} pt-1`}>
          {!collapsed && (
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-[10px] text-acars-muted/60 hover:text-red-400"
              title="Sign out"
            >
              <SignOut className="w-3 h-3" />
              Sign Out
            </button>
          )}
          <button
            onClick={toggleNav}
            className="flex items-center justify-center w-6 h-6 rounded text-acars-muted/50 hover:text-acars-text hover:bg-acars-hover"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <Sidebar className="w-3.5 h-3.5" />
            ) : (
              <SidebarSimple className="w-3.5 h-3.5" />
            )}
          </button>
          {collapsed && (
            <button
              onClick={logout}
              className="flex items-center justify-center w-6 h-6 rounded text-acars-muted/50 hover:text-red-400"
              title="Sign out"
            >
              <SignOut className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
