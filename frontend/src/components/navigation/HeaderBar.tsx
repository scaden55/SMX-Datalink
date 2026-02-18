import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, Plane, User, LogOut } from 'lucide-react';
import { useTelemetry } from '../../hooks/useTelemetry';
import { useAuthStore } from '../../stores/authStore';

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

export function HeaderBar() {
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}` : '??';
  const displayName = user ? `${user.firstName} ${user.lastName}` : 'Unknown';
  const callsign = user?.callsign ?? '';

  const pageTitle = PAGE_TITLES[location.pathname] || 'ACARS';

  return (
    <header className="relative z-[1000] flex items-center justify-between h-12 px-4 border-b border-acars-border bg-acars-panel shrink-0">
      {/* Left: Page title */}
      <div className="flex items-center gap-4">
        <h1 className="text-sm font-semibold text-acars-text">{pageTitle}</h1>
        <ActiveFlightPill />
      </div>

      {/* Right: Clock, notifications, user */}
      <div className="flex items-center gap-4">
        <ZuluClock />

        {/* Notification bell */}
        <button className="relative text-acars-muted hover:text-acars-text transition-colors p-1">
          <Bell className="w-4 h-4" />
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-acars-red text-[8px] font-bold text-white">
            3
          </span>
        </button>

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
  );
}
