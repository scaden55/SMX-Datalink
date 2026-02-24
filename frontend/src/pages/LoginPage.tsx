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
    <div className="relative flex items-center justify-center min-h-screen bg-acars-bg px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(88,166,255,0.04)_0%,transparent_70%)]" />
      <div className="panel max-w-sm w-full p-8 shadow-2xl shadow-blue-400/5 relative">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <img src="./logos/smx-login-logo.png" alt="Special Missions Air" className="h-20 w-auto" />
          <p className="text-xs text-acars-muted uppercase tracking-wider">Flight Operations</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-acars-muted mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="pilot@smavirtual.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-acars-muted mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="Enter password"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary btn-md w-full"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-acars-muted mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-blue-400 hover:underline">
            Register
          </Link>
        </p>
      </div>
      <p className="absolute bottom-4 left-0 right-0 text-center text-[10px] text-acars-muted/30">SMA ACARS v1.0</p>
    </div>
  );
}
