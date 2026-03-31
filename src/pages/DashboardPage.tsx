import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Plus, Users, ArrowRight, Trophy, BarChart3, Shield, Download, X,
  MessageCircle, Bookmark, Zap, CalendarDays, Clock, MapPin, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getBracketDisplayStatus, STATUS_CONFIG, TOTAL_GAMES } from '@/lib/bracketUtils';
import { cn } from '@/lib/utils';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import dhMonogram from '@/assets/dh-monogram.png';
import { formatDistanceToNow, format, isPast, isToday, isTomorrow, isThisWeek } from 'date-fns';
import { useActivityFeedUpdates } from '@/hooks/useRealtimeSubscription';

const MODULE_ICONS: Record<string, any> = {
  bracket_pool: Trophy,
  ranking: BarChart3,
  poll: MessageCircle,
  draft: Bookmark,
};

const MODULE_COLORS: Record<string, string> = {
  bracket_pool: 'primary',
  ranking: 'accent',
  poll: 'warning',
  draft: 'gold',
};

// Humanized activity labels
const ACTIVITY_LABELS: Record<string, string> = {
  ranking_created: 'created a ranking',
  ranking_submitted: 'submitted a ranking',
  poll_created: 'created a poll',
  poll_voted: 'voted on a poll',
  draft_created: 'created a draft',
  draft_completed: 'completed a draft',
  bracket_submitted: 'submitted a bracket',
  event_created: 'created an event',
  post_created: 'started a discussion',
  event_rsvp: 'RSVPed to an event',
};

