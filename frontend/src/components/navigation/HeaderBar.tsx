import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Plane, User, LogOut, X } from 'lucide-react';
import { useTelemetry } from '../../hooks/useTelemetry';
import { useAuthStore } from '../../stores/authStore';
import { useAdminStore } from '../../stores/adminStore';
import { NotificationDropdown } from './NotificationDropdown';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/map': 'Live Map',
  '/schedule': 'Schedule',
  '/planning': 'Flight Planning',
  '/dispatch': 'Dispatch',
  '/fleet': 'Fleet',
  '/logbook': 'Logbook',
  '/reports': 'Reports',
  '/settings': 'Settings',
  '/admin': 'Admin',
  '/admin/users': 'Users',
  '/admin/schedules': 'Schedules',
  '/admin/pireps': 'PIREPs',
  '/admin/finances': 'Finances',
  '/admin/reports': 'Admin Reports',
  '/admin/settings': 'VA Settings',
  '/admin/audit': 'Audit Log',
};

function ZuluClock() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const s = String(now.getUTCSeconds()).padStart(2, '0');
      setTime(`${h}:${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="font-mono text-xs text-acars-muted tabular-nums">
      {time}<span className="text-acars-blue ml-0.5">Z</span>
    </span>
  );
}

function ActiveFlightPill() {
  const { flight, aircraft, connected } = useTelemetry();
  const navigate = useNavigate();

  if (!connected || !flight) return null;

  const alt = aircraft?.position.altitude ?? 0;

  return (
    <button
      onClick={() => navigate('/dispatch')}
      className="flex items-center gap-2 rounded-full bg-acars-green/10 border border-acars-green/20 px-3 py-1 text-xs text-acars-green hover:bg-acars-green/20 transition-colors"
    >
      <Plane className="w-3.5 h-3.5" />
      <span className="font-medium">
        {flight.phase.replace('_', ' ')}
      </span>
      <span className="text-acars-green/70">|</span>
      <span className="font-mono tabular-nums">
        FL{Math.round(alt / 100).toString().padStart(3, '0')}
      </span>
    </button>
  );
}

interface BreadcrumbSegment {
  label: string;
  path: string | null; // null = current page (not clickable)
}

function buildBreadcrumbs(pathname: string): BreadcrumbSegment[] {
  // Root dashboard — single segment, no trail
  if (pathname === '/') {
    return [{ label: 'Dashboard', path: null }];
  }

  const segments = pathname.split('/').filter(Boolean);
  const crumbs: BreadcrumbSegment[] = [{ label: 'Dashboard', path: '/' }];

  // Special case: /planning/:bidId? — always a single "Flight Planning" page
  if (segments[0] === 'planning') {
    crumbs.push({ label: 'Flight Planning', path: null });
    return crumbs;
  }

  // Build crumbs from path segments
  let accumulated = '';
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    accumulated += `/${seg}`;
    const isLast = i === segments.length - 1;

    // Known top-level page
    const title = PAGE_TITLES[accumulated];
    if (title) {
      crumbs.push({ label: title, path: isLast ? null : accumulated });
    } else if (/^\d+$/.test(seg)) {
      // Numeric ID — contextual label based on parent
      const parent = segments[i - 1];
      const label = parent === 'logbook' ? 'Flight Detail' : 'Detail';
      crumbs.push({ label, path: null });
    } else {
      // Unknown segment — capitalize it
      crumbs.push({
        label: seg.charAt(0).toUpperCase() + seg.slice(1),
        path: isLast ? null : accumulated,
      });
    }
  }

  return crumbs;
}

export function HeaderBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const impersonating = useAdminStore((s) => s.impersonating);
  const stopImpersonation = useAdminStore((s) => s.stopImpersonation);

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}` : '??';
  const displayName = user ? `${user.firstName} ${user.lastName}` : 'Unknown';
  const callsign = user?.callsign ?? '';

  const breadcrumbs = buildBreadcrumbs(location.pathname);

  return (
    <>
      {/* Impersonation banner */}
      {impersonating && (
        <div className="relative z-[1001] flex items-center justify-center gap-3 h-8 bg-acars-amber/20 border-b border-acars-amber/30 text-acars-amber text-xs">
          <span className="font-medium">Viewing as {callsign || displayName}</span>
          <button
            onClick={stopImpersonation}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-acars-amber/20 hover:bg-acars-amber/30 text-acars-amber text-[10px] font-medium transition-colors"
          >
            <X className="w-3 h-3" />
            Stop
          </button>
        </div>
      )}
    <header className="relative z-[1000] flex items-center justify-between h-12 px-4 border-b border-acars-border bg-acars-panel shrink-0">
      {/* Left: Breadcrumb navigation */}
      <div className="flex items-center gap-4">
        <nav className="flex items-center gap-1.5 text-sm">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="w-3 h-3 text-acars-muted/50" />}
              {crumb.path !== null ? (
                <button
                  onClick={() => navigate(crumb.path!)}
                  className="text-acars-muted hover:text-acars-text cursor-pointer transition-colors"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="text-acars-text font-semibold">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
        <ActiveFlightPill />
      </div>

      {/* Right: Clock, notifications, user */}
      <div className="flex items-center gap-4">
        <ZuluClock />

        {/* Notification bell */}
        <NotificationDropdown />

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 text-acars-muted hover:text-acars-text transition-colors"
          >
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-acars-blue/20 text-acars-blue text-[10px] font-semibold">
              {initials}
            </div>
            <ChevronDown className={`w-3 h-3 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-[9999] w-48 rounded-md border border-acars-border bg-[#1c2433] shadow-xl py-1">
                <div className="px-3 py-2 border-b border-acars-border">
                  <p className="text-xs font-medium text-acars-text">{displayName}</p>
                  <p className="text-[10px] text-acars-muted">{callsign}</p>
                </div>
                <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-acars-muted hover:text-acars-text hover:bg-[#161b22] transition-colors">
                  <User className="w-3.5 h-3.5" />
                  Profile
                </button>
                <button
                  onClick={() => { setUserMenuOpen(false); logout(); }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-acars-muted hover:text-acars-text hover:bg-[#161b22] transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
    </>
  );
}
