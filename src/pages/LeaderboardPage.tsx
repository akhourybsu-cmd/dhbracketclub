import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { ArrowLeft, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';

interface Standing {
  user_id: string;
  total_points: number;
  correct_picks: number;
  possible_points_remaining: number;
  rank: number | null;
  display_name: string;
}

export default function LeaderboardPage() {
  const { poolId } = useParams<{ poolId: string }>();
  const { user } = useAuth();
  const [standings, setStandings] = useState<Standing[]>([]);
  const [poolName, setPoolName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!poolId) return;

    const fetchData = async () => {
      const { data: pool } = await supabase.from('pools').select('name').eq('id', poolId).single();
      if (pool) setPoolName(pool.name);

      const { data } = await supabase
        .from('standings')
        .select('*, profiles(display_name)')
        .eq('pool_id', poolId)
        .order('total_points', { ascending: false });

      if (data) {
        setStandings(data.map((s: any, i: number) => ({
          ...s,
          display_name: s.profiles?.display_name || 'Unknown',
          rank: i + 1,
        })));
      }
      setLoading(false);
    };

    fetchData();
  }, [poolId]);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-4 h-4 text-gold" />;
    if (rank === 2) return <Trophy className="w-4 h-4 text-silver" />;
    if (rank === 3) return <Trophy className="w-4 h-4 text-bronze" />;
    return <span className="text-xs font-mono tabular-nums text-muted-foreground w-4 text-center">{rank}</span>;
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <Link to={`/pools/${poolId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Pool
      </Link>

      <h1 className="text-xl font-bold mb-1">Leaderboard</h1>
      <p className="text-sm text-muted-foreground mb-6">{poolName}</p>

      {standings.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No standings yet. Results will appear after games are scored.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[2rem_1fr_4rem_4rem_4rem] gap-2 px-4 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/50">
            <span>#</span>
            <span>Player</span>
            <span className="text-right">Pts</span>
            <span className="text-right">Correct</span>
            <span className="text-right">Possible</span>
          </div>

          {standings.map((s, i) => (
            <motion.div
              key={s.user_id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className={cn(
                "grid grid-cols-[2rem_1fr_4rem_4rem_4rem] gap-2 px-4 py-3 items-center",
                s.user_id === user?.id && "bg-primary/5",
                i < standings.length - 1 && "border-b border-border/30"
              )}
            >
              <div className="flex justify-center">{getRankIcon(s.rank || i + 1)}</div>
              <span className={cn("text-sm font-medium truncate", s.user_id === user?.id && "text-primary")}>{s.display_name}</span>
              <span className="text-sm font-bold tabular-nums text-right">{s.total_points}</span>
              <span className="text-sm tabular-nums text-right text-muted-foreground">{s.correct_picks}</span>
              <span className="text-sm tabular-nums text-right text-muted-foreground">{s.possible_points_remaining}</span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