const ACTIVITY_ICONS: Record<string, { icon: any; color: string }> = {
  ranking_created: { icon: BarChart3, color: 'accent' },
  ranking_submitted: { icon: BarChart3, color: 'accent' },
  poll_created: { icon: MessageCircle, color: 'warning' },
  poll_voted: { icon: MessageCircle, color: 'warning' },
  draft_created: { icon: Bookmark, color: 'gold' },
  draft_completed: { icon: Bookmark, color: 'gold' },
  bracket_submitted: { icon: Trophy, color: 'primary' },
  event_created: { icon: CalendarDays, color: 'success' },
  post_created: { icon: MessageCircle, color: 'primary' },
  event_rsvp: { icon: CalendarDays, color: 'success' },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { canInstall, install } = usePwaInstall();
  const [pools, setPools] = useState<any[]>([]);
  const [rankings, setRankings] = useState<any[]>([]);
  const [polls, setPolls] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [dashAvatarUrl, setDashAvatarUrl] = useState<string | null>(null);
  const [bracketStatuses, setBracketStatuses] = useState<Map<string, string>>(new Map());
  const [memberCounts, setMemberCounts] = useState<Map<string, number>>(new Map());
  const [dismissedInstall, setDismissedInstall] = useState(false);
  const [activity, setActivity] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      // Profile
      const { data: profile } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', user.id).single();
      if (profile) {
        setDisplayName(profile.display_name);
        setDashAvatarUrl(profile.avatar_url);
      }

      // Bracket pools
      const { data: memberships } = await supabase.from('pool_members').select('pool_id').eq('user_id', user.id);
      if (memberships && memberships.length > 0) {
        const poolIds = memberships.map(m => m.pool_id);
        const { data: poolData } = await supabase
          .from('pools')
          .select('id, name, invite_code, lock_time, tournaments(name, season_year)')
          .in('id', poolIds);
        if (poolData) setPools(poolData);

        const { data: brackets } = await supabase
          .from('brackets')
          .select('id, pool_id, status')
          .eq('user_id', user.id)
          .in('pool_id', poolIds);

        if (brackets && poolData) {
          const bracketPickCounts = new Map<string, number>();
          if (brackets.length > 0) {
            const bracketIds = brackets.map(b => b.id);
            const { data: pickData } = await supabase
              .from('bracket_picks')
              .select('bracket_id')
              .in('bracket_id', bracketIds);
            if (pickData) {
              pickData.forEach(p => bracketPickCounts.set(p.bracket_id, (bracketPickCounts.get(p.bracket_id) || 0) + 1));
            }
          }

          const sm = new Map<string, string>();
          poolData.forEach(p => {
            const b = brackets.find(br => br.pool_id === p.id);
            const picksCount = b ? (bracketPickCounts.get(b.id) || 0) : 0;
            const ds = getBracketDisplayStatus(b?.status || null, p.lock_time, picksCount, TOTAL_GAMES);
            sm.set(p.id, ds);
          });
          setBracketStatuses(sm);
        }

        const { data: allMembers } = await supabase.from('pool_members').select('pool_id').in('pool_id', poolIds);
        if (allMembers) {
          const counts = new Map<string, number>();
          allMembers.forEach(m => counts.set(m.pool_id, (counts.get(m.pool_id) || 0) + 1));
          setMemberCounts(counts);
        }
      }

      // Rankings, Polls, Drafts — fetch active ones
      const [{ data: rankData }, { data: pollData }, { data: draftData }, { data: activityData }, { data: eventsData }] = await Promise.all([
        supabase.from('rankings').select('*, competitions(title, status)').order('created_at', { ascending: false }).limit(5),
        supabase.from('polls').select('*, competitions(title, status)').order('created_at', { ascending: false }).limit(5),
        supabase.from('drafts').select('*, competitions(title, status)').order('created_at', { ascending: false }).limit(5),
        supabase.from('activity_feed').select('*, profiles:actor_user_id(display_name)').order('created_at', { ascending: false }).limit(10),
        supabase.from('events').select('*, profiles:created_by(display_name)').gte('starts_at', new Date().toISOString()).order('starts_at', { ascending: true }).limit(3),
      ]);

      // Derive effective statuses client-side
      if (rankData) setRankings(rankData);
      if (pollData) {
        setPolls(pollData.map(p => {
          if (p.status === 'open' && p.closes_at && isPast(new Date(p.closes_at))) {
            return { ...p, status: 'closed' };
          }
          return p;
        }));
      }
      if (draftData) setDrafts(draftData);
      if (activityData) setActivity(activityData);
      if (eventsData) setUpcomingEvents(eventsData);

      setLoading(false);
    };
    fetchData();
  }, [user]);

  // Realtime: refresh activity feed when new events come in
  useActivityFeedUpdates(() => {
    if (!user) return;
    supabase.from('activity_feed').select('*, profiles:actor_user_id(display_name)').order('created_at', { ascending: false }).limit(10).then(({ data }) => {
      if (data) setActivity(data);
    });
  });

  const isLocked = (lt: string) => new Date(lt) <= new Date();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const totalActive = pools.length + rankings.length + polls.length + drafts.length;

  if (loading) {
    return (
      <div className="pb-6">
        {/* Hero skeleton */}
        <div className="mb-7">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl skeleton-shimmer" />
            <div className="h-2.5 w-20 rounded skeleton-shimmer" />
          </div>
          <div className="h-7 w-48 rounded-lg skeleton-shimmer mb-2" />
          <div className="h-3 w-36 rounded skeleton-shimmer" />
        </div>
        {/* Quick create skeleton */}
        <div className="grid grid-cols-4 gap-1.5 mb-7">
          {[1,2,3,4].map(i => <div key={i} className="glass-card py-7 skeleton-shimmer" />)}
        </div>
        {/* Cards skeleton */}
        <div className="space-y-2.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl skeleton-shimmer flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 rounded-md w-2/3 skeleton-shimmer" />
                  <div className="h-2.5 rounded-md w-1/2 skeleton-shimmer" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      {/* ═══ Hero Section ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative mb-7"
      >
        <div className="absolute -inset-x-8 -top-14 -bottom-8 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 90% 55% at 50% -15%, hsl(var(--primary) / 0.06), transparent)',
        }} />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <motion.img
                src={dhMonogram}
                alt="DH"
                className="w-9 h-9 object-contain"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05, type: 'spring', damping: 18 }}
                style={{ filter: 'drop-shadow(0 0 10px hsl(var(--primary) / 0.18))' }}
              />
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.08 }}
                className="text-[9px] font-bold uppercase tracking-[0.25em]"
                style={{ color: 'hsl(var(--primary) / 0.5)' }}
              >
                {getGreeting()}
              </motion.p>
            </div>
            <Link to="/profile" className="lg:hidden">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', damping: 18 }}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-extrabold text-primary btn-press overflow-hidden"
                style={{
                  background: dashAvatarUrl ? 'transparent' : 'linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.04))',
                  border: '1px solid hsl(var(--primary) / 0.1)',
                }}
              >
                {dashAvatarUrl ? (
                  <img src={dashAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  displayName ? displayName[0].toUpperCase() : '?'
                )}
              </motion.div>
            </Link>
          </div>
          <motion.h1
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="text-[1.75rem] font-extrabold tracking-tight leading-none"
          >
            {displayName || 'there'}{' '}
            <motion.span
              initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 15 }}
              className="inline-block"
            >
              👋
            </motion.span>
          </motion.h1>
          {!loading && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-[13px] text-muted-foreground mt-1.5 font-medium"
            >
              {totalActive > 0 ? `${totalActive} active competition${totalActive !== 1 ? 's' : ''}` : 'No active competitions yet'}
            </motion.p>
          )}
        </div>
      </motion.div>

      {/* ═══ Quick Create ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.4 }}
        className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-7"
      >
        {[
          { to: '/pools/create', icon: Trophy, label: 'Bracket', color: 'primary' },
          { to: '/rankings/create', icon: BarChart3, label: 'Ranking', color: 'accent' },
          { to: '/polls/create', icon: MessageCircle, label: 'Poll', color: 'warning' },
          { to: '/drafts/create', icon: Bookmark, label: 'Draft', color: 'gold' },
        ].map((item, i) => (
          <motion.div key={item.to} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 + i * 0.04 }}>
            <Link to={item.to}>
              <div className="action-tile py-3">
                <Plus className="w-3 h-3 absolute top-2 right-2 text-muted-foreground/70" />
                <item.icon className="w-5 h-5 mx-auto mb-1.5 relative z-10" style={{ color: `hsl(var(--${item.color}))` }} />
                <p className="text-[10px] font-bold relative z-10">{item.label}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {/* ═══ PWA Install Banner ═══ */}
      <AnimatePresence>
        {canInstall && !dismissedInstall && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-7 overflow-hidden"
          >
            <div className="glass-card arena-edge p-4 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 relative z-10" style={{
                background: 'linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.06))',
              }}>
                <Download className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0 relative z-10">
                <p className="text-[13px] font-bold">Install DH</p>
                <p className="text-[10px] text-muted-foreground">Best experience on home screen</p>
              </div>
              <button onClick={install} className="rounded-xl font-bold text-xs h-8 px-3.5 flex-shrink-0 relative z-10 btn-premium">
                Install
              </button>
              <button onClick={() => setDismissedInstall(true)} className="text-muted-foreground/60 hover:text-foreground p-1 relative z-10 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Upcoming Events ═══ */}
      {upcomingEvents.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }}>
          <div className="section-divider mb-3">
            <h2 className="section-header mb-0">
              <CalendarDays className="w-3.5 h-3.5 inline-block mr-1.5 text-primary" />
              Upcoming Events
            </h2>
            <Link to="/events" className="text-[10px] font-bold text-primary/80 hover:text-primary transition-colors">View All</Link>
          </div>
          <div className="space-y-2 mb-7">
            {upcomingEvents.map((ev: any, i: number) => {
              const getLabel = (d: string) => {
                const dt = new Date(d);
                if (isToday(dt)) return 'Today';
                if (isTomorrow(dt)) return 'Tomorrow';
                if (isThisWeek(dt)) return format(dt, 'EEEE');
                return format(dt, 'MMM d');
              };
              return (
                <motion.div key={ev.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.04 }}>
                  <Link to={`/events/${ev.id}`} className="block group">
                    <div className="glass-card p-3.5 transition-all duration-200 group-hover:border-primary/15">
                      <div className="flex items-center gap-3 relative z-10">
                        <div className="w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0" style={{
                          background: 'linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--primary) / 0.04))',
                        }}>
                          <span className="text-[8px] font-bold text-primary uppercase leading-none">{format(new Date(ev.starts_at), 'MMM')}</span>
                          <span className="text-[15px] font-extrabold text-primary leading-none">{format(new Date(ev.starts_at), 'd')}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-[13px] truncate tracking-tight">{ev.title}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-primary/85 font-semibold flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" /> {getLabel(ev.starts_at)} · {format(new Date(ev.starts_at), 'h:mm a')}
                            </span>
                            {ev.location && (
                              <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                                <MapPin className="w-2.5 h-2.5" /> {ev.location}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {pools.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <div className="section-divider mb-3">
            <h2 className="section-header mb-0">
              <Trophy className="w-3.5 h-3.5 inline-block mr-1.5 text-primary" />
              Brackets
            </h2>
            <Link to="/brackets" className="text-[10px] font-bold text-primary/80 hover:text-primary transition-colors">View All</Link>
          </div>
          <div className="space-y-2 mb-7">
            {pools.slice(0, 3).map((pool, i) => {
              const bs = bracketStatuses.get(pool.id) || 'none';
              const bsCfg = STATUS_CONFIG[bs];
              const locked = isLocked(pool.lock_time);
              const members = memberCounts.get(pool.id) || 0;
              return (
                <motion.div key={pool.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 + i * 0.04 }}>
                  <Link to={`/pools/${pool.id}`} className="block group">
                    <div className="glass-card p-3.5 transition-all duration-200 group-hover:border-primary/15">
                      <div className="flex items-center gap-3 relative z-10">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{
                          background: locked ? 'hsl(var(--muted) / 0.5)' : 'linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.04))',
                        }}>
                          <Trophy className={cn("w-4 h-4", locked ? "text-muted-foreground/60" : "text-primary")} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-[13px] truncate tracking-tight">{pool.name}</h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-muted-foreground/70 font-medium">{pool.tournaments?.name}</span>
                            <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/15" />
                            <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5 font-medium">
                              <Users className="w-2.5 h-2.5" /> {members}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={cn("status-pill", bsCfg.className)}>{bsCfg.label}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ═══ Active Rankings ═══ */}
      {rankings.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }}>
          <div className="section-divider mb-3">
            <h2 className="section-header mb-0">
              <BarChart3 className="w-3.5 h-3.5 inline-block mr-1.5" style={{ color: 'hsl(var(--accent))' }} />
              Rankings
            </h2>
            <Link to="/rankings" className="text-[10px] font-bold text-primary/80 hover:text-primary transition-colors">View All</Link>
          </div>
          <div className="space-y-2 mb-7">
            {rankings.slice(0, 3).map((r: any, i: number) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.04 }}>
                <Link to={`/rankings/${r.id}`} className="block group">
                  <div className="glass-card p-3.5 transition-all duration-200 group-hover:border-accent/15">
                    <div className="flex items-center gap-3 relative z-10">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{
                        background: 'linear-gradient(135deg, hsl(var(--accent) / 0.15), hsl(var(--accent) / 0.04))',
                      }}>
                        <BarChart3 className="w-4 h-4" style={{ color: 'hsl(var(--accent))' }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-[13px] truncate tracking-tight">{r.topic}</h3>
                        <p className="text-[10px] text-muted-foreground/70 font-medium">{r.item_count} items to rank</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="status-pill bg-success/10 text-success">Open</span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ═══ Active Polls ═══ */}
      {polls.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.34 }}>
          <div className="section-divider mb-3">
            <h2 className="section-header mb-0">
              <MessageCircle className="w-3.5 h-3.5 inline-block mr-1.5" style={{ color: 'hsl(var(--warning))' }} />
              Polls
            </h2>
            <Link to="/polls" className="text-[10px] font-bold text-primary/80 hover:text-primary transition-colors">View All</Link>
          </div>
          <div className="space-y-2 mb-7">
            {polls.slice(0, 3).map((p: any, i: number) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 + i * 0.04 }}>
                <Link to={`/polls/${p.id}`} className="block group">
                  <div className="glass-card p-3.5 transition-all duration-200 group-hover:border-warning/15">
                    <div className="flex items-center gap-3 relative z-10">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{
                        background: 'linear-gradient(135deg, hsl(var(--warning) / 0.15), hsl(var(--warning) / 0.04))',
                      }}>
                        <MessageCircle className="w-4 h-4" style={{ color: 'hsl(var(--warning))' }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-[13px] truncate tracking-tight">{p.question}</h3>
                        <p className="text-[10px] text-muted-foreground/70 font-medium capitalize">{p.poll_type} choice</p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ═══ Active Drafts ═══ */}
      {drafts.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.38 }}>
          <div className="section-divider mb-3">
            <h2 className="section-header mb-0">
              <Bookmark className="w-3.5 h-3.5 inline-block mr-1.5" style={{ color: 'hsl(var(--gold))' }} />
              Drafts
            </h2>
            <Link to="/drafts" className="text-[10px] font-bold text-primary/80 hover:text-primary transition-colors">View All</Link>
          </div>
          <div className="space-y-2 mb-7">
            {drafts.slice(0, 3).map((d: any, i: number) => (
              <motion.div key={d.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.04 }}>
                <Link to={`/drafts/${d.id}`} className="block group">
                  <div className="glass-card p-3.5 transition-all duration-200 group-hover:border-gold/15">
                    <div className="flex items-center gap-3 relative z-10">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{
                        background: 'linear-gradient(135deg, hsl(var(--gold) / 0.15), hsl(var(--gold) / 0.04))',
                      }}>
                        <Bookmark className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-[13px] truncate tracking-tight">{d.topic}</h3>
                        <p className="text-[10px] text-muted-foreground/70 font-medium">
                          {d.num_rounds} rounds • {d.status === 'in_progress' ? 'In Progress' : d.status === 'setup' ? 'Setup' : 'Complete'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={cn(
                          "status-pill",
                          d.status === 'in_progress' ? 'bg-success/10 text-success' : d.status === 'setup' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
                        )}>
                          {d.status === 'in_progress' ? 'In Progress' : d.status === 'setup' ? 'Setup' : 'Complete'}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ═══ Empty state — no activity at all ═══ */}
      {!loading && totalActive === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card arena-edge p-10 text-center"
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 relative z-10">
            <img src={dhMonogram} alt="DH" className="w-10 h-10 object-contain opacity-50" />
          </div>
          <p className="text-sm font-bold relative z-10 mb-1">Welcome to DH</p>
          <p className="text-xs text-muted-foreground leading-relaxed relative z-10 mb-5">Start a competition with your crew — brackets, rankings, polls, or drafts.</p>
          <div className="flex flex-wrap gap-2 justify-center relative z-10">
            <Link to="/polls/create">
              <button className="flex items-center gap-2 font-bold rounded-xl px-4 py-2.5 text-[13px] btn-premium btn-press">
                <MessageCircle className="w-4 h-4" /> Quick Poll
              </button>
            </Link>
            <Link to="/rankings/create">
              <button className="flex items-center gap-2 font-bold rounded-xl px-4 py-2.5 text-[13px] btn-press" style={{
                background: 'hsl(var(--surface-elevated))',
                border: '1px solid hsl(var(--border) / 0.5)',
              }}>
                <BarChart3 className="w-4 h-4" /> Ranking
              </button>
            </Link>
            <Link to="/drafts/create">
              <button className="flex items-center gap-2 font-bold rounded-xl px-4 py-2.5 text-[13px] btn-press" style={{
                background: 'hsl(var(--surface-elevated))',
                border: '1px solid hsl(var(--border) / 0.5)',
              }}>
                <Bookmark className="w-4 h-4" /> Draft
              </button>
            </Link>
          </div>
        </motion.div>
      )}

      {/* ═══ Recent Activity ═══ */}
      {activity.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <div className="section-divider mb-3">
            <h2 className="section-header mb-0">
              <Zap className="w-3.5 h-3.5 inline-block mr-1.5 text-primary" />
              Recent Activity
            </h2>
          </div>
          <div className="glass-card divide-y divide-border/20 overflow-hidden">
            {activity.slice(0, 6).map((a: any) => {
              const actConfig = ACTIVITY_ICONS[a.event_type];
              const ActIcon = actConfig?.icon || Zap;
              const actColor = actConfig?.color || 'primary';
              const label = ACTIVITY_LABELS[a.event_type] || a.event_type.replace(/_/g, ' ');

              // Build link target based on activity type
              const targetLink = a.target_id && a.target_type
                ? a.target_type === 'ranking' ? `/rankings/${a.target_id}`
                  : a.target_type === 'poll' ? `/polls/${a.target_id}`
                  : a.target_type === 'draft' ? `/drafts/${a.target_id}`
                  : a.target_type === 'bracket' ? `/pools/${a.target_id}`
                  : a.target_type === 'event' ? `/events/${a.target_id}`
                  : a.target_type === 'post' ? `/posts/${a.target_id}`
                  : null
                : null;

              const content = (
                <div className="px-4 py-3 flex items-center gap-3 relative z-10">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                    background: `linear-gradient(135deg, hsl(var(--${actColor}) / 0.12), hsl(var(--${actColor}) / 0.04))`,
                  }}>
                    <ActIcon className="w-3 h-3" style={{ color: `hsl(var(--${actColor}))` }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium truncate">
                      <span className="font-bold">{a.profiles?.display_name || 'Someone'}</span>{' '}
                      <span className="text-muted-foreground">{label}</span>
                    </p>
                    <p className="text-[9px] text-muted-foreground/60 font-medium">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );

              return targetLink ? (
                <Link key={a.id} to={targetLink} className="block hover:bg-muted/20 transition-colors">
                  {content}
                </Link>
              ) : (
                <div key={a.id}>{content}</div>
              );
            })}
          </div>
        </motion.div>
      )}

    </div>
  );
}
