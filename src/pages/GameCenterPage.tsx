import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Activity, Clock, CheckCircle2, AlertTriangle, Calendar, Radio, Zap, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameUpdates } from '@/hooks/useRealtimeSubscription';
import { Game, Team, ROUND_NAMES, ROUND_SHORT, FIRST_FOUR_ROUND_SHORT } from '@/lib/bracketUtils';

type TabFilter = 'live' | 'upcoming' | 'final' | 'all';

export default function GameCenterPage() {
  const { poolId } = useParams<{ poolId: string }>();
  const { user } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Map<string, Team>>(new Map());
  const [tournamentId, setTournamentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabFilter>('all');
  const [roundFilter, setRoundFilter] = useState<number | null>(null);
  const [myPicks, setMyPicks] = useState<Map<string, string>>(new Map());
  const [pickCounts, setPickCounts] = useState<Map<string, Map<string, number>>>(new Map());

  const fetchData = useCallback(async () => {
    if (!poolId) return;
    const { data: pool } = await supabase.from('pools').select('tournament_id').eq('id', poolId).single();
    if (!pool) return;
    setTournamentId(pool.tournament_id);

    const [{ data: teamData }, { data: gameData }] = await Promise.all([
      supabase.from('teams').select('*').eq('tournament_id', pool.tournament_id),
      supabase.from('games').select('*').eq('tournament_id', pool.tournament_id).order('round_number').order('game_slot'),
    ]);

    if (teamData) {
      const m = new Map<string, Team>();
      teamData.forEach(t => m.set(t.id, t as Team));
      setTeams(m);
    }
    if (gameData) setGames(gameData as Game[]);

    if (user) {
      const { data: bracket } = await supabase.from('brackets').select('id').eq('pool_id', poolId).eq('user_id', user.id).maybeSingle();
      if (bracket) {
        const { data: picks } = await supabase.from('bracket_picks').select('game_id, picked_team_id').eq('bracket_id', bracket.id);
        if (picks) {
          const pm = new Map<string, string>();
          picks.forEach(p => pm.set(p.game_id, p.picked_team_id));
          setMyPicks(pm);
        }
      }
    }

    const { data: allBrackets } = await supabase.from('brackets').select('id').eq('pool_id', poolId);
    if (allBrackets && allBrackets.length > 0) {
      const bracketIds = allBrackets.map(b => b.id);
      const { data: allPicks } = await supabase.from('bracket_picks').select('game_id, picked_team_id').in('bracket_id', bracketIds);
      if (allPicks) {
        const counts = new Map<string, Map<string, number>>();
        allPicks.forEach(p => {
          if (!counts.has(p.game_id)) counts.set(p.game_id, new Map());
          const gc = counts.get(p.game_id)!;
          gc.set(p.picked_team_id, (gc.get(p.picked_team_id) || 0) + 1);
        });
        setPickCounts(counts);
      }
    }

    setLoading(false);
  }, [poolId, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { status: rtStatus, lastUpdated } = useGameUpdates(tournamentId, fetchData);

  // Auto-poll: call sync-games every 60s when any game is in_progress
  const hasLiveGames = useMemo(() => games.some(g => g.status === 'in_progress'), [games]);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Auto-sync: run once on load, then every 60s if live games exist
  useEffect(() => {
    if (!tournamentId || !poolId) return;

    const doSync = async () => {
      try {
        await supabase.functions.invoke('sync-games', {
          body: { action: 'syncGameResults', tournamentId, poolId },
        });
        setLastSyncTime(new Date());
      } catch (err) {
        console.error('Auto-sync failed:', err);
      }
    };

    // Always sync once on page load
    doSync();

    // Continue polling every 60s only if there are live games
    if (!hasLiveGames) return;
    const interval = setInterval(doSync, 60_000);
    return () => clearInterval(interval);
  }, [hasLiveGames, tournamentId, poolId]);

  const filteredGames = useMemo(() => {
    let filtered = games;
    if (tab === 'live') filtered = filtered.filter(g => g.status === 'in_progress');
    else if (tab === 'upcoming') filtered = filtered.filter(g => g.status === 'scheduled');
    else if (tab === 'final') filtered = filtered.filter(g => g.status === 'final');
    if (roundFilter !== null) filtered = filtered.filter(g => g.round_number === roundFilter);
    return filtered;
  }, [games, tab, roundFilter]);

  const stats = useMemo(() => ({
    live: games.filter(g => g.status === 'in_progress').length,
    upcoming: games.filter(g => g.status === 'scheduled').length,
    final: games.filter(g => g.status === 'final').length,
    total: games.length,
  }), [games]);

  const tabs: { key: TabFilter; label: string; count: number; icon?: React.ReactNode }[] = [
    { key: 'all', label: 'All', count: stats.total },
    { key: 'live', label: 'Live', count: stats.live, icon: <Radio className="w-3 h-3" /> },
    { key: 'upcoming', label: 'Upcoming', count: stats.upcoming, icon: <Clock className="w-3 h-3" /> },
    { key: 'final', label: 'Final', count: stats.final, icon: <CheckCircle2 className="w-3 h-3" /> },
  ];

  const groupedGames = useMemo(() => {
    if (roundFilter !== null) return [{ round: roundFilter, games: filteredGames }];
    const groups: { round: number; games: Game[] }[] = [];
    const roundMap = new Map<number, Game[]>();
    filteredGames.forEach(g => {
      if (!roundMap.has(g.round_number)) roundMap.set(g.round_number, []);
      roundMap.get(g.round_number)!.push(g);
    });
    roundMap.forEach((games, round) => groups.push({ round, games }));
    groups.sort((a, b) => a.round - b.round);
    return groups;
  }, [filteredGames, roundFilter]);

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="loading-spinner-ring" />
        <p className="loading-spinner-text">Loading games…</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-8">
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

        <div className="flex items-center justify-between relative z-10 gap-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{
              background: 'linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.06))',
              boxShadow: '0 0 24px hsl(var(--primary) / 0.12), inset 0 1px 0 hsl(var(--primary) / 0.1)',
            }}>
              <Activity className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">Game Center</h1>
              <p className="text-sm text-muted-foreground font-medium mt-0.5">Live scores & results</p>
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

        {/* Quick stats row */}
        {(stats.live > 0 || stats.final > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex gap-3 mt-5 relative z-10"
          >
            {stats.live > 0 && (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold" style={{
                background: 'linear-gradient(135deg, hsl(var(--live) / 0.12), hsl(var(--live) / 0.04))',
                border: '1px solid hsl(var(--live) / 0.15)',
                color: 'hsl(var(--live))',
              }}>
                <Zap className="w-3.5 h-3.5" />
                {stats.live} Live Now
              </div>
            )}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-muted-foreground" style={{
              background: 'hsl(var(--surface-elevated))',
              border: '1px solid hsl(var(--border) / 0.3)',
            }}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              {stats.final}/{stats.total} Complete
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* ═══ Status Tabs ═══ */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 scrollbar-none">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "relative px-4 py-2.5 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-2 transition-all duration-200",
              tab === t.key
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            style={tab === t.key ? {
              background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
              boxShadow: '0 0 16px hsl(var(--primary) / 0.25), 0 2px 8px rgba(0,0,0,0.2)',
            } : {
              background: 'hsl(var(--surface-elevated))',
              border: '1px solid hsl(var(--border) / 0.3)',
            }}
          >
            {t.icon}
            {t.label}
            <span className={cn(
              "text-[10px] tabular-nums px-1.5 py-0.5 rounded-full font-bold",
              tab === t.key ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
            )}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ═══ Round Filter ═══ */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1 scrollbar-none">
        <RoundPill label="All" active={roundFilter === null} onClick={() => setRoundFilter(null)} />
        {games.some(g => g.round_number === 0) && (
          <RoundPill label={FIRST_FOUR_ROUND_SHORT} active={roundFilter === 0} onClick={() => setRoundFilter(0)} />
        )}
        {ROUND_SHORT.map((name, i) => (
          <RoundPill key={i} label={name} active={roundFilter === i + 1} onClick={() => setRoundFilter(i + 1)} />
        ))}
      </div>

      {/* ═══ Games ═══ */}
      {filteredGames.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Activity /></div>
          <p className="empty-state-title">
            {tab === 'live' ? 'No live games right now' : 'No games match your filters'}
          </p>
          <p className="empty-state-desc">
            {tab === 'live' ? 'Check back when games tip off!' : 'Try adjusting your round or status filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedGames.map(group => (
            <div key={group.round}>
              {roundFilter === null && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 mb-3"
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    {group.round === 0 ? 'First Four' : ROUND_NAMES[group.round - 1]}
                  </span>
                  <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, hsl(var(--border) / 0.4), transparent)' }} />
                  <span className="text-[10px] text-muted-foreground/70 tabular-nums font-medium">{group.games.length}</span>
                </motion.div>
              )}

              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {group.games.map((game, idx) => (
                    <GameCard key={game.id} game={game} teams={teams} myPick={myPicks.get(game.id)} pickCounts={pickCounts.get(game.id)} index={idx} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══ Round Pill ═══ */
function RoundPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all duration-200",
        active
          ? "text-foreground"
          : "text-muted-foreground/60 hover:text-muted-foreground"
      )}
      style={active ? {
        background: 'hsl(var(--surface-elevated))',
        border: '1px solid hsl(var(--border) / 0.5)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
      } : {
        border: '1px solid transparent',
      }}
    >
      {label}
    </button>
  );
}

