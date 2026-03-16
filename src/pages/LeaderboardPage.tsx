import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { ArrowLeft, Trophy, Eye, Crown, Medal, TrendingUp, TrendingDown, Minus, AlertCircle, Award } from 'lucide-react';
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

    const prevRanks = new Map<string, number>();
    if (poolId) {
      const { data: snapshots } = await supabase
        .from('standings_snapshots')
        .select('user_id, rank, snapshot_at')
        .eq('pool_id', poolId)
        .order('snapshot_at', { ascending: false })
        .limit(200);

      if (snapshots && snapshots.length > 0) {
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

  const MovementPill = ({ movement }: { movement: ReturnType<typeof getMovement> }) => {
    if (!movement) return <span className="w-10" />;
    if (movement.direction === 'up') return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-success/15 text-success text-[10px] font-bold tabular-nums">
        <TrendingUp className="w-3 h-3" />{movement.amount}
      </span>
    );
    if (movement.direction === 'down') return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive text-[10px] font-bold tabular-nums">
        <TrendingDown className="w-3 h-3" />{movement.amount}
      </span>
    );
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px]">
        <Minus className="w-3 h-3" />
      </span>
    );
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="loading-spinner-ring" />
        <p className="loading-spinner-text">Loading standings…</p>
      </div>
    );
  }

  const podiumOrder = standings.length >= 3 && standings[0].total_points > 0
    ? [standings[1], standings[0], standings[2]] : null;
  const podiumMeta = [
    { place: 2, color: 'text-silver', bg: 'bg-silver/10', height: 'h-16', icon: Medal },
    { place: 1, color: 'text-gold', bg: 'bg-gold/10', height: 'h-24', icon: Crown },
    { place: 3, color: 'text-bronze', bg: 'bg-bronze/10', height: 'h-12', icon: Medal },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back link */}
      <Link to={`/pools/${poolId}`} className="back-link">
        <ArrowLeft /> Back to Pool
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Leaderboard</h1>
            <p className="text-sm text-muted-foreground">{pool?.name}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {rtStatus === 'connected' && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-success/10 text-success text-[10px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> Live
            </span>
          )}
          {lastUpdated && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Stale data warning */}
      {!lastSyncedAt && isLocked && (
        <div className="glass-card p-3 mb-5 flex items-center gap-2.5 border-warning/30">
          <div className="w-8 h-8 rounded-lg bg-warning/15 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-4 h-4 text-warning" />
          </div>
          <span className="text-xs text-muted-foreground">Standings haven't been synced yet. Scores may not be current.</span>
        </div>
      )}

      {standings.length === 0 ? (
        /* Empty state */
        <div className="glass-card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-base font-semibold text-foreground mb-1">No members yet</p>
          <p className="text-sm text-muted-foreground">Invite friends to join and compete!</p>
        </div>
      ) : (
        <>
          {/* Podium – top 3 */}
          {isLocked && podiumOrder && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-5 mb-5"
            >
              <div className="grid grid-cols-3 gap-3 items-end">
                {podiumOrder.map((s, i) => {
                  const meta = podiumMeta[i];
                  const movement = getMovement(s);
                  const Icon = meta.icon;
                  return (
                    <motion.div
                      key={s.user_id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.1 }}
                      className="flex flex-col items-center text-center"
                    >
                      {/* Avatar */}
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center text-base font-extrabold mb-2 border-2",
                        meta.place === 1 ? "border-gold bg-gold/15 text-gold" :
                        meta.place === 2 ? "border-silver bg-silver/10 text-silver" :
                        "border-bronze bg-bronze/10 text-bronze"
                      )}>
                        {s.display_name[0].toUpperCase()}
                      </div>

                      {/* Name */}
                      <p className="text-xs font-semibold truncate w-full mb-0.5">{s.display_name}</p>

                      {/* Points + movement */}
                      <div className="flex items-center gap-1 mb-2">
                        <span className={cn("text-xl font-extrabold tabular-nums", meta.color)}>{s.total_points}</span>
                      </div>
                      <MovementPill movement={movement} />

                      {/* Podium bar */}
                      <div className={cn(
                        "w-full rounded-t-lg flex items-end justify-center mt-2",
                        meta.bg, meta.height
                      )}>
                        <Icon className={cn("w-5 h-5 mb-2", meta.color)} />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Standings table */}
          <div className="glass-card overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-[2.5rem_1fr_auto_3.5rem_3rem_3.5rem] gap-2 px-4 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/50 bg-muted/30">
              <span className="text-center">#</span>
              <span>Player</span>
              <span className="text-center">Champ</span>
              <span className="text-right">Pts</span>
              <span className="text-right">✓</span>
              <span className="text-right">Poss</span>
            </div>

            {standings.map((s, i) => {
              const movement = getMovement(s);
              const isMe = s.user_id === user?.id;

              return (
                <motion.div
                  key={s.user_id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.4) }}
                  className={cn(
                    "grid grid-cols-[2.5rem_1fr_auto_3.5rem_3rem_3.5rem] gap-2 px-4 py-3 items-center transition-colors",
                    isMe && "bg-primary/5",
                    i < standings.length - 1 && "border-b border-border/20"
                  )}
                >
                  {/* Rank */}
                  <div className="flex flex-col items-center gap-0.5">
                    {s.rank <= 3 ? (
                      <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold",
                        s.rank === 1 && "bg-gold/15 text-gold",
                        s.rank === 2 && "bg-silver/10 text-silver",
                        s.rank === 3 && "bg-bronze/10 text-bronze",
                      )}>
                        {s.rank}
                      </div>
                    ) : (
                      <span className="text-sm font-mono font-bold tabular-nums text-muted-foreground">{s.rank}</span>
                    )}
                  </div>

                  {/* Player name + movement + bracket link */}
                  <div className="min-w-0 flex items-center gap-2">
                    <div className="min-w-0 flex flex-col">
                      <span className={cn(
                        "text-sm font-semibold truncate",
                        isMe && "text-primary"
                      )}>
                        {s.display_name}
                        {isMe && <span className="text-[10px] font-normal text-primary/60 ml-1">(you)</span>}
                      </span>
                    </div>
                    <MovementPill movement={movement} />
                    {isLocked && s.bracket_id && (
                      <Link to={`/pools/${poolId}/bracket/${s.bracket_id}`} className="flex-shrink-0 opacity-40 hover:opacity-100 transition-opacity">
                        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                      </Link>
                    )}
                  </div>

                  {/* Champion pick */}
                  <span className={cn(
                    "text-[11px] font-medium truncate max-w-[5rem] text-center px-1.5 py-0.5 rounded-md",
                    s.champion_team ? "bg-muted/50 text-muted-foreground" : "text-muted-foreground/40"
                  )}>
                    {s.champion_team?.short_name || '—'}
                  </span>

                  {/* Points */}
                  <span className={cn(
                    "text-sm font-extrabold tabular-nums text-right",
                    s.rank === 1 && s.total_points > 0 && "text-gold",
                    s.rank === 2 && s.total_points > 0 && "text-silver",
                    s.rank === 3 && s.total_points > 0 && "text-bronze",
                  )}>
                    {s.total_points}
                  </span>

                  {/* Correct picks */}
                  <span className="text-sm tabular-nums text-right text-muted-foreground">{s.correct_picks}</span>

                  {/* Possible remaining */}
                  <span className="text-sm tabular-nums text-right text-muted-foreground">{s.possible_points_remaining}</span>
                </motion.div>
              );
            })}
          </div>

          {/* Last synced */}
          {lastSyncedAt && (
            <p className="text-[10px] text-muted-foreground text-center mt-4 tabular-nums">
              Last synced: {new Date(lastSyncedAt).toLocaleString()}
            </p>
          )}
        </>
      )}
    </div>
  );
}
