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
  Users,
  ClipboardCheck,
  DollarSign,
  ScrollText,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
  LogOut,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useTelemetry } from '../../hooks/useTelemetry';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';

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

// Dispatcher sees only Schedules + PIREPs; admin sees all
const dispatcherAdminItems: NavItem[] = [
  { to: '/admin/schedules', label: 'Schedules', icon: CalendarDays },
  { to: '/admin/pireps', label: 'PIREPs', icon: ClipboardCheck },
];

const adminOnlyItems: NavItem[] = [
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/finances', label: 'Finances', icon: DollarSign },
  { to: '/admin/reports', label: 'Admin Reports', icon: BarChart3 },
  { to: '/admin/settings', label: 'VA Settings', icon: Settings },
  { to: '/admin/audit', label: 'Audit Log', icon: ScrollText },
];

function ConnectionDot({ collapsed }: { collapsed: boolean }) {
  const { connected, flight } = useTelemetry();

  let color = 'bg-red-500';
  let textColor = 'text-red-400/70';
  let label = 'Disconnected';

  if (connected && flight) {
    color = 'bg-emerald-500';
    textColor = 'text-emerald-400/70';
    label = 'SimConnect Live';
  } else if (connected) {
    color = 'bg-amber-500';
    textColor = 'text-amber-400/70';
    label = 'Sim Connected';
  }

  return (
    <span className={`flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
      <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${color}`} />
      {!collapsed && (
        <span className={`text-[10px] truncate ${textColor}`}>{label}</span>
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
        className={`group flex items-center rounded-md ${
          collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'
        } ${
          isActive
            ? `${activeBg} ${activeText} ${collapsed ? '' : `border-l-[3px] ${activeBorder} pl-[9px]`}`
            : `text-acars-muted ${hoverText} ${hoverBg} ${collapsed ? '' : 'border-l-[3px] border-transparent pl-[9px]'}`
        }`}
      >
        <Icon
          className={`w-[18px] h-[18px] shrink-0 ${
            isActive ? activeText : `text-acars-muted ${hoverIcon}`
          }`}
        />
        {!collapsed && <span className="text-sm truncate">{item.label}</span>}
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
      <div className={`flex items-center h-12 border-b border-acars-border shrink-0 ${
        collapsed ? 'justify-center px-2' : 'px-4 gap-3'
      }`}>
        <img src="/logos/chevron-light.png" alt="SMA" className="h-7 w-auto shrink-0" />
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-acars-text truncate">SMA ACARS</span>
            <span className="text-[10px] text-acars-muted uppercase tracking-wider">Flight Ops</span>
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

            return (
              <NavItemLink
                key={item.to}
                item={item}
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
      <div className={`border-t border-acars-border py-3 space-y-2.5 shrink-0 ${
        collapsed ? 'px-2' : 'px-3'
      }`}>
        <ConnectionDot collapsed={collapsed} />

        {/* Notifications indicator */}
        {unreadCount > 0 && (
          <NavLink
            to="/settings"
            title={collapsed ? `${unreadCount} notifications` : undefined}
            className={`flex items-center gap-2 text-acars-muted hover:text-acars-text transition-colors ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <div className="relative">
              <Bell className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[12px] h-3 rounded-full bg-red-500 text-[7px] font-bold text-white px-0.5">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            </div>
            {!collapsed && (
              <span className="text-[11px]">{unreadCount} new</span>
            )}
          </NavLink>
        )}

        {/* User Info */}
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 text-xs font-semibold shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs text-acars-text truncate">{displayName}</span>
              <span className="inline-flex items-center gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">{roleBadge}</span>
              </span>
            </div>
          )}
        </div>

        {/* Logout + Collapse toggle */}
        <div className={`flex items-center ${collapsed ? 'flex-col gap-1' : 'justify-between'}`}>
          {!collapsed && (
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-[11px] text-acars-muted hover:text-red-400 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          )}
          <button
            onClick={toggleNav}
            className="flex items-center justify-center w-7 h-7 rounded-md text-acars-muted hover:text-acars-text hover:bg-acars-hover transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
          {collapsed && (
            <button
              onClick={logout}
              className="flex items-center justify-center w-7 h-7 rounded-md text-acars-muted hover:text-red-400 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
