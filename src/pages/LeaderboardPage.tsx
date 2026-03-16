import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { ArrowLeft, Trophy, Eye, Crown, Medal, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Team, getBracketDisplayStatus, STATUS_CONFIG, TOTAL_GAMES } from '@/lib/bracketUtils';
import { useStandingsUpdates } from '@/hooks/useRealtimeSubscription';

interface StandingRow {
  user_id: string;
  total_points: number;
  correct_picks: number;
  possible_points_remaining: number;
  rank: number;
  previousRank: number | null;
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
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const previousRanksRef = useRef<Map<string, number>>(new Map());

  const fetchData = useCallback(async () => {
    if (!poolId) return;
    const { data: poolData } = await supabase.from('pools').select('*, tournaments(id, name, last_synced_at)').eq('id', poolId).single();
    if (poolData) {
      setPool(poolData);
      setLastSyncedAt((poolData as any).tournaments?.last_synced_at || null);
    }

    const tid = (poolData as any)?.tournaments?.id;
    const teamMap = new Map<string, Team>();
    if (tid) {
      const { data: teamData } = await supabase.from('teams').select('*').eq('tournament_id', tid);
      teamData?.forEach(t => teamMap.set(t.id, t as Team));
    }

    const { data: brackets } = await supabase
      .from('brackets')
      .select('id, user_id, status, profiles(display_name)')
      .eq('pool_id', poolId);

    const { data: standingsData } = await supabase
      .from('standings')
      .select('*')
      .eq('pool_id', poolId)
      .order('total_points', { ascending: false });

    const bracketMap = new Map<string, any>();
    brackets?.forEach(b => bracketMap.set(b.user_id, b));

    // Get champion picks
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

    // Get previous ranks from snapshots (second-to-last snapshot per user)
    const prevRanks = new Map<string, number>();
    if (poolId) {
      const { data: snapshots } = await supabase
        .from('standings_snapshots')
        .select('user_id, rank, snapshot_at')
        .eq('pool_id', poolId)
        .order('snapshot_at', { ascending: false })
        .limit(200);

      if (snapshots && snapshots.length > 0) {
        // Group by user, take second entry (previous snapshot)
        const userSnapshots = new Map<string, any[]>();
        snapshots.forEach(s => {
          if (!userSnapshots.has(s.user_id)) userSnapshots.set(s.user_id, []);
          userSnapshots.get(s.user_id)!.push(s);
        });
        userSnapshots.forEach((snaps, userId) => {
          if (snaps.length >= 2) {
            prevRanks.set(userId, snaps[1].rank);
          }
        });
      }
    }

    // Fallback: use in-memory previous ranks
    const effectivePrevRanks = prevRanks.size > 0 ? prevRanks : previousRanksRef.current;

    const { data: members } = await supabase
      .from('pool_members')
      .select('user_id, profiles(display_name)')
      .eq('pool_id', poolId);

    const standingsByUser = new Map<string, any>();
    standingsData?.forEach(s => standingsByUser.set(s.user_id, s));

    const rows: StandingRow[] = (members || []).map((m: any) => {
      const s = standingsByUser.get(m.user_id);
      const b = bracketMap.get(m.user_id);
      const ds = getBracketDisplayStatus(b?.status || null, poolData?.lock_time || '', 0, TOTAL_GAMES);
      const currentRank = s?.rank || 0;
      const prevRank = effectivePrevRanks.get(m.user_id) ?? null;
      return {
        user_id: m.user_id,
        total_points: s?.total_points || 0,
        correct_picks: s?.correct_picks || 0,
        possible_points_remaining: s?.possible_points_remaining || 0,
        rank: currentRank,
        previousRank: prevRank,
        display_name: m.profiles?.display_name || 'Unknown',
        bracket_id: b?.id || null,
        bracket_status: b?.status || null,
        champion_team: champPicks.get(m.user_id) || null,
        displayStatus: ds,
      };
    });

    rows.sort((a, b) => b.total_points - a.total_points || b.correct_picks - a.correct_picks);
    let rank = 1;
    rows.forEach((r, i) => {
      if (i > 0 && r.total_points < rows[i - 1].total_points) rank = i + 1;
      r.rank = rank;
    });

    // Store current ranks for next comparison
    const newPrevRanks = new Map<string, number>();
    rows.forEach(r => newPrevRanks.set(r.user_id, r.rank));
    previousRanksRef.current = newPrevRanks;

    setStandings(rows);
    setLoading(false);
  }, [poolId]);

