import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { ArrowLeft, Trophy, Eye, Crown, Medal, TrendingUp, TrendingDown, Minus, AlertCircle, Zap } from 'lucide-react';
import dhMonogram from '@/assets/dh-monogram.png';
import { motion, AnimatePresence } from 'framer-motion';
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
    if (brackets && brackets.length > 0) {
      const bracketIds = brackets.map(b => b.id);
      const { data: allChampPicks } = await supabase
        .from('bracket_picks')
        .select('bracket_id, picked_team_id')
        .in('bracket_id', bracketIds)
        .eq('picked_in_round', 6);
      if (allChampPicks) {
        const bracketUserMap = new Map<string, string>();
        brackets.forEach(b => bracketUserMap.set(b.id, b.user_id));
        allChampPicks.forEach(p => {
          const userId = bracketUserMap.get(p.bracket_id);
          if (userId) champPicks.set(userId, teamMap.get(p.picked_team_id) || null);
        });
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
          if (snaps.length >= 2) prevRanks.set(userId, snaps[1].rank);
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
        user_id: m.user_id, total_points: s?.total_points || 0, correct_picks: s?.correct_picks || 0,
        possible_points_remaining: s?.possible_points_remaining || 0, rank: currentRank, previousRank: prevRank,
        display_name: m.profiles?.display_name || 'Unknown', bracket_id: b?.id || null,
        bracket_status: b?.status || null, champion_team: champPicks.get(m.user_id) || null, displayStatus: ds,
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
    if (!movement) return <span className="w-8" />;
    if (movement.direction === 'up') return (
      <motion.span
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums"
        style={{
          background: 'linear-gradient(135deg, hsl(var(--success) / 0.18), hsl(var(--success) / 0.08))',
          color: 'hsl(var(--success))',
          boxShadow: '0 0 8px hsl(var(--success) / 0.1)',
        }}
      >
        <TrendingUp className="w-3 h-3" />{movement.amount}
      </motion.span>
    );
    if (movement.direction === 'down') return (
      <motion.span
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums"
        style={{
          background: 'linear-gradient(135deg, hsl(var(--destructive) / 0.18), hsl(var(--destructive) / 0.08))',
          color: 'hsl(var(--destructive))',
        }}
      >
        <TrendingDown className="w-3 h-3" />{movement.amount}
      </motion.span>
    );
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground text-[10px]">
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
    { place: 2, colorVar: 'silver', height: 'h-14', icon: Medal, label: '2nd' },
    { place: 1, colorVar: 'gold', height: 'h-24', icon: Crown, label: '1st' },
    { place: 3, colorVar: 'bronze', height: 'h-10', icon: Medal, label: '3rd' },
  ];

  const leader = standings[0];

  return (
    <div className="max-w-2xl mx-auto pb-8">
      <Link to={`/pools/${poolId}`} className="back-link">
        <ArrowLeft /> Back to Pool
      </Link>

      {/* ═══ Hero Header ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative mb-8"
      >
        {/* Ambient glow */}
        <div className="absolute -inset-x-4 -top-8 -bottom-4 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 70% 60% at 50% 0%, hsl(var(--primary) / 0.06), transparent)',
        }} />

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{
              background: 'linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.04))',
              boxShadow: '0 0 24px hsl(var(--primary) / 0.12)',
            }}>
              <img src={dhMonogram} alt="DH" className="w-8 h-8 object-contain" style={{ filter: 'drop-shadow(0 0 6px hsl(var(--primary) / 0.2))' }} />
            </div>
            <div>
              <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">Leaderboard</h1>
              <p className="text-sm text-muted-foreground font-medium mt-0.5">{pool?.name}</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {rtStatus === 'connected' && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: 'linear-gradient(135deg, hsl(var(--success) / 0.15), hsl(var(--success) / 0.05))',
                  color: 'hsl(var(--success))',
                  border: '1px solid hsl(var(--success) / 0.15)',
                }}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50" style={{ background: 'hsl(var(--success))' }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: 'hsl(var(--success))' }} />
                </span>
                Live
              </motion.div>
            )}
            {lastUpdated && (
              <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* Leader callout — show when there's a clear leader */}
        {isLocked && leader && leader.total_points > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-5 rounded-xl p-4 flex items-center gap-4 relative z-10"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--gold) / 0.06), hsl(var(--gold) / 0.02))',
              border: '1px solid hsl(var(--gold) / 0.12)',
              boxShadow: '0 0 20px hsl(var(--gold) / 0.04)',
            }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-extrabold"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--gold) / 0.2), hsl(var(--gold) / 0.08))',
                color: 'hsl(var(--gold))',
                boxShadow: '0 0 12px hsl(var(--gold) / 0.1)',
              }}
            >
              {leader.display_name[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold truncate">{leader.display_name}</span>
                <Crown className="w-3.5 h-3.5 text-gold flex-shrink-0" />
              </div>
              <span className="text-xs text-muted-foreground">
                {leader.champion_team ? `Champion: ${leader.champion_team.short_name}` : 'Current leader'}
              </span>
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold tabular-nums text-gold">{leader.total_points}</div>
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Points</div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Stale warning */}
      {!lastSyncedAt && isLocked && (
        <div className="glass-card p-3.5 mb-6 flex items-center gap-3" style={{ borderColor: 'hsl(var(--warning) / 0.2)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(var(--warning) / 0.1)' }}>
            <AlertCircle className="w-4 h-4 text-warning" />
          </div>
          <span className="text-xs text-muted-foreground relative z-10">Standings haven't been synced yet. Scores may not be current.</span>
        </div>
      )}

      {standings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Trophy /></div>
          <p className="empty-state-title">No members yet</p>
          <p className="empty-state-desc">Invite friends to join and compete!</p>
        </div>
      ) : (
        <>
          {/* ═══ Podium ═══ */}
          {isLocked && podiumOrder && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-6 rounded-2xl p-6 pb-2 relative overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, hsl(var(--surface-elevated)), hsl(var(--card)))',
                border: '1px solid hsl(var(--border) / 0.5)',
                boxShadow: 'var(--shadow-elevated)',
              }}
            >
              {/* Subtle crown glow behind center */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-32 pointer-events-none" style={{
                background: 'radial-gradient(ellipse at center, hsl(var(--gold) / 0.06), transparent 70%)',
              }} />

              <div className="grid grid-cols-3 gap-3 items-end relative z-10">
                {podiumOrder.map((s, i) => {
                  const meta = podiumMeta[i];
                  const movement = getMovement(s);
                  const Icon = meta.icon;
                  const isCenter = meta.place === 1;

                  return (
                    <motion.div
                      key={s.user_id}
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.12, type: 'spring', damping: 20 }}
                      className="flex flex-col items-center text-center"
                    >
                      {/* Avatar */}
                      <div className={cn(
                        "rounded-full flex items-center justify-center font-extrabold relative",
                        isCenter ? "w-16 h-16 text-xl mb-3" : "w-12 h-12 text-base mb-2"
                      )} style={{
                        background: `linear-gradient(135deg, hsl(var(--${meta.colorVar}) / 0.2), hsl(var(--${meta.colorVar}) / 0.06))`,
                        border: `2px solid hsl(var(--${meta.colorVar}) / 0.35)`,
                        color: `hsl(var(--${meta.colorVar}))`,
                        boxShadow: isCenter ? `0 0 20px hsl(var(--${meta.colorVar}) / 0.12)` : 'none',
                      }}>
                        {s.display_name[0].toUpperCase()}
                        {isCenter && (
                          <div className="absolute -top-2.5 -right-1">
                            <Crown className="w-4 h-4 text-gold" style={{ filter: 'drop-shadow(0 0 4px hsl(var(--gold) / 0.3))' }} />
                          </div>
                        )}
                      </div>

                      {/* Name */}
                      <p className={cn(
                        "font-semibold truncate w-full",
                        isCenter ? "text-sm" : "text-xs"
                      )}>{s.display_name}</p>

                      {/* Champion pick */}
                      {s.champion_team && (
                        <span className="text-[10px] text-muted-foreground mt-0.5 truncate w-full">
                          {s.champion_team.short_name}
                        </span>
                      )}

                      {/* Points */}
                      <div className={cn(
                        "font-extrabold tabular-nums mt-1.5",
                        isCenter ? "text-3xl" : "text-xl"
                      )} style={{ color: `hsl(var(--${meta.colorVar}))` }}>
                        {s.total_points}
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground mt-0.5">pts</span>

                      {/* Movement */}
                      <div className="mt-2">
                        <MovementPill movement={movement} />
                      </div>

                      {/* Podium bar */}
                      <div className={cn("w-full rounded-t-xl mt-3", meta.height)} style={{
                        background: `linear-gradient(to top, hsl(var(--${meta.colorVar}) / 0.12), hsl(var(--${meta.colorVar}) / 0.03))`,
                        borderTop: `2px solid hsl(var(--${meta.colorVar}) / 0.25)`,
                      }}>
                        <div className="flex items-end justify-center h-full pb-1.5">
                          <Icon className="w-4 h-4" style={{ color: `hsl(var(--${meta.colorVar}))`, opacity: 0.7 }} />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ═══ Standings Table ═══ */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl overflow-hidden relative"
            style={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border) / 0.5)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            {/* Shine overlay */}
            <div className="absolute inset-0 pointer-events-none rounded-2xl" style={{
              background: 'var(--gradient-card-shine)',
            }} />

             {/* Table header */}
            <div
              className="grid grid-cols-[1.75rem_1fr_3.5rem_2.5rem_2rem] sm:grid-cols-[2rem_1fr_4.5rem_3.5rem_2.5rem] gap-1 sm:gap-1.5 px-3 sm:px-4 py-2.5 relative z-10"
              style={{
                background: 'linear-gradient(180deg, hsl(var(--surface-elevated)), hsl(var(--surface)))',
                borderBottom: '1px solid hsl(var(--border) / 0.3)',
              }}
            >
              <span className="text-[8px] font-bold text-muted-foreground/70 uppercase tracking-[0.15em] text-center">#</span>
              <span className="text-[8px] font-bold text-muted-foreground/70 uppercase tracking-[0.15em]">Player</span>
              <span className="text-[8px] font-bold text-muted-foreground/70 uppercase tracking-[0.15em] text-center">Champ</span>
              <span className="text-[8px] font-bold text-muted-foreground/70 uppercase tracking-[0.15em] text-right">Pts</span>
              <span className="text-[8px] font-bold text-muted-foreground/70 uppercase tracking-[0.15em] text-right">✓</span>
            </div>

            {/* Rows */}
            <AnimatePresence mode="popLayout">
              {standings.map((s, i) => {
                const movement = getMovement(s);
                const isMe = s.user_id === user?.id;
                const isTop3 = s.rank <= 3 && s.total_points > 0;

                return (
                  <motion.div
                    key={s.user_id}
                    layout
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.025, 0.4), type: 'spring', damping: 28, stiffness: 320 }}
                    className={cn(
                      "grid grid-cols-[1.75rem_1fr_3.5rem_2.5rem_2rem] sm:grid-cols-[2rem_1fr_4.5rem_3.5rem_2.5rem] gap-1 sm:gap-1.5 px-3 sm:px-4 items-center relative z-10 group transition-colors duration-200",
                      isMe ? "py-3.5" : "py-3",
                      i < standings.length - 1 && "border-b border-border/25",
                    )}
                    style={{
                      ...(isMe ? {
                        background: 'linear-gradient(90deg, hsl(var(--primary) / 0.05), transparent)',
                        borderLeft: '2px solid hsl(var(--primary) / 0.35)',
                      } : {}),
                    }}
                  >
                    {/* Rank */}
                    <div className="flex justify-center">
                      {isTop3 ? (
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-extrabold" style={{
                          background: `linear-gradient(135deg, hsl(var(--${s.rank === 1 ? 'gold' : s.rank === 2 ? 'silver' : 'bronze'}) / 0.18), hsl(var(--${s.rank === 1 ? 'gold' : s.rank === 2 ? 'silver' : 'bronze'}) / 0.05))`,
                          color: `hsl(var(--${s.rank === 1 ? 'gold' : s.rank === 2 ? 'silver' : 'bronze'}))`,
                          boxShadow: s.rank === 1 ? '0 0 8px hsl(var(--gold) / 0.1)' : 'none',
                          border: `1px solid hsl(var(--${s.rank === 1 ? 'gold' : s.rank === 2 ? 'silver' : 'bronze'}) / 0.12)`,
                        }}>
                          {s.rank}
                        </div>
                      ) : (
                        <span className="text-[13px] font-mono font-bold tabular-nums text-muted-foreground/60">{s.rank}</span>
                      )}
                    </div>

                    {/* Player info */}
                    <div className="min-w-0 flex items-center gap-2">
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0",
                      )} style={{
                        background: isMe
                          ? 'linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--primary) / 0.04))'
                          : 'hsl(var(--surface-elevated))',
                        color: isMe ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.5)',
                        border: isMe ? '1px solid hsl(var(--primary) / 0.12)' : '1px solid hsl(var(--border) / 0.2)',
                      }}>
                        {s.display_name[0].toUpperCase()}
                      </div>

                      <div className="min-w-0 flex flex-col">
                        <div className="flex items-center gap-1">
                          <span className={cn(
                            "text-[13px] font-semibold truncate",
                            isMe && "text-primary"
                          )}>
                            {s.display_name}
                          </span>
                          {isMe && (
                            <span className="text-[8px] font-bold uppercase tracking-wider text-primary/40">You</span>
                          )}
                        </div>
                        <MovementPill movement={movement} />
                      </div>

                      {isLocked && s.bracket_id && (
                        <Link
                          to={`/pools/${poolId}/bracket/${s.bracket_id}`}
                          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center opacity-60 hover:opacity-100 active:scale-95 transition-all duration-200"
                          style={{
                            background: 'hsl(var(--surface-elevated))',
                            border: '1px solid hsl(var(--border) / 0.2)',
                          }}
                        >
                          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                        </Link>
                      )}
                    </div>

                    {/* Champion pick */}
                    <div className="flex justify-center">
                      {s.champion_team ? (
                        <span className="text-[10px] font-semibold truncate px-2 py-0.5 rounded-md max-w-full"
                          style={{
                            background: 'hsl(var(--surface) / 0.8)',
                            color: 'hsl(var(--foreground) / 0.5)',
                            border: '1px solid hsl(var(--border) / 0.2)',
                          }}
                        >
                          {s.champion_team.short_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/65 text-xs">—</span>
                      )}
                    </div>

                    {/* Points — bold and prominent */}
                    <div className="text-right">
                      <span className={cn(
                        "text-[15px] font-extrabold font-mono tabular-nums",
                        isTop3 && s.rank === 1 && "text-gold",
                        isTop3 && s.rank === 2 && "text-silver",
                        isTop3 && s.rank === 3 && "text-bronze",
                        !isTop3 && "text-foreground",
                      )} style={{
                        ...(s.rank === 1 && s.total_points > 0 ? { textShadow: '0 0 10px hsl(var(--gold) / 0.15)' } : {}),
                      }}>
                        {s.total_points}
                      </span>
                    </div>

                    {/* Correct picks */}
                    <span className="text-[11px] tabular-nums text-right text-muted-foreground/60 font-mono font-medium">{s.correct_picks}</span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>

          {/* Member count — minimal */}
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-[9px] text-muted-foreground/70 font-medium">
              {standings.length} {standings.length === 1 ? 'member' : 'members'}
            </span>
            {lastSyncedAt && (
              <span className="text-[9px] text-muted-foreground/70 tabular-nums">
                Synced {new Date(lastSyncedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
