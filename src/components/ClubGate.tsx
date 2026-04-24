import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';

/**
 * Gates protected app routes behind club membership.
 * Logged-in users without a club are redirected to the club request flow,
 * EXCEPT for the request page itself, club settings, and platform-owner admin routes.
 */
export function ClubGate({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { club, loading: clubLoading, isPlatformOwner } = useClub();
  const location = useLocation();

  // Wait for both auth and club state
  if (authLoading || clubLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="loading-spinner-ring" />
      </div>
    );
  }

  if (!user) return <>{children}</>; // ProtectedRoute handles non-auth case

  // Routes accessible without a club
  const allowedWithoutClub = ['/club/request', '/club/settings', '/admin/clubs', '/profile'];
  const onAllowedRoute = allowedWithoutClub.some(p => location.pathname.startsWith(p));

  // Platform owner (Alex) can access everything regardless of club state
  if (!club && !isPlatformOwner && !onAllowedRoute) {
    return <Navigate to="/club/request" replace />;
  }

  return <>{children}</>;
}
