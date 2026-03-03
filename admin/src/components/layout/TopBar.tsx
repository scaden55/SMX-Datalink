import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { SignOut, User, MagnifyingGlass } from '@phosphor-icons/react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/stores/authStore';
import { useSocketStore } from '@/stores/socketStore';

// ── Page Title Map ──────────────────────────────────────────

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/dispatch': 'Dispatch Board',
  '/users': 'Users',
  '/schedules': 'Schedules',
  '/pireps': 'PIREPs',
  '/maintenance': 'Maintenance',
  '/finances': 'Finances',
  '/reports': 'Reports',
  '/notifications': 'Notifications',
  '/audit': 'Audit Log',
  '/settings': 'Settings',
};

// ── Helpers ─────────────────────────────────────────────────

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// ── Component ───────────────────────────────────────────────

export function TopBar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const connected = useSocketStore((s) => s.connected);
  const connecting = useSocketStore((s) => s.connecting);
  const location = useLocation();

  const pageTitle = titles[location.pathname] ?? '';

  const isMac = useMemo(
    () => typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent),
    [],
  );

  const handleSearchClick = () => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: !isMac, metaKey: isMac, bubbles: true }),
    );
  };

  return (
    <header
      className="flex h-14 shrink-0 items-center px-4 border-b"
      style={{
        backgroundColor: 'var(--surface-1)',
        borderBottomColor: 'var(--border-primary)',
      }}
    >
      {/* Left: sidebar trigger + page title */}
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-3 h-5" />
      {pageTitle && (
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {pageTitle}
        </span>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search shortcut hint */}
      <button
        onClick={handleSearchClick}
        className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors"
        style={{
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--surface-2)',
          color: 'var(--text-tertiary)',
        }}
      >
        <MagnifyingGlass size={14} />
        <span className="hidden sm:inline">Search</span>
        <kbd
          className="ml-1 rounded border px-1.5 py-0.5 text-[10px] font-mono leading-none"
          style={{
            borderColor: 'var(--border-secondary)',
            backgroundColor: 'var(--surface-3)',
          }}
        >
          {isMac ? '\u2318K' : 'Ctrl+K'}
        </kbd>
      </button>

      {/* Connection status indicator */}
      {(connected || connecting) && (
        <div className="flex items-center gap-1.5 ml-4">
          <span
            className="h-2 w-2 rounded-full"
            style={{
              backgroundColor: connected ? 'var(--accent-emerald)' : 'var(--accent-amber)',
            }}
          />
          <span className="text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
            {connected ? 'Live' : 'Connecting'}
          </span>
        </div>
      )}

      {/* Right: User dropdown */}
      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md px-2 py-1.5 ml-4 text-sm outline-none transition-colors hover:bg-[var(--surface-3)]">
              <Avatar className="h-7 w-7">
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
              <span
                className="hidden text-sm font-medium md:inline-block"
                style={{ color: 'var(--text-primary)' }}
              >
                {user.firstName} {user.lastName}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {user.email}
                </p>
                <p className="text-xs capitalize" style={{ color: 'var(--text-tertiary)' }}>
                  {user.callsign} &middot; {user.role}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <User size={16} className="mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
              <SignOut size={16} className="mr-2" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
}
