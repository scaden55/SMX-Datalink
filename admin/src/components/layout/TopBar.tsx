import { useMemo } from 'react';
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

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function TopBar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

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
    <header className="flex h-14 shrink-0 items-center border-b border-border px-4">
      {/* Left: mobile sidebar trigger */}
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-3 h-5" />

      {/* Search shortcut hint */}
      <button
        onClick={handleSearchClick}
        className="flex items-center gap-1.5 rounded-md border border-border/50 bg-[#1c2033] px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground hover:border-border"
      >
        <MagnifyingGlass size={14} />
        <span className="hidden sm:inline">Search</span>
        <kbd className="ml-1 rounded border border-border/50 bg-background/50 px-1.5 py-0.5 text-[10px] font-mono leading-none">
          {isMac ? '\u2318K' : 'Ctrl+K'}
        </kbd>
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right: User dropdown */}
      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent transition-colors">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-medium">
                  {getInitials(user.firstName, user.lastName)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium md:inline-block">
                {user.firstName} {user.lastName}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
                <p className="text-xs text-muted-foreground capitalize">
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
