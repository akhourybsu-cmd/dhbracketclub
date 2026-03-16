import { ReactNode } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, Trophy, Users, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const navItems = [
  { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { path: '/pools', label: 'Pools', icon: Users },
  { path: '/leaderboard', label: 'Ranks', icon: Trophy },
  { path: '/profile', label: 'Profile', icon: User },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();

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
        <div className="px-6 pt-8 pb-12">
          <h1 className="text-lg font-extrabold tracking-tight">
            <span className="gradient-text">Bracket</span>
            <span className="text-foreground"> Battle</span>
          </h1>
          <p className="text-[9px] text-muted-foreground mt-2 font-bold uppercase tracking-[0.2em]">March Madness Pools</p>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn("nav-item", isActive ? "nav-item-active" : "nav-item-inactive")}
              >
                <Icon className="w-[18px] h-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto px-6 pb-6">
          <div className="h-px bg-border/20 mb-4" />
          <p className="text-[9px] text-muted-foreground/40 font-semibold tracking-wide">For fun, not funds.</p>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-inset-bottom" style={{
        background: 'linear-gradient(180deg, hsl(225 20% 8% / 0.97), hsl(225 28% 5% / 0.99))',
        backdropFilter: 'blur(20px) saturate(180%)',
        borderTop: '1px solid hsl(var(--border) / 0.2)',
      }}>
        <div className="flex items-center justify-around h-[4.25rem] px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2 px-4 rounded-xl min-w-[4.5rem] min-h-[3rem] btn-press relative",
                  "transition-colors duration-150",
                  isActive ? "text-primary" : "text-muted-foreground active:text-foreground"
                )}
              >
                <Icon className={cn("w-5 h-5 transition-transform duration-200", isActive && "scale-110")} />
                <span className={cn("text-[10px] font-bold", isActive && "text-primary")}>{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -top-px left-1/2 -translate-x-1/2 w-10 h-[2px] rounded-full"
                    style={{ background: 'linear-gradient(90deg, hsl(var(--primary) / 0.8), hsl(var(--primary) / 0.3))' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
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
