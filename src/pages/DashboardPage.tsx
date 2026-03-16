import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Plus, Users, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface PoolWithTournament {
  id: string;
  name: string;
  invite_code: string;
  lock_time: string;
  tournaments: { name: string; season_year: number } | null;
  pool_members: { count: number }[];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [pools, setPools] = useState<PoolWithTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      // Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();
      
      if (profile) setDisplayName(profile.display_name);

      // Get pools the user is a member of
      const { data: memberships } = await supabase
        .from('pool_members')
        .select('pool_id')
        .eq('user_id', user.id);

      if (memberships && memberships.length > 0) {
        const poolIds = memberships.map(m => m.pool_id);
        const { data: poolData } = await supabase
          .from('pools')
          .select('id, name, invite_code, lock_time, tournaments(name, season_year), pool_members(count)')
          .in('id', poolIds);

        if (poolData) setPools(poolData as unknown as PoolWithTournament[]);
      }

      setLoading(false);
    };

    fetchData();
  }, [user]);

  const isLocked = (lockTime: string) => new Date(lockTime) <= new Date();

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold mb-1">
          Hey, {displayName || 'there'} 👋
        </h1>
        <p className="text-muted-foreground text-sm mb-6">Here's your bracket overview.</p>
      </motion.div>

      {/* Quick Actions */}
      <div className="flex gap-3 mb-8">
        <Link to="/pools/create">
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" /> Create Pool
          </Button>
        </Link>
        <Link to="/pools/join">
          <Button variant="outline" size="sm" className="gap-2">
            <Users className="w-4 h-4" /> Join Pool
          </Button>
        </Link>
      </div>

      {/* My Pools */}
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">My Pools</h2>
      
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="glass-card p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : pools.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">You haven't joined any pools yet.</p>
          <div className="flex gap-3 justify-center">
            <Link to="/pools/create"><Button size="sm">Create One</Button></Link>
            <Link to="/pools/join"><Button variant="outline" size="sm">Join with Code</Button></Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {pools.map((pool, i) => (
            <motion.div
              key={pool.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link to={`/pools/${pool.id}`} className="block">
                <div className="glass-card p-4 hover:bg-card/90 transition-colors group">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-sm">{pool.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {pool.tournaments?.name} {pool.tournaments?.season_year}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`status-pill ${isLocked(pool.lock_time) ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success'}`}>
                        {isLocked(pool.lock_time) ? 'Locked' : 'Open'}
                      </span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
