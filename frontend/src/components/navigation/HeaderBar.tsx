import { X } from '@phosphor-icons/react';
import { useAuthStore } from '../../stores/authStore';
import { useAdminStore } from '../../stores/adminStore';

/**
 * HeaderBar is now minimal — only renders the impersonation banner when active.
 * Navigation, clock, user menu, and notifications have been migrated to
 * NavSidebar and StatusBar.
 */
export function HeaderBar() {
  const user = useAuthStore((s) => s.user);
  const impersonating = useAdminStore((s) => s.impersonating);
  const stopImpersonation = useAdminStore((s) => s.stopImpersonation);

  const displayName = user ? `${user.firstName} ${user.lastName}` : 'Unknown';
  const callsign = user?.callsign ?? '';

  if (!impersonating) return null;

  return (
    <div className="relative z-[1001] flex items-center justify-center gap-3 h-8 bg-amber-500/20 border-b border-amber-400/30 text-amber-400 text-xs">
      <span className="font-medium">Viewing as {callsign || displayName}</span>
      <button
        onClick={stopImpersonation}
        className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-[10px] font-medium transition-colors"
      >
        <X className="w-3 h-3" />
        Stop
      </button>
    </div>
  );
}
