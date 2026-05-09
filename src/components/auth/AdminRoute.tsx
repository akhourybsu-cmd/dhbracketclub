import { Navigate } from 'react-router-dom';
import { useClub } from '@/contexts/ClubContext';

/**
 * Gate for the global Admin Portal. Only users with user_roles.role='admin'
 * (or platform owner) can pass. Non-admins are bounced to the dashboard.
 */
export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAppAdmin, isPlatformOwner, loading } = useClub();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner-ring" />
      </div>
    );
  }
  if (!isAppAdmin && !isPlatformOwner) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
