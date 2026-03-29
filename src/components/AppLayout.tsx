import { ReactNode, useEffect, useState, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, MessageSquareText, CalendarDays, Swords, Newspaper, User, Trophy, BarChart3, MessageCircle, Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { ThemeToggle } from '@/components/ThemeToggle';
import dhMonogram from '@/assets/dh-monogram.png';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { path: '/chat', label: 'Chat', icon: MessageSquareText },
  { path: '/compete', label: 'Compete', icon: Swords },
  { path: '/events', label: 'Events', icon: CalendarDays },
  { path: '/feed', label: 'Feed', icon: Newspaper },
];

const sidebarModules = [
  { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { path: '/chat', label: 'Chat', icon: MessageSquareText },
  { path: '/feed', label: 'Feed', icon: Newspaper },
  { path: '/events', label: 'Events', icon: CalendarDays },
  { type: 'divider', label: 'Compete' },
  { path: '/brackets', label: 'Brackets', icon: Trophy },
  { path: '/rankings', label: 'Rankings', icon: BarChart3 },
  { path: '/polls', label: 'Polls', icon: MessageCircle },
  { path: '/drafts', label: 'Drafts', icon: Bookmark },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { play } = useSoundEffect();
  const { user } = useAuth();
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Fetch unread chat count
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const [{ data: channels }, { data: readStates }] = await Promise.all([
        supabase.from('channels').select('id'),
        (supabase as any).from('channel_read_states').select('channel_id, last_read_at').eq('user_id', user.id),
      ]);
      if (!channels) return;
      const readMap = new Map<string, string>();
      if (readStates) (readStates as any[]).forEach((rs: any) => readMap.set(rs.channel_id, rs.last_read_at));

      const chIds = channels.map((c: any) => c.id);
      const { data: lastMsgs } = await supabase
        .from('messages')
        .select('channel_id, created_at')
        .is('parent_message_id', null)
        .in('channel_id', chIds)
        .order('created_at', { ascending: false })
        .limit(200);

      if (!lastMsgs) return;
      const latestPerChannel = new Map<string, string>();
      lastMsgs.forEach((m: any) => {
        if (!latestPerChannel.has(m.channel_id)) latestPerChannel.set(m.channel_id, m.created_at);
      });

      let count = 0;
      latestPerChannel.forEach((latestAt, chId) => {
        const lastRead = readMap.get(chId);
        if (!lastRead || new Date(latestAt) > new Date(lastRead)) count++;
      });
      setUnreadChatCount(count);
    } catch {}
  }, [user]);

  useEffect(() => { fetchUnreadCount(); }, [fetchUnreadCount]);

  // Refresh unread count periodically and on route change
  useEffect(() => {
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => { fetchUnreadCount(); }, [location.pathname, fetchUnreadCount]);

  const isNavActive = (path: string) => {
    if (path === '/brackets') {
      return location.pathname.startsWith('/brackets') || location.pathname.startsWith('/pools');
    }
    if (path === '/compete') {
      return location.pathname === '/compete' || location.pathname.startsWith('/brackets') || location.pathname.startsWith('/pools') || location.pathname.startsWith('/rankings') || location.pathname.startsWith('/polls') || location.pathname.startsWith('/drafts');
    }
    if (path === '/feed') {
      return location.pathname === '/feed' || location.pathname.startsWith('/posts');
    }
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Main Content */}
      <main className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0 lg:pl-64">
        <div className="max-w-[640px] mx-auto px-4 sm:px-5 py-5 sm:py-6 lg:py-8">
          {children}
        </div>
      </main>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 flex-col z-40 bg-sidebar-background border-r border-border/25" style={{
        backdropFilter: 'blur(24px) saturate(180%)',
        boxShadow: 'inset -1px 0 0 hsl(var(--foreground) / 0.02)',
      }}>
        <div className="px-6 pt-7 pb-8">
          <div className="flex items-center gap-3 mb-1.5">
            <img src={dhMonogram} alt="DH" className="w-12 h-12 object-contain drop-shadow-lg" style={{ filter: 'drop-shadow(0 0 10px hsl(var(--primary) / 0.25))' }} />
            <div>
              <h1 className="text-base font-extrabold tracking-tight leading-none">
                <span className="gradient-text">DH</span>
              </h1>
              <p className="text-[8px] text-muted-foreground/50 font-bold uppercase tracking-[0.2em] mt-0.5">Compete With Your Crew</p>
            </div>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5 px-3 flex-1">
          {sidebarModules.map((item, idx) => {
            if ('type' in item && item.type === 'divider') {
              return (
                <div key={idx} className="mt-4 mb-1.5 px-3">
                  <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">{item.label}</p>
                </div>
              );
            }
            const Icon = item.icon!;
            const active = isNavActive(item.path!);
            const showBadge = item.path === '/chat' && unreadChatCount > 0;
            return (
              <Link
                key={item.path}
                to={item.path!}
                onClick={() => play('tap')}
                className={cn("nav-item relative", active ? "nav-item-active" : "nav-item-inactive")}
              >
                <div className="relative">
                  <Icon className="w-[18px] h-[18px]" />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-primary text-[8px] font-bold text-primary-foreground flex items-center justify-center px-0.5">
                      {unreadChatCount > 9 ? '9+' : unreadChatCount}
                    </span>
                  )}
                </div>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 pb-3 space-y-0.5">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">Theme</span>
            <ThemeToggle />
          </div>
          <Link
            to="/profile"
            onClick={() => play('tap')}
            className={cn("nav-item", location.pathname === '/profile' ? "nav-item-active" : "nav-item-inactive")}
          >
            <User className="w-[18px] h-[18px]" />
            Profile
          </Link>
        </div>
        <div className="px-6 pb-6">
          <div className="h-px bg-border/20 mb-4" />
          <p className="text-[9px] text-muted-foreground/60 font-semibold tracking-wide">DH — For fun, not funds.</p>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 border-t border-border/25" style={{
        backdropFilter: 'blur(28px) saturate(200%)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.15), inset 0 1px 0 hsl(var(--foreground) / 0.02)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        <div className="flex items-center justify-around h-[4rem] px-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(item.path);
            const showBadge = item.path === '/chat' && unreadChatCount > 0;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => play('tap')}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 px-2.5 rounded-xl min-w-[3.5rem] min-h-[2.75rem] btn-press relative",
                  "transition-colors duration-150",
                  active ? "text-primary" : "text-muted-foreground/50 active:text-foreground"
                )}
              >
                <div className="relative">
                  <Icon className={cn("w-[18px] h-[18px] transition-all duration-200", active && "scale-105")} />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] rounded-full bg-primary text-[8px] font-bold text-primary-foreground flex items-center justify-center px-0.5">
                      {unreadChatCount > 9 ? '9+' : unreadChatCount}
                    </span>
                  )}
                </div>
                <span className={cn(
                  "text-[8px] font-bold tracking-wide transition-colors duration-150",
                  active ? "text-primary" : "text-muted-foreground/60"
                )}>{item.label}</span>
                {active && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -top-px left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full"
                    style={{ background: 'linear-gradient(90deg, hsl(var(--primary) / 0.8), hsl(var(--primary) / 0.2))' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                {active && (
                  <motion.div
                    layoutId="nav-underglow"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-3 rounded-full"
                    style={{ background: 'hsl(var(--primary) / 0.08)', filter: 'blur(6px)' }}
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
