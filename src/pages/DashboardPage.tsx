import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Plus, Users, ArrowRight, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { getBracketDisplayStatus, STATUS_CONFIG, TOTAL_GAMES } from '@/lib/bracketUtils';

export default function DashboardPage() {
  const { user } = useAuth();
  const [pools, setPools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [bracketStatuses, setBracketStatuses] = useState<Map<string, string>>(new Map());

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

        // Get bracket statuses
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
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const isLocked = (lt: string) => new Date(lt) <= new Date();

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold mb-1">Hey, {displayName || 'there'} 👋</h1>
        <p className="text-muted-foreground text-sm mb-6">Here's your bracket overview.</p>
      </motion.div>

      <div className="flex gap-3 mb-8">
        <Link to="/pools/create">
          <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> Create Pool</Button>
        </Link>
        <Link to="/pools/join">
          <Button variant="outline" size="sm" className="gap-2"><Users className="w-4 h-4" /> Join Pool</Button>
        </Link>
      </div>

      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">My Pools</h2>

      {loading ? (
        <div className="space-y-3">{[1, 2].map(i => <div key={i} className="glass-card p-4 animate-pulse h-20" />)}</div>
      ) : pools.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">You haven't joined any pools yet.</p>
          <div className="flex gap-3 justify-center">
            <Link to="/pools/create"><Button size="sm">Create One</Button></Link>
            <Link to="/pools/join"><Button variant="outline" size="sm">Join with Code</Button></Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {pools.map((pool, i) => {
            const bs = bracketStatuses.get(pool.id) || 'none';
            const bsCfg = STATUS_CONFIG[bs];
            return (
              <motion.div key={pool.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link to={`/pools/${pool.id}`} className="block">
                  <div className="glass-card p-4 hover:bg-card/90 transition-colors group">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm truncate">{pool.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{pool.tournaments?.name} {pool.tournaments?.season_year}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`status-pill text-[10px] ${bsCfg.className}`}>{bsCfg.label}</span>
                        <span className={`status-pill text-[10px] ${isLocked(pool.lock_time) ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success'}`}>
                          {isLocked(pool.lock_time) ? 'Locked' : 'Open'}
                        </span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
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
