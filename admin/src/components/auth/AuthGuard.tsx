import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isHydrating, user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isHydrating && !isAuthenticated) {
      navigate('/login', { replace: true });
    }
    if (!isHydrating && isAuthenticated && user?.role === 'pilot') {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, isHydrating, user, navigate]);

  if (isHydrating) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}
