import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ApiError } from '../lib/api';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to connect to server');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-acars-bg px-4 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(77,156,246,0.06)_0%,transparent_60%)]" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-blue-500/[0.02] blur-3xl" />

      <div className="panel max-w-[380px] w-full p-8 relative" style={{ boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4), 0 0 80px rgba(77, 156, 246, 0.06)' }}>
        {/* Logo */}
        <div className="flex flex-col items-center gap-2.5 mb-8">
          <img src="./logos/smx-login-logo.png" alt="Special Missions Air" className="h-20 w-auto" />
          <p className="text-[10px] text-acars-muted/60 uppercase tracking-[0.15em] font-medium">Flight Operations</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-[10px] font-medium text-acars-muted/70 uppercase tracking-wider mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field py-2"
              placeholder="pilot@smavirtual.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-[10px] font-medium text-acars-muted/70 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field py-2"
              placeholder="Enter password"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-500/10 border border-red-400/20">
              <span className="text-red-400 text-[11px]">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary btn-md w-full mt-1"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in...
              </span>
            ) : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-[11px] text-acars-muted/50 mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-blue-400/80 hover:text-blue-400 hover:underline transition-colors">
            Register
          </Link>
        </p>
      </div>
      <p className="absolute bottom-4 left-0 right-0 text-center text-[9px] text-acars-muted/20 tracking-wider">SMX ACARS v{__APP_VERSION__}</p>
    </div>
  );
}
