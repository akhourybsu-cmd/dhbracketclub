import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Plus, Users, ArrowRight, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function PoolsListPage() {
  const { user } = useAuth();
  const [pools, setPools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchPools = async () => {
      const { data: memberships } = await supabase
        .from('pool_members')
        .select('pool_id')
        .eq('user_id', user.id);

      if (memberships && memberships.length > 0) {
        const poolIds = memberships.map(m => m.pool_id);
        const { data } = await supabase
          .from('pools')
          .select('id, name, invite_code, lock_time, tournaments(name, season_year)')
          .in('id', poolIds);

        if (data) setPools(data);
      }
      setLoading(false);
    };

    fetchPools();
  }, [user]);

  const isLocked = (lt: string) => new Date(lt) <= new Date();

  return (
    <div className="max-w-2xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div className="page-header mb-0">
          <div className="page-header-icon">
            <Users />
          </div>
          <div>
            <h1 className="page-header-title">My Pools</h1>
            <p className="page-header-subtitle">Your bracket competitions</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/pools/create">
            <Button size="sm" className="gap-1.5 rounded-xl font-bold btn-press">
              <Plus className="w-4 h-4" /> Create
            </Button>
          </Link>
          <Link to="/pools/join">
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl font-bold btn-press">
              <Users className="w-4 h-4" /> Join
            </Button>
          </Link>
        </div>
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
            const locked = isLocked(pool.lock_time);
            return (
              <motion.div
                key={pool.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.05, duration: 0.3 }}
              >
                <Link to={`/pools/${pool.id}`} className="block">
                  <div className="glass-card p-4 hover-lift group cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                          locked ? "bg-muted/50" : "bg-primary/10"
                        )}>
                          <Trophy className={cn("w-5 h-5", locked ? "text-muted-foreground" : "text-primary")} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm truncate">{pool.name}</h3>
                          <p className="text-[11px] text-muted-foreground">{pool.tournaments?.name} {pool.tournaments?.season_year}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
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
