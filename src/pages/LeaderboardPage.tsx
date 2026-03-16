import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { ArrowLeft, Trophy, Eye, Crown, Medal } from 'lucide-react';
import { motion } from 'framer-motion';
import { Team, Pick as BPick, getChampionPick, getBracketDisplayStatus, STATUS_CONFIG, TOTAL_GAMES } from '@/lib/bracketUtils';
import { useStandingsUpdates } from '@/hooks/useRealtimeSubscription';

interface StandingRow {
  user_id: string;
  total_points: number;
  correct_picks: number;
  possible_points_remaining: number;
  rank: number;
  display_name: string;
  bracket_id: string | null;
  bracket_status: string | null;
  champion_team: Team | null;
  displayStatus: string;
}

export default function LeaderboardPage() {
  const { poolId } = useParams<{ poolId: string }>();
  const { user } = useAuth();
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [pool, setPool] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!poolId) return;
    fetchData();
  }, [poolId]);

  const fetchData = useCallback(async () => {
    if (!poolId) return;
      const { data: poolData } = await supabase.from('pools').select('*, tournaments(id, name)').eq('id', poolId).single();
      if (poolData) setPool(poolData);

      // Get teams for champion pick display
      const tid = poolData?.tournaments?.id;
      const teamMap = new Map<string, Team>();
      if (tid) {
        const { data: teamData } = await supabase.from('teams').select('*').eq('tournament_id', tid);
        teamData?.forEach(t => teamMap.set(t.id, t as Team));
      }

      // Get brackets and standings
      const { data: brackets } = await supabase
        .from('brackets')
        .select('id, user_id, status, profiles(display_name)')
        .eq('pool_id', poolId);

      const { data: standingsData } = await supabase
        .from('standings')
        .select('*')
        .eq('pool_id', poolId)
        .order('total_points', { ascending: false });

      // Get champion picks for each bracket
      const bracketMap = new Map<string, any>();
      brackets?.forEach(b => bracketMap.set(b.user_id, b));

      const champPicks = new Map<string, Team | null>();
      if (brackets) {
        for (const b of brackets) {
          const { data: picks } = await supabase
            .from('bracket_picks')
            .select('picked_team_id, picked_in_round')
            .eq('bracket_id', b.id)
            .eq('picked_in_round', 6)
            .limit(1);
          if (picks && picks.length > 0) {
            champPicks.set(b.user_id, teamMap.get(picks[0].picked_team_id) || null);
          }
        }
      }

      // Get members who don't have standings yet
      const { data: members } = await supabase
        .from('pool_members')
        .select('user_id, profiles(display_name)')
        .eq('pool_id', poolId);

      const standingsByUser = new Map<string, any>();
      standingsData?.forEach(s => standingsByUser.set(s.user_id, s));

      const rows: StandingRow[] = (members || []).map((m: any, i: number) => {
        const s = standingsByUser.get(m.user_id);
        const b = bracketMap.get(m.user_id);
        const ds = getBracketDisplayStatus(b?.status || null, poolData?.lock_time || '', 0, TOTAL_GAMES);
        return {
          user_id: m.user_id,
          total_points: s?.total_points || 0,
          correct_picks: s?.correct_picks || 0,
          possible_points_remaining: s?.possible_points_remaining || 0,
          rank: 0,
          display_name: m.profiles?.display_name || 'Unknown',
          bracket_id: b?.id || null,
          bracket_status: b?.status || null,
          champion_team: champPicks.get(m.user_id) || null,
          displayStatus: ds,
        };
      });

      // Sort and rank
      rows.sort((a, b) => b.total_points - a.total_points || b.correct_picks - a.correct_picks);
      rows.forEach((r, i) => { r.rank = i + 1; });

      setStandings(rows);
      setLoading(false);
    };
    fetchData();
  }, [poolId]);

  const isLocked = pool ? new Date(pool.lock_time) <= new Date() : false;

  const getRankDisplay = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-gold" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-silver" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-bronze" />;
    return <span className="text-xs font-mono tabular-nums text-muted-foreground">{rank}</span>;
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <Link to={`/pools/${poolId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Pool
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <Trophy className="w-6 h-6 text-gold" />
        <div>
          <h1 className="text-xl font-bold">Leaderboard</h1>
          <p className="text-sm text-muted-foreground">{pool?.name}</p>
        </div>
      </div>

      {standings.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No members yet.</p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium (if locked and have standings) */}
          {isLocked && standings.length >= 3 && standings[0].total_points > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-6">
              {[standings[1], standings[0], standings[2]].map((s, i) => {
                const order = [2, 1, 3][i];
                const heights = ['h-20', 'h-28', 'h-16'];
                const colors = ['text-silver', 'text-gold', 'text-bronze'];
                return (
                  <motion.div
                    key={s.user_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex flex-col items-center"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary mb-1">
                      {s.display_name[0].toUpperCase()}
                    </div>
                    <p className="text-xs font-medium truncate w-full text-center">{s.display_name}</p>
                    <p className={cn("text-lg font-bold tabular-nums", colors[i])}>{s.total_points}</p>
                    <div className={cn("w-full bg-card rounded-t-lg flex items-end justify-center", heights[i])}>
                      <span className={cn("text-2xl font-black mb-2", colors[i])}>{order}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Full Table */}
          <div className="glass-card overflow-hidden">
            <div className="grid grid-cols-[2rem_1fr_auto_3.5rem_3.5rem_3.5rem] gap-1 px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/50">
              <span>#</span>
              <span>Player</span>
              <span className="text-center">Champ</span>
              <span className="text-right">Pts</span>
              <span className="text-right">✓</span>
              <span className="text-right">Poss</span>
            </div>

            {standings.map((s, i) => {
              const statusCfg = STATUS_CONFIG[s.displayStatus];
              return (
                <motion.div
                  key={s.user_id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className={cn(
                    "grid grid-cols-[2rem_1fr_auto_3.5rem_3.5rem_3.5rem] gap-1 px-3 py-2.5 items-center",
                    s.user_id === user?.id && "bg-primary/5",
                    i < standings.length - 1 && "border-b border-border/20"
                  )}
                >
                  <div className="flex justify-center">{getRankDisplay(s.rank)}</div>
                  <div className="min-w-0 flex items-center gap-2">
                    <span className={cn("text-sm font-medium truncate", s.user_id === user?.id && "text-primary")}>{s.display_name}</span>
                    {isLocked && s.bracket_id && (
                      <Link to={`/pools/${poolId}/bracket/${s.bracket_id}`}>
                        <Eye className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground flex-shrink-0" />
                      </Link>
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[4rem] text-center">
                    {s.champion_team?.short_name || '—'}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-right">{s.total_points}</span>
                  <span className="text-sm tabular-nums text-right text-muted-foreground">{s.correct_picks}</span>
                  <span className="text-sm tabular-nums text-right text-muted-foreground">{s.possible_points_remaining}</span>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
