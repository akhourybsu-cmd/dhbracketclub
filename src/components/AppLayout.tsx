import { ReactNode } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, Trophy, BarChart3, MessageCircle, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import dhMonogram from '@/assets/dh-monogram.png';

const navItems = [
  { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { path: '/brackets', label: 'Brackets', icon: Trophy },
  { path: '/rankings', label: 'Rankings', icon: BarChart3 },
  { path: '/polls', label: 'Polls', icon: MessageCircle },
  { path: '/profile', label: 'Profile', icon: User },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();

  // Match active nav — /pools/* should highlight Brackets
  const isNavActive = (path: string) => {
    if (path === '/brackets') {
      return location.pathname.startsWith('/brackets') || location.pathname.startsWith('/pools');
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main Content */}
      <main className="flex-1 pb-[4.5rem] lg:pb-0 lg:pl-64">
        <div className="max-w-[640px] mx-auto px-4 sm:px-5 py-5 sm:py-6 lg:py-8">
          {children}
        </div>
      </main>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 flex-col z-40" style={{
        background: 'linear-gradient(180deg, hsl(225 28% 6%), hsl(225 28% 4%))',
        borderRight: '1px solid hsl(var(--border) / 0.3)',
      }}>
        <div className="px-6 pt-7 pb-10">
          <div className="flex items-center gap-3 mb-1.5">
            <img src={dhMonogram} alt="DH" className="w-12 h-12 object-contain drop-shadow-lg" style={{ filter: 'drop-shadow(0 0 10px hsl(var(--primary) / 0.25))' }} />
            <div>
              <h1 className="text-base font-extrabold tracking-tight leading-none">
                <span className="gradient-text">DH</span>
                <span className="text-foreground"> Club</span>
              </h1>
              <p className="text-[8px] text-muted-foreground/50 font-bold uppercase tracking-[0.2em] mt-0.5">Compete With Your Crew</p>
            </div>
          </div>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn("nav-item", active ? "nav-item-active" : "nav-item-inactive")}
              >
                <Icon className="w-[18px] h-[18px]" />
                {item.label}
              </Link>
            );
          })}
          {/* Drafts as secondary sidebar item */}
          <div className="h-px bg-border/10 my-2" />
          <Link
            to="/drafts"
            className={cn("nav-item", location.pathname.startsWith('/drafts') ? "nav-item-active" : "nav-item-inactive")}
          >
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 3H8a2 2 0 0 0-2 2v14l6-3 6 3V5a2 2 0 0 0-2-2Z" />
            </svg>
            Drafts
          </Link>
        </nav>
        <div className="mt-auto px-6 pb-6">
          <div className="h-px bg-border/20 mb-4" />
          <p className="text-[9px] text-muted-foreground/40 font-semibold tracking-wide">DH Club — For fun, not funds.</p>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-inset-bottom" style={{
        background: 'linear-gradient(180deg, hsl(225 20% 7% / 0.95), hsl(225 28% 4% / 0.98))',
        backdropFilter: 'blur(24px) saturate(180%)',
        borderTop: '1px solid hsl(var(--border) / 0.12)',
      }}>
        <div className="flex items-center justify-around h-[4rem] px-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 px-2.5 rounded-xl min-w-[3.5rem] min-h-[2.75rem] btn-press relative",
                  "transition-colors duration-150",
                  active ? "text-primary" : "text-muted-foreground/50 active:text-foreground"
                )}
              >
                <Icon className={cn("w-[18px] h-[18px] transition-all duration-200", active && "scale-105")} />
                <span className={cn(
                  "text-[8px] font-bold tracking-wide transition-colors duration-150",
                  active ? "text-primary" : "text-muted-foreground/40"
                )}>{item.label}</span>
                {active && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -top-px left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full"
                    style={{ background: 'linear-gradient(90deg, hsl(var(--primary) / 0.7), hsl(var(--primary) / 0.2))' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
