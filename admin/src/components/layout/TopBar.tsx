import { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutGrid,
  Radio,
  Plane,
  Calendar,
  ClipboardCheck,
  Wrench,
  BarChart3,
  Wallet,
  TrendingUp,
  Users,
  Settings,
  Search,
  Bell,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';

// ── Nav definitions ─────────────────────────────────────

interface NavItem {
  title: string;
  path: string;
  icon: LucideIcon;
  badge?: 'pireps';
  group: 'ops' | 'mgmt' | 'config';
}

const navItems: NavItem[] = [
  { title: 'Overview', path: '/', icon: LayoutGrid, group: 'ops' },
  { title: 'Dispatch', path: '/dispatch', icon: Radio, group: 'ops' },
  { title: 'Fleet', path: '/fleet', icon: Plane, group: 'ops' },
  { title: 'Schedules', path: '/schedules', icon: Calendar, group: 'ops' },
  { title: 'PIREPs', path: '/pireps', icon: ClipboardCheck, badge: 'pireps', group: 'ops' },
  { title: 'Maintenance', path: '/maintenance', icon: Wrench, group: 'mgmt' },
  { title: 'Reports', path: '/reports', icon: BarChart3, group: 'mgmt' },
  { title: 'Finances', path: '/finances', icon: Wallet, group: 'mgmt' },
  { title: 'Revenue', path: '/revenue-model', icon: TrendingUp, group: 'mgmt' },
  { title: 'Users', path: '/users', icon: Users, group: 'config' },
  { title: 'Settings', path: '/settings', icon: Settings, group: 'config' },
];

// ── Helpers ─────────────────────────────────────────────

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// ── Component ───────────────────────────────────────────

export function TopBar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [pendingPireps, setPendingPireps] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ pendingPireps: number }>('/api/admin/dashboard')
      .then((res) => {
        if (!cancelled) setPendingPireps(res.pendingPireps);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const isMac = useMemo(
    () => typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent),
    [],
  );

  const handleSearchClick = () => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: !isMac, metaKey: isMac, bubbles: true }),
    );
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Group nav items and render with subtle separators
  const groups = ['ops', 'mgmt', 'config'] as const;

  return (
    <header
      className="flex items-center shrink-0"
      style={{
        padding: '0 16px',
        borderBottom: '1px solid var(--border-primary)',
        height: 48,
        background: 'var(--surface-0)',
      }}
    >
      {/* Logo */}
      <NavLink to="/" className="flex items-center no-underline shrink-0" style={{ gap: 10, marginRight: 20 }}>
        <img
          src="/admin/logos/chevron-light.png"
          alt=""
          style={{ width: 24, height: 24 }}
          className="object-contain"
        />
        <div className="flex flex-col">
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            letterSpacing: -0.3,
            lineHeight: 1.1,
          }}>
            Special Missions Air
          </span>
          <span style={{
            fontSize: 9,
            fontWeight: 600,
            color: 'var(--text-tertiary)',
            fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.1em',
            textTransform: 'uppercase' as const,
            lineHeight: 1.2,
          }}>
            Administration
          </span>
        </div>
        <div className="flex shrink-0" style={{ gap: 4, marginLeft: 4 }}>
          <span style={{
            background: 'var(--accent-blue-bg)',
            color: 'var(--accent-blue-bright)',
            fontSize: 8,
            padding: '2px 5px',
            borderRadius: 3,
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
          }}>
            FAA-121
          </span>
          <span style={{
            background: 'rgba(255,255,255,0.05)',
            color: 'var(--text-tertiary)',
            fontSize: 8,
            padding: '2px 5px',
            borderRadius: 3,
            fontFamily: 'var(--font-mono)',
          }}>
            CARGO
          </span>
          <span style={{
            background: 'rgba(255,255,255,0.05)',
            color: 'var(--text-tertiary)',
            fontSize: 8,
            padding: '2px 5px',
            borderRadius: 3,
            fontFamily: 'var(--font-mono)',
          }}>
            EST 2021
          </span>
        </div>
      </NavLink>

      {/* Navigation with group separators */}
      <nav
        className="flex items-center flex-1 overflow-x-auto h-full"
        style={{ gap: 0 }}
      >
        {groups.map((group, gi) => (
          <div key={group} className="flex items-center h-full">
            {gi > 0 && (
              <div
                className="w-px h-4 mx-1 shrink-0"
                style={{ background: 'var(--border-primary)' }}
              />
            )}
            {navItems
              .filter((item) => item.group === group)
              .map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `flex items-center no-underline shrink-0 h-full relative ${!isActive ? 'nav-item-hover' : ''}`
                  }
                  style={({ isActive }) => ({
                    gap: 4,
                    padding: '0 8px',
                    fontSize: 11,
                    fontWeight: isActive ? 600 : 400,
                    fontFamily: 'var(--font-sans)',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    textDecoration: 'none',
                    backgroundColor: isActive ? 'rgba(79,108,205,0.06)' : 'transparent',
                  })}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={13} strokeWidth={isActive ? 2 : 1.5} />
                      <span>{item.title}</span>
                      {item.badge === 'pireps' && pendingPireps > 0 && (
                        <AnimatePresence>
                          <motion.span
                            className="flex items-center justify-center font-mono"
                            style={{
                              minWidth: 14,
                              height: 14,
                              borderRadius: 3,
                              backgroundColor: 'var(--accent-red)',
                              color: '#ffffff',
                              fontSize: 8,
                              fontWeight: 700,
                              flexShrink: 0,
                              padding: '0 3px',
                            }}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                          >
                            {pendingPireps}
                          </motion.span>
                        </AnimatePresence>
                      )}
                      {/* Active indicator bar */}
                      {isActive && (
                        <motion.div
                          className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                          style={{ background: 'var(--accent-blue)' }}
                          layoutId="topbar-indicator"
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
          </div>
        ))}
      </nav>

      {/* Right side: search, user, logout */}
      <div className="flex items-center shrink-0" style={{ gap: 8 }}>
        <motion.button
          onClick={handleSearchClick}
          className="flex items-center border cursor-pointer input-glow"
          style={{
            width: 160,
            height: 24,
            borderRadius: 3,
            backgroundColor: 'var(--input-bg)',
            borderColor: 'var(--input-border)',
            padding: '0 8px',
            gap: 5,
          }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          transition={{ duration: 0.15 }}
        >
          <Search size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          <span style={{
            color: 'var(--text-tertiary)',
            fontSize: 10,
            fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.02em',
          }}>
            {isMac ? '⌘K' : 'Ctrl+K'}
          </span>
        </motion.button>

        <Bell
          size={15}
          className="cursor-pointer icon-hover"
          style={{ color: 'var(--text-tertiary)' }}
        />

        {user && (
          <div className="flex items-center" style={{ gap: 5 }}>
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: 22,
                height: 22,
                borderRadius: 3,
                backgroundColor: 'var(--accent-blue-dim)',
                color: 'var(--accent-blue)',
                fontSize: 8,
                fontWeight: 700,
                fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
              }}
            >
              {getInitials(user.firstName, user.lastName)}
            </div>
            <div className="flex flex-col">
              <span style={{
                color: 'var(--text-primary)',
                fontSize: 10,
                fontWeight: 500,
                fontFamily: 'var(--font-sans)',
                lineHeight: 1,
              }}>
                {user.firstName}
              </span>
              <span style={{
                color: 'var(--text-tertiary)',
                fontSize: 8,
                fontWeight: 600,
                fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
                textTransform: 'uppercase' as const,
                letterSpacing: '0.08em',
                lineHeight: 1.2,
              }}>
                {user.callsign}
              </span>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="flex items-center border-none bg-transparent cursor-pointer nav-logout-hover"
          style={{ color: 'var(--text-quaternary)', padding: 3 }}
          title="Log out"
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  );
}