  useEffect(() => { if (poolId) fetchData(); }, [poolId, fetchData]);

  const { status: rtStatus, lastUpdated } = useStandingsUpdates(poolId, fetchData);

  const isLocked = pool ? new Date(pool.lock_time) <= new Date() : false;

  const getMovement = (row: StandingRow) => {
    if (row.previousRank === null || row.total_points === 0) return null;
    const diff = row.previousRank - row.rank;
    if (diff > 0) return { direction: 'up' as const, amount: diff };
    if (diff < 0) return { direction: 'down' as const, amount: Math.abs(diff) };
    return { direction: 'same' as const, amount: 0 };
  };

  const getRankDisplay = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-gold" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-silver" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-bronze" />;
    return <span className="text-xs font-mono tabular-nums text-muted-foreground">{rank}</span>;
  };

  const MovementIndicator = ({ movement }: { movement: ReturnType<typeof getMovement> }) => {
    if (!movement) return null;
    if (movement.direction === 'up') return (
      <span className="flex items-center gap-0.5 text-[10px] text-success font-bold">
        <TrendingUp className="w-3 h-3" /> {movement.amount}
      </span>
    );
    if (movement.direction === 'down') return (
      <span className="flex items-center gap-0.5 text-[10px] text-destructive font-bold">
        <TrendingDown className="w-3 h-3" /> {movement.amount}
      </span>
    );
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <Link to={`/pools/${poolId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Pool
      </Link>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-gold" />
          <div>
            <h1 className="text-xl font-bold">Leaderboard</h1>
            <p className="text-sm text-muted-foreground">{pool?.name}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          {rtStatus === 'connected' && (
            <span className="flex items-center gap-1 text-[10px] text-success">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> Live
            </span>
          )}
          {lastUpdated && (
            <span className="text-[9px] text-muted-foreground">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Stale data warning */}
      {!lastSyncedAt && isLocked && (
        <div className="glass-card p-3 mb-4 flex items-center gap-2 border border-warning/30">
          <AlertCircle className="w-4 h-4 text-warning flex-shrink-0" />
          <span className="text-xs text-warning">Standings have not been synced yet. Scores may not be current.</span>
        </div>
      )}

      {standings.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No members yet.</p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          {isLocked && standings.length >= 3 && standings[0].total_points > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-6">
              {[standings[1], standings[0], standings[2]].map((s, i) => {
                const order = [2, 1, 3][i];
                const heights = ['h-20', 'h-28', 'h-16'];
                const colors = ['text-silver', 'text-gold', 'text-bronze'];
                const movement = getMovement(s);
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
                    <div className="flex items-center gap-1">
                      <p className={cn("text-lg font-bold tabular-nums", colors[i])}>{s.total_points}</p>
                      <MovementIndicator movement={movement} />
                    </div>
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
            <div className="grid grid-cols-[2rem_1rem_1fr_auto_3.5rem_3.5rem_3.5rem] gap-1 px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/50">
              <span>#</span>
              <span></span>
              <span>Player</span>
              <span className="text-center">Champ</span>
              <span className="text-right">Pts</span>
              <span className="text-right">✓</span>
              <span className="text-right">Poss</span>
            </div>

            {standings.map((s, i) => {
              const movement = getMovement(s);
              return (
                <motion.div
                  key={s.user_id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className={cn(
                    "grid grid-cols-[2rem_1rem_1fr_auto_3.5rem_3.5rem_3.5rem] gap-1 px-3 py-2.5 items-center",
                    s.user_id === user?.id && "bg-primary/5",
                    i < standings.length - 1 && "border-b border-border/20"
                  )}
                >
                  <div className="flex justify-center">{getRankDisplay(s.rank)}</div>
                  <div className="flex justify-center"><MovementIndicator movement={movement} /></div>
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

          {/* Last synced */}
          {lastSyncedAt && (
            <p className="text-[10px] text-muted-foreground text-center mt-3">
              Last synced: {new Date(lastSyncedAt).toLocaleString()}
            </p>
          )}
        </>
      )}
    </div>
  );
}
