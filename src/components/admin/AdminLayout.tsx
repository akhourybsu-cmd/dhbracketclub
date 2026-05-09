import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

interface AdminLayoutProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  children: React.ReactNode;
}

/**
 * Shared shell for Admin Portal pages. Mobile-first: sticky header with a
 * gold shield mark, back link, and a constrained content column.
 */
export function AdminLayout({ title, subtitle, backTo = '/admin', children }: AdminLayoutProps) {
  const location = useLocation();
  const showBack = location.pathname !== '/admin';
  return (
    <div className="min-h-screen bg-background">
      <header
        className="sticky top-0 z-30 backdrop-blur-xl border-b border-border/40"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          background: 'linear-gradient(180deg, hsl(var(--background) / 0.95), hsl(var(--background) / 0.85))',
        }}
      >
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          {showBack ? (
            <Link
              to={backTo}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-muted/40 hover:bg-muted/60 btn-press"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
          ) : (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--gold) / 0.22), hsl(var(--gold) / 0.06))',
                border: '1px solid hsl(var(--gold) / 0.3)',
              }}
            >
              <Shield className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: 'hsl(var(--gold))' }}>
              Admin Portal
            </p>
            <h1 className="text-[15px] font-extrabold leading-tight truncate">{title}</h1>
          </div>
        </div>
        {subtitle && (
          <p className="max-w-md mx-auto px-4 pb-3 text-[11px] text-muted-foreground/80 leading-snug">{subtitle}</p>
        )}
      </header>
      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="max-w-md mx-auto px-4 py-5"
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        {children}
      </motion.main>
    </div>
  );
}
