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
    ],
  },
  {
    label: 'Fleet',
    items: [
      { title: 'Maintenance', path: '/maintenance', icon: Wrench },
    ],
  },
  {
    label: 'Finance',
    items: [
      { title: 'Finances', path: '/finances', icon: CurrencyDollar },
      { title: 'Reports', path: '/reports', icon: ChartBar },
    ],
  },
  {
    label: 'System',
    items: [
      { title: 'Notifications', path: '/notifications', icon: Bell },
      { title: 'Audit Log', path: '/audit', icon: ClockCounterClockwise },
      { title: 'Settings', path: '/settings', icon: GearSix },
    ],
  },
];

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function roleBadgeClass(role: string): string {
  switch (role) {
    case 'admin':
      return 'bg-red-500/20 text-red-400';
    case 'dispatcher':
      return 'bg-blue-500/20 text-blue-400';
    default:
      return 'bg-gray-500/20 text-gray-400';
  }
}

export function AppSidebar() {
  const user = useAuthStore((s) => s.user);

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      {/* Header / Logo */}
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-1 py-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
            S
          </div>
          <span className="truncate font-semibold text-sm tracking-tight group-data-[collapsible=icon]:hidden">
            SMA ACARS
          </span>
        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.path}
                        end={item.path === '/'}
                        className={({ isActive }) =>
                          isActive ? '[&]:bg-sidebar-accent [&]:text-sidebar-accent-foreground [&]:font-medium' : ''
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <item.icon
                              size={18}
                              weight={isActive ? 'fill' : 'regular'}
                            />
                            <span>{item.title}</span>
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

      {/* Footer — Current user */}
      <SidebarFooter className="border-t border-sidebar-border">
        {user && (
          <div className="flex items-center gap-2 px-1 py-1">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-medium">
                {getInitials(user.firstName, user.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm font-medium">
                {user.firstName} {user.lastName}
              </span>
              <span
                className={`inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${roleBadgeClass(user.role)}`}
              >
                {user.role}
              </span>
            </div>
          </div>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
