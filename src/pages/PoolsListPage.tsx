import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Plus, Users, ArrowRight } from 'lucide-react';

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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">My Pools</h1>
        <div className="flex gap-2">
          <Link to="/pools/create"><Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> Create</Button></Link>
          <Link to="/pools/join"><Button variant="outline" size="sm" className="gap-1"><Users className="w-4 h-4" /> Join</Button></Link>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2].map(i => <div key={i} className="glass-card p-4 animate-pulse h-16" />)}</div>
      ) : pools.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No pools yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pools.map(pool => (
            <Link key={pool.id} to={`/pools/${pool.id}`} className="block">
              <div className="glass-card p-4 hover:bg-card/90 transition-colors group">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">{pool.name}</h3>
                    <p className="text-xs text-muted-foreground">{pool.tournaments?.name} {pool.tournaments?.season_year}</p>
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
          ))}
        </div>
      )}
    </div>
  );
}
