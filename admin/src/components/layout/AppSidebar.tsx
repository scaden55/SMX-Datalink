import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  SquaresFour,
  Broadcast,
  CalendarDots,
  ClipboardText,
  Users,
  Wrench,
  CurrencyDollar,
  ChartBar,
  Bell,
  ClockCounterClockwise,
  GearSix,
  AirplaneTilt,
} from '@phosphor-icons/react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';

// ── Navigation Groups ────────────────────────────────────────

const navGroups = [
  {
    label: 'Operations',
    items: [
      { title: 'Dashboard', path: '/', icon: SquaresFour },
      { title: 'Dispatch Board', path: '/dispatch', icon: Broadcast },
    ],
  },
  {
    label: 'Management',
    items: [
      { title: 'Schedules', path: '/schedules', icon: CalendarDots },
      { title: 'PIREPs', path: '/pireps', icon: ClipboardText },
      { title: 'Users', path: '/users', icon: Users },
      { title: 'Notifications', path: '/notifications', icon: Bell },
    ],
  },
  {
    label: 'Fleet & Finance',
    items: [
      { title: 'Maintenance', path: '/maintenance', icon: Wrench },
      { title: 'Finances', path: '/finances', icon: CurrencyDollar },
      { title: 'Reports', path: '/reports', icon: ChartBar },
    ],
  },
  {
    label: 'System',
    items: [
      { title: 'Audit Log', path: '/audit', icon: ClockCounterClockwise },
      { title: 'Settings', path: '/settings', icon: GearSix },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function roleBadgeStyle(role: string): { bg: string; text: string } {
  switch (role) {
    case 'admin':
      return { bg: 'var(--accent-red-bg)', text: 'var(--accent-red)' };
    case 'dispatcher':
      return { bg: 'var(--accent-blue-bg)', text: 'var(--accent-blue)' };
    default:
      return { bg: 'var(--accent-emerald-bg)', text: 'var(--accent-emerald)' };
  }
}

// ── Component ───────────────────────────────────────────────

export function AppSidebar() {
  const user = useAuthStore((s) => s.user);
  const [pendingPireps, setPendingPireps] = useState(0);
  const [activeFlights, setActiveFlights] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // Fetch both active flights + pending PIREPs from dashboard endpoint
    api
      .get<{ activeFlights: number; pendingPireps: number }>('/api/admin/dashboard')
      .then((res) => {
        if (!cancelled) {
          setActiveFlights(res.activeFlights);
          setPendingPireps(res.pendingPireps);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const badge = user ? roleBadgeStyle(user.role) : null;

  return (
    <Sidebar
      collapsible="icon"
      variant="sidebar"
      className="bg-[var(--surface-0)] border-r border-r-[var(--border-primary)]"
    >
      {/* Header / Logo */}
      <SidebarHeader className="border-b border-[var(--border-primary)]">
        <div className="flex items-center gap-2 px-1 py-1">
          <img
            src="/admin/logos/chevron-light.png"
            alt="SMA"
            className="h-8 w-8 shrink-0 object-contain"
          />
          <span className="truncate font-semibold text-sm tracking-tight text-[var(--text-primary)] group-data-[collapsible=icon]:hidden">
            SMA ACARS
          </span>
        </div>
      </SidebarHeader>

      {/* Operations Pulse */}
      <div className="px-3 pt-3 pb-1 group-data-[collapsible=icon]:hidden">
        <div
          className="rounded-md border p-2.5 flex items-center gap-4"
          style={{
            backgroundColor: 'var(--surface-2)',
            borderColor: 'var(--border-primary)',
          }}
        >
          <div className="flex items-center gap-1.5">
            <AirplaneTilt size={13} weight="duotone" style={{ color: 'var(--accent-emerald)' }} />
            <span className="text-[11px] font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
              {activeFlights}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              flying
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <ClipboardText size={13} weight="duotone" style={{ color: 'var(--accent-amber)' }} />
            <span className="text-[11px] font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
              {pendingPireps}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              pending
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            <SidebarGroupLabel className="text-[var(--text-quaternary)]">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.path}
                        end={item.path === '/'}
                        className={({ isActive }) =>
                          isActive
                            ? '[&]:bg-[var(--surface-3)] [&]:text-[var(--text-primary)] [&]:font-medium [&]:border-l-2 [&]:border-l-[var(--accent-blue)]'
                            : 'text-[var(--text-secondary)]'
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <item.icon
                              size={18}
                              weight={isActive ? 'fill' : 'regular'}
                            />
                            <span className="flex-1">{item.title}</span>
                            {item.title === 'PIREPs' && pendingPireps > 0 && (
                              <span
                                className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 text-[10px] font-semibold group-data-[collapsible=icon]:hidden"
                                style={{
                                  backgroundColor: 'var(--accent-amber-bg)',
                                  color: 'var(--accent-amber)',
                                }}
                              >
                                {pendingPireps}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Footer -- Current user */}
      <SidebarFooter className="border-t border-[var(--border-primary)]">
        {user && (
          <div className="flex items-center gap-2 px-1 py-1">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback
                className="text-xs font-medium"
                style={{
                  backgroundColor: 'var(--accent-blue-bg)',
                  color: 'var(--accent-blue)',
                }}
              >
                {getInitials(user.firstName, user.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                {user.firstName} {user.lastName}
              </span>
              {badge && (
                <span
                  className="inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                  style={{
                    backgroundColor: badge.bg,
                    color: badge.text,
                  }}
                >
                  {user.role}
                </span>
              )}
            </div>
          </div>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
