import { useEffect, useState } from 'react';
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
  Calculator,
  TrendingUp,
  Users,
  Settings,
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
}

const navMain: NavItem[] = [
  { title: 'Overview', path: '/', icon: LayoutGrid },
  { title: 'Dispatch', path: '/dispatch', icon: Radio },
  { title: 'Fleet', path: '/fleet', icon: Plane },
];

const navOperations: NavItem[] = [
  { title: 'Schedules', path: '/schedules', icon: Calendar },
  { title: 'PIREPs', path: '/pireps', icon: ClipboardCheck, badge: 'pireps' },
  { title: 'Maintenance', path: '/maintenance', icon: Wrench },
];

const navAnalytics: NavItem[] = [
  { title: 'Reports', path: '/reports', icon: BarChart3 },
  { title: 'Finances', path: '/finances', icon: Wallet },
  { title: 'Cost Engine', path: '/cost-engine', icon: Calculator },
  { title: 'Revenue Model', path: '/revenue-model', icon: TrendingUp },
];

const navSystem: NavItem[] = [
  { title: 'Users', path: '/users', icon: Users },
  { title: 'Settings', path: '/settings', icon: Settings },
];

// ── Component ───────────────────────────────────────────

export function AppSidebar() {
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
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside
      className="flex flex-col shrink-0 h-full overflow-y-auto"
      style={{
        width: 220,
        background: 'linear-gradient(to top, #000000, #1B1B1C)',
        paddingTop: 24,
      }}
    >
      {/* Logo */}
      <motion.div
        className="flex justify-center"
        style={{ padding: '0 20px 20px 20px' }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.img
          src="/admin/logos/block-light.png"
          alt="Special Missions Air"
          className="object-contain"
          style={{ height: 40 }}
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.2 }}
        />
      </motion.div>

      {/* Nav Main — no group label */}
      <NavGroup items={navMain} pendingPireps={0} startIndex={0} />

      {/* Operations */}
      <GroupLabel style={{ padding: '20px 20px 6px 20px' }}>OPERATIONS</GroupLabel>
      <NavGroup items={navOperations} pendingPireps={pendingPireps} startIndex={3} />

      {/* Analytics */}
      <GroupLabel style={{ padding: '20px 20px 6px 20px' }}>ANALYTICS</GroupLabel>
      <NavGroup items={navAnalytics} pendingPireps={0} startIndex={6} />

      {/* Spacer pushes System to bottom */}
      <div className="flex-1" />

      {/* System */}
      <GroupLabel style={{ padding: '0 20px 6px 20px' }}>SYSTEM</GroupLabel>
      <NavGroup items={navSystem} pendingPireps={0} startIndex={8} />

      {/* Log Out */}
      <div className="flex flex-col" style={{ gap: 2, paddingBottom: 24 }}>
        <button
          onClick={handleLogout}
          className="flex items-center w-full border-none bg-transparent cursor-pointer nav-logout-hover"
          style={{
            gap: 12,
            padding: '10px 20px',
            color: 'var(--text-secondary)',
            fontSize: 14,
            fontFamily: 'var(--font-sans)',
            borderLeft: '3px solid transparent',
          }}
        >
          <LogOut size={18} />
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  );
}

// ── Helpers ──────────────────────────────────────────────

function GroupLabel({ children, style }: { children: string; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <span
        style={{
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-sans)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 1,
        }}
      >
        {children}
      </span>
    </div>
  );
}

function NavGroup({
  items,
  pendingPireps,
  startIndex,
}: {
  items: NavItem[];
  pendingPireps: number;
  startIndex: number;
}) {
  return (
    <div className="flex flex-col" style={{ gap: 2 }}>
      {items.map((item, i) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) =>
            `flex items-center no-underline ${!isActive ? 'nav-item-hover' : ''}`
          }
          style={({ isActive }) => ({
            gap: 12,
            padding: '10px 20px',
            backgroundColor: isActive ? 'var(--accent-blue-dim)' : 'transparent',
            borderLeft: isActive
              ? '3px solid var(--accent-blue)'
              : '3px solid transparent',
            color: isActive ? 'var(--accent-blue-bright)' : 'var(--text-secondary)',
            fontWeight: isActive ? 500 : 'normal',
            fontSize: 14,
            fontFamily: 'var(--font-sans)',
            textDecoration: 'none',
          })}
        >
          {({ isActive }) => (
            <motion.div
              className="flex items-center w-full"
              style={{ gap: 12 }}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: (startIndex + i) * 0.03, ease: [0.16, 1, 0.3, 1] }}
            >
              <item.icon size={18} />
              <span className="flex-1">{item.title}</span>
              {item.badge === 'pireps' && pendingPireps > 0 && (
                <AnimatePresence>
                  <motion.span
                    className="flex items-center justify-center"
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: 'var(--accent-blue)',
                      color: '#ffffff',
                      fontSize: 10,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  >
                    {pendingPireps}
                  </motion.span>
                </AnimatePresence>
              )}
            </motion.div>
          )}
        </NavLink>
      ))}
    </div>
  );
}
