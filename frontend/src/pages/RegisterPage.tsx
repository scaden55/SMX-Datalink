import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ApiError } from '../lib/api';

export function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await register(email, password, firstName, lastName);
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
        <div className="flex flex-col items-center gap-3 mb-8">
          <img src="./logos/smx-login-logo.png" alt="Special Missions Air" className="h-20 w-auto" />
          <p className="text-xs text-acars-muted uppercase tracking-wider">Create Account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="firstName" className="block text-xs font-medium text-acars-muted mb-1.5">
                First Name
              </label>
              <input
                id="firstName"
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-md bg-acars-bg border border-acars-border text-acars-text text-sm px-3 py-2 placeholder:text-acars-muted/50 focus:outline-none focus:border-acars-blue focus:ring-1 focus:ring-acars-blue/30"
                placeholder="John"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-xs font-medium text-acars-muted mb-1.5">
                Last Name
              </label>
              <input
                id="lastName"
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-md bg-acars-bg border border-acars-border text-acars-text text-sm px-3 py-2 placeholder:text-acars-muted/50 focus:outline-none focus:border-acars-blue focus:ring-1 focus:ring-acars-blue/30"
                placeholder="Doe"
              />
            </div>
          </div>

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
              placeholder="Create password"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-xs font-medium text-acars-muted mb-1.5">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-md bg-acars-bg border border-acars-border text-acars-text text-sm px-3 py-2 placeholder:text-acars-muted/50 focus:outline-none focus:border-acars-blue focus:ring-1 focus:ring-acars-blue/30"
              placeholder="Confirm password"
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
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-xs text-acars-muted mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-acars-blue hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
