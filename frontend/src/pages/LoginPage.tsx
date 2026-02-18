import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Radio } from 'lucide-react';
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
    <div className="flex items-center justify-center min-h-screen bg-acars-bg px-4">
      <div className="panel max-w-sm w-full p-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-acars-blue/20">
            <Radio className="w-6 h-6 text-acars-blue" />
          </div>
          <h1 className="text-lg font-semibold text-acars-text">SMA ACARS</h1>
          <p className="text-xs text-acars-muted uppercase tracking-wider">Flight Operations</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              className="w-full rounded-md bg-acars-bg border border-acars-border text-acars-text text-sm px-3 py-2 placeholder:text-acars-muted/50 focus:outline-none focus:border-acars-blue focus:ring-1 focus:ring-acars-blue/30"
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
              className="w-full rounded-md bg-acars-bg border border-acars-border text-acars-text text-sm px-3 py-2 placeholder:text-acars-muted/50 focus:outline-none focus:border-acars-blue focus:ring-1 focus:ring-acars-blue/30"
              placeholder="Enter password"
            />
          </div>

          {error && (
            <p className="text-acars-red text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-acars-blue text-white text-sm font-medium py-2 hover:bg-acars-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-acars-muted mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-acars-blue hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
