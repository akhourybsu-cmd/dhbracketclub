import { Navigate } from 'react-router-dom';
import { useClub } from '@/contexts/ClubContext';

/**
 * Gate for per-club settings pages. Allows:
 *   - Members of the club whose role is 'admin'
 *   - Global app admins (Alex K., bypasses ownership)
 * Anyone else gets redirected to /dashboard.
 *
 * Note: in the current single-group model, isClubAdmin already ORs with
 * isAppAdmin, so this is intentionally simple.
 */
export function ClubAdminRoute({ children }: { children: React.ReactNode }) {
  const { isClubAdmin, isAppAdmin, loading, club } = useClub();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner-ring" />
      </div>
    );
  }
  if (!club) return <Navigate to="/dashboard" replace />;
  if (!isClubAdmin && !isAppAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
