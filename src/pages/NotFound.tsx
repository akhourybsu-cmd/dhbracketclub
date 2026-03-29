import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from '@/contexts/AuthContext';
import dhMonogram from '@/assets/dh-monogram.png';

const NotFound = () => {
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <img src={dhMonogram} alt="DH" className="w-24 h-24 object-contain mx-auto mb-6 opacity-30" />
        <h1 className="mb-3 text-5xl font-extrabold tracking-tight text-foreground">404</h1>
        <p className="mb-6 text-sm text-muted-foreground font-medium">Page not found</p>
        <Link to={user ? '/dashboard' : '/'} className="text-primary hover:underline font-bold text-sm">
          {user ? 'Back to Dashboard' : 'Return to Home'}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
