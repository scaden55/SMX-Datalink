import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Search, Bell, Settings } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function TopBar() {
  const user = useAuthStore((s) => s.user);

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
      className="flex items-center justify-between shrink-0"
      style={{
        padding: '12px 24px',
        borderBottom: '1px solid var(--border-primary)',
      }}
    >
      {/* Search */}
      <motion.button
        onClick={handleSearchClick}
        className="flex items-center border cursor-pointer input-glow"
        style={{
          width: 280,
          height: 31,
          borderRadius: 2,
          backgroundColor: 'var(--input-bg)',
          borderColor: 'var(--input-border)',
          padding: '0 18px',
          gap: 10,
        }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        transition={{ duration: 0.15 }}
      >
        <Search size={18} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        <span style={{ color: 'var(--text-tertiary)', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>
          Search...
        </span>
      </motion.button>

      {/* Right side */}
      <div className="flex items-center" style={{ gap: 16 }}>
        <motion.div
          whileHover={{ scale: 1.15, rotate: 12 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        >
          <Bell
            size={20}
            className="cursor-pointer icon-hover"
            style={{ color: 'var(--text-secondary)' }}
          />
        </motion.div>
        <motion.div
          whileHover={{ scale: 1.15, rotate: 30 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        >
          <Settings
            size={20}
            className="cursor-pointer icon-hover"
            style={{ color: 'var(--text-secondary)' }}
          />
        </motion.div>
        {user && (
          <motion.div
            className="flex items-center cursor-pointer"
            style={{ gap: 10 }}
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.15 }}
          >
            <motion.div
              className="flex items-center justify-center shrink-0"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: 'var(--accent-blue)',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
              }}
              whileHover={{
                boxShadow: '0 0 0 3px rgba(57, 80, 237, 0.3)',
              }}
            >
              {getInitials(user.firstName, user.lastName)}
            </motion.div>
            <span
              style={{
                color: 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {user.firstName} {user.lastName}
            </span>
          </motion.div>
        )}
      </div>
    </header>
  );
}
