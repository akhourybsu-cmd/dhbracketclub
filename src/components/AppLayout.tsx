import { ReactNode, useEffect, useState, useCallback, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, MessageSquareText, CalendarDays, Swords, Newspaper, User, Trophy, BarChart3, MessageCircle, Bookmark, Link2, ScrollText, Lock, FileText, Sparkles, Shield, Menu, Brackets as BracketsIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import dhMonogram from '@/assets/dh-monogram.png';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { AppDrawer } from '@/components/AppDrawer';
import { NavDrawerProvider, useNavDrawer } from '@/contexts/NavDrawerContext';

const sidebarModules = [
  { type: 'divider', label: 'Social' },
  { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { path: '/chat', label: 'Chat', icon: MessageSquareText },
  { path: '/feed', label: 'Feed', icon: Newspaper },
  { path: '/events', label: 'Events', icon: CalendarDays },
  { path: '/lore', label: 'Lore', icon: ScrollText },
  { type: 'divider', label: 'Compete' },
  { path: '/compete', label: 'Compete Hub', icon: Swords },
  { path: '/drafts', label: 'Drafts', icon: Bookmark },
  { path: '/rune-delve', label: 'Rune Delve', icon: Sparkles },
  { path: '/nexus', label: 'Nexus Defense', icon: Shield },
  { path: '/pickem', label: "Pick'em", icon: Trophy },
  { path: '/brackets', label: 'Brackets', icon: BracketsIcon },
  { type: 'divider', label: 'Other' },
  { path: '/lockbox', label: 'Lockbox', icon: Lock },
  { path: '/polls', label: 'Polls', icon: MessageCircle },
  { path: '/rankings', label: 'Rankings', icon: BarChart3 },
  { path: '/shared', label: 'Shared Media', icon: Link2 },
  { path: '/posts', label: 'Posts', icon: FileText },
];

// Map of routes -> friendly title shown in mobile header
const routeTitles: Array<[RegExp, string]> = [
  [/^\/dashboard/, 'Home'],
  [/^\/chat/, 'Chat'],
  [/^\/compete/, 'Compete'],
  [/^\/events/, 'Events'],
  [/^\/lore/, 'Lore'],
  [/^\/feed/, 'Feed'],
  [/^\/profile/, 'Profile'],
  [/^\/posts/, 'Posts'],
  [/^\/polls/, 'Polls'],
  [/^\/rankings/, 'Rankings'],
  [/^\/shared/, 'Shared Media'],
  [/^\/lockbox/, 'Lockbox'],
  [/^\/brackets/, 'Brackets'],
  [/^\/pools/, 'Pools'],
  [/^\/admin\/clubs/, 'Manage Clubs'],
  [/^\/club\/settings/, 'Club Settings'],
  [/^\/club\/request/, 'Club Access'],
];
function getRouteTitle(pathname: string): string {
  for (const [re, title] of routeTitles) if (re.test(pathname)) return title;
  return 'DH Club';
}

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <NavDrawerProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </NavDrawerProvider>
  );
}

