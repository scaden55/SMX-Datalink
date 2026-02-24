import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import type { UserRole } from '@acars/shared';

const ROLE_LEVEL: Record<UserRole, number> = {
  pilot: 1,
  dispatcher: 2,
  admin: 3,
};

interface AuthGuardProps {
  minRole?: UserRole;
}

export function AuthGuard({ minRole }: AuthGuardProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrate = useAuthStore((s) => s.hydrate);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    hydrate().finally(() => setChecked(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Still validating persisted tokens
  if (!checked || isHydrating) {
    return (
      <div className="flex items-center justify-center h-screen bg-acars-bg">
        <div className="flex flex-col items-center gap-3">
          <img src="./logos/chevron-light.png" alt="Loading" className="h-12 w-auto animate-pulse" />
          <p className="text-xs text-acars-muted">Loading...</p>
        </div>
      </div>
    );
  }

  // No valid session
  if (!isAuthenticated || !accessToken) {
    return <Navigate to="/login" replace />;
  }

  // Role-based guard
  if (minRole && user) {
    const userLevel = ROLE_LEVEL[user.role] ?? 0;
    const requiredLevel = ROLE_LEVEL[minRole];
    if (userLevel < requiredLevel) {
      return (
        <div className="flex items-center justify-center h-screen bg-acars-bg">
          <div className="panel p-6 max-w-sm text-center">
            <p className="text-sm text-red-400 font-medium mb-2">Access Denied</p>
            <p className="text-xs text-acars-muted">
              You need <span className="capitalize">{minRole}</span> privileges to view this page.
            </p>
          </div>
        </div>
      );
    }
  }

  return <Outlet />;
}
