import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuthStore } from '@/stores/authStore';
import { Surface } from '@/components/primitives';
import { ApiError } from '@/lib/api';

export function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isHydrating, login, user } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated with a non-pilot role
  useEffect(() => {
    if (!isHydrating && isAuthenticated && user?.role !== 'pilot') {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, isHydrating, user, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  }

  // Don't render while hydrating
  if (isHydrating) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--surface-0)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-blue)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--surface-0)] px-4 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-sm relative"
      >
        <Surface elevation={2} padding="spacious" style={{ boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5), 0 0 80px rgba(255, 255, 255, 0.03)' }}>
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img
              src="/admin/logos/smx-login-logo.png"
              alt="Special Missions Air"
              className="h-24 object-contain"
            />
          </div>

          {/* Title / Subtitle */}
          <div className="text-center mb-6">
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">
              Admin Portal
            </h1>
            <p className="mt-1.5 text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-[0.15em]">
              Operations Management System
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="admin@smavirtual.com"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full rounded-md bg-[var(--surface-3)] border border-[var(--border-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] focus:border-transparent transition-colors disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full rounded-md bg-[var(--surface-3)] border border-[var(--border-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] focus:border-transparent transition-colors disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="rounded-md border border-[var(--accent-red)]/30 bg-[var(--accent-red-bg)] px-3 py-2 text-sm text-[var(--accent-red)]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-[var(--accent-blue)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue-ring)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </Surface>
      </motion.div>
    </div>
  );
}
