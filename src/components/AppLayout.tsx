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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-6 lg:py-8">
          {children}
        </div>
      </main>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 flex-col bg-surface border-r border-border/40 z-40">
        <div className="px-5 pt-6 pb-8">
          <h1 className="text-xl font-extrabold tracking-tight">
            <span className="gradient-text">Bracket</span>
            <span className="text-foreground"> Battle</span>
          </h1>
          <p className="text-[11px] text-muted-foreground mt-1 font-medium">March Madness Pools</p>
        </div>
        <nav className="flex flex-col gap-0.5 px-3">
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
        <div className="mt-auto px-5 pb-5">
          <p className="text-[10px] text-muted-foreground/60 font-medium">For fun, not funds.</p>
        </div>
      </aside>

      {/* Mobile Bottom Nav — taller touch targets */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-xl border-t border-border/40 z-50 safe-area-inset-bottom">
        <div className="flex items-center justify-around h-[4.25rem] px-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2 px-4 rounded-xl min-w-[4.5rem] min-h-[3rem] btn-press",
                  "transition-colors duration-150",
                  isActive ? "text-primary" : "text-muted-foreground active:text-foreground"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive && "scale-110")} style={{ transition: 'transform 0.15s ease' }} />
                <span className={cn("text-[10px] font-semibold", isActive && "text-primary")}>{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary"
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