/* ═══ Game Card ═══ */
function GameCard({ game, teams, myPick, pickCounts, index }: {
  game: Game; teams: Map<string, Team>; myPick?: string; pickCounts?: Map<string, number>; index: number;
}) {
  const team1 = game.team1_id ? teams.get(game.team1_id) : null;
  const team2 = game.team2_id ? teams.get(game.team2_id) : null;
  const isLive = game.status === 'in_progress';
  const isFinal = game.status === 'final';

  const isUpset = isFinal && team1 && team2 && game.winner_team_id &&
    ((game.winner_team_id === team1.id && team1.seed > team2.seed) ||
     (game.winner_team_id === team2.id && team2.seed > team1.seed));

  const myPickCorrect = isFinal && myPick && game.winner_team_id === myPick;
  const myPickWrong = isFinal && myPick && game.winner_team_id && game.winner_team_id !== myPick;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: Math.min(index * 0.025, 0.3), type: 'spring', damping: 25, stiffness: 300 }}
      className="rounded-2xl overflow-hidden relative group"
      style={{
        background: 'hsl(var(--card))',
        border: isLive
          ? '1px solid hsl(var(--live) / 0.25)'
          : '1px solid hsl(var(--border) / 0.4)',
        boxShadow: isLive
          ? '0 0 24px hsl(var(--live) / 0.06), var(--shadow-card)'
          : 'var(--shadow-card)',
        transition: 'border-color 0.25s ease, box-shadow 0.25s ease, transform 0.2s ease',
      }}
    >
      {/* Shine overlay */}
      <div className="absolute inset-0 pointer-events-none rounded-2xl" style={{
        background: 'var(--gradient-card-shine)',
        opacity: 0.5,
      }} />

      {/* ─── Card Header ─── */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 relative z-10 gap-1.5" style={{
        background: isLive
          ? 'linear-gradient(135deg, hsl(var(--live) / 0.06), transparent)'
          : 'hsl(var(--surface) / 0.4)',
        borderBottom: '1px solid hsl(var(--border) / 0.15)',
      }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/70 font-bold tracking-wide">
            {game.round_number === 0 ? FIRST_FOUR_ROUND_SHORT : ROUND_SHORT[game.round_number - 1]}
          </span>
          <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/20" />
          <span className="text-[10px] text-muted-foreground/70 font-medium">{game.region}</span>
          {isUpset && (
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center gap-0.5 text-[9px] font-bold px-2 py-0.5 rounded-full"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--warning) / 0.18), hsl(var(--warning) / 0.06))',
                color: 'hsl(var(--warning))',
                border: '1px solid hsl(var(--warning) / 0.15)',
              }}
            >
              <AlertTriangle className="w-2.5 h-2.5" /> UPSET
            </motion.span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'hsl(var(--live))' }}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50" style={{ background: 'hsl(var(--live))' }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: 'hsl(var(--live))' }} />
              </span>
              {(game as any).live_period ? `${(game as any).live_period} · ${(game as any).live_clock}` : 'LIVE'}
            </span>
          )}
          {isFinal && (
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground/70 uppercase">Final</span>
          )}
          {!isLive && !isFinal && (
            <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/70 font-medium">
              <Calendar className="w-3 h-3" />
              {game.scheduled_at ? new Date(game.scheduled_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'TBD'}
            </span>
          )}
          {myPick && (
            <span className={cn(
              "text-[9px] font-bold px-2 py-0.5 rounded-full",
            )} style={{
              ...(myPickCorrect ? {
                background: 'linear-gradient(135deg, hsl(var(--success) / 0.18), hsl(var(--success) / 0.06))',
                color: 'hsl(var(--success))',
                border: '1px solid hsl(var(--success) / 0.15)',
              } : myPickWrong ? {
                background: 'linear-gradient(135deg, hsl(var(--destructive) / 0.18), hsl(var(--destructive) / 0.06))',
                color: 'hsl(var(--destructive))',
                border: '1px solid hsl(var(--destructive) / 0.15)',
              } : {
                background: 'linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))',
                color: 'hsl(var(--primary))',
                border: '1px solid hsl(var(--primary) / 0.12)',
              }),
            }}>
              {myPickCorrect ? '✓ Correct' : myPickWrong ? '✗ Wrong' : '★ Picked'}
            </span>
          )}
        </div>
      </div>

      {/* ─── Matchup Body ─── */}
      <div className="relative z-10">
        <ScoreRow team={team1} score={game.team1_score} isWinner={game.winner_team_id === team1?.id} isMyPick={myPick === team1?.id} isFinal={isFinal} isLive={isLive} pickCount={team1 ? pickCounts?.get(team1.id) : undefined} />
        <div className="h-px mx-4" style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--border) / 0.2), transparent)' }} />
        <ScoreRow team={team2} score={game.team2_score} isWinner={game.winner_team_id === team2?.id} isMyPick={myPick === team2?.id} isFinal={isFinal} isLive={isLive} pickCount={team2 ? pickCounts?.get(team2.id) : undefined} />
      </div>
    </motion.div>
  );
}

