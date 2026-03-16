import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Plus, Users, ArrowRight, Trophy, BarChart3, Shield, Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getBracketDisplayStatus, STATUS_CONFIG, TOTAL_GAMES } from '@/lib/bracketUtils';
import { cn } from '@/lib/utils';
import { usePwaInstall } from '@/hooks/usePwaInstall';

export default function DashboardPage() {
  const { user } = useAuth();
  const { canInstall, install } = usePwaInstall();
  const [pools, setPools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [bracketStatuses, setBracketStatuses] = useState<Map<string, string>>(new Map());
  const [memberCounts, setMemberCounts] = useState<Map<string, number>>(new Map());
  const [dismissedInstall, setDismissedInstall] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single();
      if (profile) setDisplayName(profile.display_name);

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
          .select('pool_id, status')
          .eq('user_id', user.id)
          .in('pool_id', poolIds);

        if (brackets && poolData) {
          const sm = new Map<string, string>();
          poolData.forEach(p => {
            const b = brackets.find(br => br.pool_id === p.id);
            const ds = getBracketDisplayStatus(b?.status || null, p.lock_time, 0, TOTAL_GAMES);
            sm.set(p.id, ds);
          });
          setBracketStatuses(sm);
        }

        const { data: allMembers } = await supabase
          .from('pool_members')
          .select('pool_id')
          .in('pool_id', poolIds);
        if (allMembers) {
          const counts = new Map<string, number>();
          allMembers.forEach(m => counts.set(m.pool_id, (counts.get(m.pool_id) || 0) + 1));
          setMemberCounts(counts);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const isLocked = (lt: string) => new Date(lt) <= new Date();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div>
      {/* Hero header with ambient glow */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="mb-10 hero-glow relative z-10"
      >
        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mb-2">{getGreeting()}</p>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-none">
          {displayName || 'there'} <span className="inline-block animate-fade-in">👋</span>
        </h1>
      </motion.div>

      {/* Quick actions */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35 }}
        className="flex gap-3 mb-8"
      >
        <Link to="/pools/create" className="flex-1">
          <Button className="w-full gap-2 font-bold h-12 rounded-xl text-sm btn-press" style={{ boxShadow: 'var(--shadow-glow-sm)' }}>
            <Plus className="w-4 h-4" /> Create Pool
          </Button>
        </Link>
        <Link to="/pools/join" className="flex-1">
          <Button variant="outline" className="w-full gap-2 font-bold h-12 rounded-xl text-sm btn-press border-border/50">
            <Users className="w-4 h-4" /> Join Pool
          </Button>
        </Link>
      </motion.div>

      {/* PWA Install Banner */}
      <AnimatePresence>
        {canInstall && !dismissedInstall && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8 overflow-hidden"
          >
            <div className="glass-card p-4 flex items-center gap-3" style={{ borderColor: 'hsl(var(--primary) / 0.2)' }}>
              <div className="icon-container w-10 h-10 flex-shrink-0">
                <Download className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">Install Bracket Battle</p>
                <p className="text-[11px] text-muted-foreground">Add to home screen for the best experience</p>
              </div>
              <Button size="sm" onClick={install} className="rounded-xl font-bold text-xs h-9 px-4 btn-press flex-shrink-0">
                Install
              </Button>
              <button onClick={() => setDismissedInstall(true)} className="text-muted-foreground hover:text-foreground p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary stats */}
      {!loading && pools.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35 }}
          className="grid grid-cols-3 gap-3 mb-8"
        >
          {[
            { icon: Trophy, value: pools.length, label: 'Pools', iconColor: 'text-primary' },
            { icon: BarChart3, value: Array.from(bracketStatuses.values()).filter(s => s === 'submitted' || s === 'scored').length, label: 'Brackets In', iconColor: 'text-accent' },
            { icon: Shield, value: pools.filter(p => isLocked(p.lock_time)).length, label: 'Locked', iconColor: 'text-success' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.06 }}
              className="stat-card"
            >
              <stat.icon className={cn("w-4 h-4 mb-0.5", stat.iconColor)} />
              <span className="stat-value">{stat.value}</span>
              <span className="stat-label">{stat.label}</span>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* My Pools section */}
      <div className="section-divider">
        <h2 className="section-header mb-0">My Pools</h2>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="glass-card p-5">
              <div className="h-4 bg-muted rounded-lg w-1/3 mb-3 skeleton-shimmer" />
              <div className="h-3 bg-muted rounded-lg w-1/2 skeleton-shimmer" />
            </div>
          ))}
        </div>
      ) : pools.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="empty-state"
        >
          <div className="empty-state-icon">
            <Trophy />
          </div>
          <p className="empty-state-title">No pools yet</p>
          <p className="empty-state-desc mb-6">Create a pool or join one with an invite code.</p>
          <div className="flex gap-3 justify-center">
            <Link to="/pools/create">
              <Button className="font-bold rounded-xl gap-2 btn-press">
                <Plus className="w-4 h-4" /> Create Pool
              </Button>
            </Link>
            <Link to="/pools/join">
              <Button variant="outline" className="font-bold rounded-xl gap-2 btn-press">
                <Users className="w-4 h-4" /> Join Pool
              </Button>
            </Link>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-2.5">
          {pools.map((pool, i) => {
            const bs = bracketStatuses.get(pool.id) || 'none';
            const bsCfg = STATUS_CONFIG[bs];
            const locked = isLocked(pool.lock_time);
            const members = memberCounts.get(pool.id) || 0;
            return (
              <motion.div
                key={pool.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.05, duration: 0.3 }}
              >
                <Link to={`/pools/${pool.id}`} className="block">
                  <div className="pool-row p-4">
                    <div className="flex items-center gap-3.5 relative z-10">
                      <div className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0",
                        locked ? "bg-muted/60" : "icon-container"
                      )}>
                        <Trophy className={cn("w-5 h-5", locked ? "text-muted-foreground" : "text-primary")} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-[15px] truncate tracking-tight">{pool.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {pool.tournaments?.name} {pool.tournaments?.season_year}
                          </span>
                          <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/30" />
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 font-medium">
                            <Users className="w-3 h-3" /> {members}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={cn("status-pill", bsCfg.className)}>{bsCfg.label}</span>
                        <span className={cn(
                          "status-pill",
                          locked ? 'bg-destructive/12 text-destructive' : 'bg-success/12 text-success'
                        )}>
                          {locked ? 'Locked' : 'Open'}
                        </span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
