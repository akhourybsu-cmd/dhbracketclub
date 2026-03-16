import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Plus, Users, ArrowRight, Trophy, Zap, BarChart3, Calendar, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { getBracketDisplayStatus, STATUS_CONFIG, TOTAL_GAMES } from '@/lib/bracketUtils';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAuth();
  const [pools, setPools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [bracketStatuses, setBracketStatuses] = useState<Map<string, string>>(new Map());
  const [memberCounts, setMemberCounts] = useState<Map<string, number>>(new Map());

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

        // Fetch member counts
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
    <div className="max-w-2xl mx-auto">
      {/* Hero header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <p className="text-sm text-muted-foreground font-medium mb-1">{getGreeting()},</p>
        <h1 className="text-3xl font-extrabold tracking-tight">{displayName || 'there'} 👋</h1>
      </motion.div>

      {/* Quick actions */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="flex gap-3 mb-8"
      >
        <Link to="/pools/create" className="flex-1">
          <Button className="w-full gap-2 font-bold h-11 rounded-xl text-sm">
            <Plus className="w-4 h-4" /> Create Pool
          </Button>
        </Link>
        <Link to="/pools/join" className="flex-1">
          <Button variant="outline" className="w-full gap-2 font-bold h-11 rounded-xl text-sm">
            <Users className="w-4 h-4" /> Join Pool
          </Button>
        </Link>
      </motion.div>

      {/* Summary stats */}
      {!loading && pools.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="grid grid-cols-3 gap-3 mb-8"
        >
          <div className="stat-card">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mb-1">
              <Trophy className="w-4 h-4 text-primary" />
            </div>
            <span className="stat-value">{pools.length}</span>
            <span className="stat-label">Active Pools</span>
          </div>
          <div className="stat-card">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center mb-1">
              <BarChart3 className="w-4 h-4 text-accent" />
            </div>
            <span className="stat-value">
              {Array.from(bracketStatuses.values()).filter(s => s === 'submitted' || s === 'scored').length}
            </span>
            <span className="stat-label">Brackets In</span>
          </div>
          <div className="stat-card">
            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center mb-1">
              <Shield className="w-4 h-4 text-success" />
            </div>
            <span className="stat-value">
              {pools.filter(p => isLocked(p.lock_time)).length}
            </span>
            <span className="stat-label">Locked</span>
          </div>
        </motion.div>
      )}

      {/* My Pools section */}
      <div className="section-divider">
        <h2 className="section-header mb-0">My Pools</h2>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="glass-card p-5 animate-pulse rounded-xl">
              <div className="h-4 bg-muted rounded w-1/3 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
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
        <div className="space-y-3">
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
                  <div className="glass-card p-4 hover-lift group cursor-pointer">
                    <div className="flex items-center gap-3">
                      {/* Pool icon */}
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                        locked ? "bg-muted/50" : "bg-primary/10"
                      )}>
                        <Trophy className={cn("w-5 h-5", locked ? "text-muted-foreground" : "text-primary")} />
                      </div>

                      {/* Pool info */}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm truncate">{pool.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-muted-foreground">
                            {pool.tournaments?.name} {pool.tournaments?.season_year}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-border" />
                          <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                            <Users className="w-3 h-3" /> {members}
                          </span>
                        </div>
                      </div>

                      {/* Status pills + arrow */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={cn("status-pill", bsCfg.className)}>{bsCfg.label}</span>
                        <span className={cn(
                          "status-pill",
                          locked ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success'
                        )}>
                          {locked ? 'Locked' : 'Open'}
                        </span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
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