/* ═══ Score Row ═══ */
function ScoreRow({ team, score, isWinner, isMyPick, isFinal, isLive, pickCount }: {
  team: Team | null; score: number | null; isWinner: boolean; isMyPick: boolean; isFinal: boolean; isLive: boolean; pickCount?: number;
}) {
  if (!team) {
    return (
      <div className="flex items-center gap-2 px-4 py-4">
        <span className="w-7" />
        <span className="text-xs text-muted-foreground/70 italic font-medium">TBD</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-3.5 transition-all duration-200 relative",
      isWinner && isFinal && "bg-success/[0.04]",
      !isWinner && isFinal && "opacity-35",
    )} style={isMyPick && !isFinal ? {
      background: 'linear-gradient(90deg, hsl(var(--primary) / 0.04), transparent)',
    } : undefined}>
      {/* Seed */}
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{
        background: 'hsl(var(--surface))',
        border: '1px solid hsl(var(--border) / 0.2)',
      }}>
        <span className="text-[11px] font-mono font-bold text-muted-foreground tabular-nums">
          {team.seed}
        </span>
      </div>

      {/* Team name */}
      <span className={cn(
        "text-sm flex-1 truncate",
        isWinner ? "font-bold text-foreground" : "font-medium text-foreground/80",
        isMyPick && !isFinal && "text-primary font-semibold",
      )}>
        {team.short_name}
      </span>

      {/* My pick star */}
      {isMyPick && (
        <span className="flex items-center justify-center w-5 h-5 rounded-md text-[10px]" style={{
          background: 'hsl(var(--primary) / 0.12)',
          color: 'hsl(var(--primary))',
        }}>★</span>
      )}

      {/* Pick count */}
      {pickCount !== undefined && pickCount > 0 && (
        <span className="text-[10px] tabular-nums font-semibold px-2 py-0.5 rounded-md" style={{
          background: 'hsl(var(--surface))',
          color: 'hsl(var(--muted-foreground))',
          border: '1px solid hsl(var(--border) / 0.2)',
        }}>
          {pickCount}
        </span>
      )}

      {/* Score */}
      {score !== null && (
        <span className={cn(
          "font-mono tabular-nums font-extrabold min-w-[2.5rem] text-right",
          isLive ? "text-xl text-foreground" : "text-lg",
          isWinner ? "text-foreground" : "text-muted-foreground/60",
        )} style={{
          ...(isLive ? { textShadow: '0 0 8px hsl(var(--foreground) / 0.1)' } : {}),
          ...(isWinner && isFinal ? { color: 'hsl(var(--success))' } : {}),
        }}>
          {score}
        </span>
      )}

      {/* Winner check */}
      {isWinner && isFinal && (
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--success))' }} />
      )}
    </div>
  );
}