function AppLayoutInner({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { play } = useSoundEffect();
  const { user } = useAuth();
  const { club } = useClub();
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const { open: drawerOpen, setOpen: setDrawerOpen } = useNavDrawer();
  const lastFetchAtRef = useRef<number>(0);

  // Fetch unread chat count (throttled)
  const fetchUnreadCount = useCallback(async (force = false) => {
    if (!user) return;
    const now = Date.now();
    if (!force && now - lastFetchAtRef.current < 10_000) return;
    lastFetchAtRef.current = now;
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

  useEffect(() => { fetchUnreadCount(true); }, [fetchUnreadCount]);
  useEffect(() => {
    const interval = setInterval(() => fetchUnreadCount(true), 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);
  useEffect(() => { fetchUnreadCount(); }, [location.pathname, fetchUnreadCount]);

  const isChatRoute = location.pathname.startsWith('/chat');
  const isRuneDelve = location.pathname.startsWith('/rune-delve');
  const isNexus = location.pathname.startsWith('/nexus');
  const isPickem = location.pathname.startsWith('/pickem');
  const isDrafts = location.pathname.startsWith('/drafts');
  const isGameShell = isRuneDelve || isNexus || isPickem || isDrafts;

  const isNavActive = (path: string) => {
    if (path === '/brackets') return location.pathname.startsWith('/brackets') || location.pathname.startsWith('/pools');
    if (path === '/compete') return location.pathname === '/compete';
    if (path === '/feed') return location.pathname === '/feed';
    if (path === '/posts') return location.pathname.startsWith('/posts');
    if (path === '/lore') return location.pathname.startsWith('/lore');
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  // Mobile header is hidden inside game shells (they own the viewport) and in chat
  // (chat owns its own compact header, including a hamburger button).
  const showMobileHeader = !isGameShell && !isChatRoute;
  const mobileTitle = getRouteTitle(location.pathname);

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Mobile top header with hamburger */}
      {showMobileHeader && (
        <header
          className="lg:hidden sticky top-0 z-40 flex items-center gap-2 h-12 px-2 border-b border-border/30 bg-background/85"
          style={{
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            paddingLeft: 'max(0.5rem, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(0.5rem, env(safe-area-inset-right, 0px))',
          }}
        >
          <button
            type="button"
            aria-label="Open navigation menu"
            onClick={() => { play('tap'); setDrawerOpen(true); }}
            className="p-2 -ml-1 rounded-lg hover:bg-muted/40 active:bg-muted/60 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Menu className="w-5 h-5 text-foreground/85" />
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h1 className="text-[15px] font-bold tracking-tight truncate">{mobileTitle}</h1>
          </div>
          <Link to="/profile" className="p-1 rounded-full active:opacity-80" aria-label="Profile">
            {club?.logo_url ? (
              <img src={club.logo_url} alt="" className="w-8 h-8 rounded-full object-cover border border-border/40" />
            ) : (
              <img src={dhMonogram} alt="" className="w-8 h-8 rounded-full object-contain" />
            )}
          </Link>
        </header>
      )}

      {/* Drawer */}
      <AppDrawer open={drawerOpen} onOpenChange={setDrawerOpen} unreadChatCount={unreadChatCount} />

      {/* Main Content */}
      <main className={cn(
        "flex-1 overflow-x-hidden min-w-0",
        isGameShell ? "pb-0" : "lg:pl-64",
        isChatRoute && "overflow-hidden"
      )}>
        {location.pathname === '/chat' || isGameShell ? (
          children
        ) : (
          <div className="max-w-[640px] mx-auto px-4 sm:px-5 py-5 sm:py-6 lg:py-8 min-w-0">
            {children}
          </div>
        )}
      </main>

      {/* Desktop Sidebar — hidden inside game shells (Rune Delve, Nexus) */}
      {!isGameShell && (
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 flex-col z-40 bg-sidebar-background border-r border-border/50" style={{
        backdropFilter: 'blur(24px) saturate(180%)',
        boxShadow: 'inset -1px 0 0 hsl(var(--foreground) / 0.02)',
      }}>
        <div className="px-6 pt-7 pb-8">
          <div className="flex items-center gap-3 mb-1.5">
            {club?.logo_url ? (
              <img src={club.logo_url} alt={club.name} className="w-12 h-12 object-cover rounded-xl drop-shadow-lg" style={{ filter: 'drop-shadow(0 0 10px hsl(var(--club-accent) / 0.3))' }} />
            ) : (
              <img src={dhMonogram} alt="DH" className="w-12 h-12 object-contain drop-shadow-lg" style={{ filter: 'drop-shadow(0 0 10px hsl(var(--club-accent) / 0.25))' }} />
            )}
            <div className="min-w-0">
              <h1 className="text-base font-extrabold tracking-tight leading-none truncate">
                <span className="gradient-text">{club?.name ?? 'DH'}</span>
              </h1>
              <p className="text-[8px] text-muted-foreground/70 font-bold uppercase tracking-[0.2em] mt-0.5">Compete With Your Crew</p>
            </div>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5 px-3 flex-1">
          {sidebarModules.map((item, idx) => {
            if ('type' in item && item.type === 'divider') {
              return (
                <div key={idx} className="mt-4 mb-1.5 px-3">
                  <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">{item.label}</p>
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
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70">Theme</span>
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
          <div className="h-px bg-border/40 mb-4" />
          <p className="text-[9px] text-muted-foreground/60 font-semibold tracking-wide">DH — For fun, not funds.</p>
        </div>
      </aside>
      )}
    </div>
  );
}
