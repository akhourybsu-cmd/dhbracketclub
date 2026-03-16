import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Activity, Clock, CheckCircle2, Zap, AlertTriangle, Calendar, Radio } from 'lucide-react';
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
    { key: 'all', label: 'All Games', count: stats.total },
    { key: 'live', label: 'Live', count: stats.live, icon: <Radio className="w-3 h-3" /> },
    { key: 'upcoming', label: 'Upcoming', count: stats.upcoming, icon: <Clock className="w-3 h-3" /> },
    { key: 'final', label: 'Final', count: stats.final, icon: <CheckCircle2 className="w-3 h-3" /> },
  ];

  // Group filtered games by round for section headers
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
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Game Center</h1>
            <p className="text-sm text-muted-foreground">Live scores & results</p>
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
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-none">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5",
              tab === t.key
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-card text-muted-foreground hover:text-foreground border border-border/50"
            )}
          >
            {t.icon}
            {t.label}
            <span className={cn(
              "text-[10px] tabular-nums px-1.5 py-0.5 rounded-full",
              tab === t.key ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Round filter pills */}
      <div className="flex gap-1 mb-5 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setRoundFilter(null)}
          className={cn(
            "px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors",
            roundFilter === null ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          All Rounds
        </button>
        {games.some(g => g.round_number === 0) && (
          <button
            onClick={() => setRoundFilter(0)}
            className={cn(
              "px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors",
              roundFilter === 0 ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {FIRST_FOUR_ROUND_SHORT}
          </button>
        )}
        {ROUND_SHORT.map((name, i) => (
          <button
            key={i}
            onClick={() => setRoundFilter(i + 1)}
            className={cn(
              "px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors",
              roundFilter === i + 1 ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Games */}
      {filteredGames.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-base font-semibold text-foreground mb-1">
            {tab === 'live' ? 'No live games right now' : 'No games match your filters'}
          </p>
          <p className="text-sm text-muted-foreground">
            {tab === 'live' ? 'Check back when games tip off!' : 'Try adjusting your round or status filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedGames.map(group => (
            <div key={group.round}>
              {/* Round section header */}
              {roundFilter === null && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="section-header mb-0">
                    {group.round === 0 ? 'First Four' : ROUND_NAMES[group.round - 1]}
                  </span>
                  <div className="flex-1 h-px bg-border/30" />
                  <span className="text-[10px] text-muted-foreground tabular-nums">{group.games.length} games</span>
                </div>
              )}

              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {group.games.map((game, idx) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      teams={teams}
                      myPick={myPicks.get(game.id)}
                      pickCounts={pickCounts.get(game.id)}
                      index={idx}
                    />
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

/* ─── Game Card ─── */

function GameCard({
  game,
  teams,
  myPick,
  pickCounts,
  index,
}: {
  game: Game;
  teams: Map<string, Team>;
  myPick?: string;
  pickCounts?: Map<string, number>;
  index: number;
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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: Math.min(index * 0.02, 0.3) }}
      className={cn(
        "glass-card overflow-hidden transition-all",
        isLive && "ring-1 ring-live/40 shadow-[0_0_16px_hsl(var(--live)/0.1)]"
      )}
    >
      {/* Status header */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-muted/20 border-b border-border/30">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-medium tracking-wide">
            {game.round_number === 0 ? FIRST_FOUR_ROUND_SHORT : ROUND_SHORT[game.round_number - 1]}
          </span>
          <span className="w-1 h-1 rounded-full bg-border" />
          <span className="text-[10px] text-muted-foreground">{game.region}</span>
          {isUpset && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-warning bg-warning/15 px-1.5 py-0.5 rounded-full">
              <AlertTriangle className="w-2.5 h-2.5" /> UPSET
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-live">
              <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse" />
              {(game as any).live_period ? `${(game as any).live_period} · ${(game as any).live_clock}` : 'LIVE'}
            </span>
          )}
          {isFinal && (
            <span className="text-[10px] font-bold text-muted-foreground tracking-wider">FINAL</span>
          )}
          {!isLive && !isFinal && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {game.scheduled_at ? new Date(game.scheduled_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'TBD'}
            </span>
          )}
          {myPick && (
            <span className={cn(
              "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
              myPickCorrect && "bg-success/15 text-success",
              myPickWrong && "bg-destructive/15 text-destructive",
              !isFinal && "bg-primary/10 text-primary"
            )}>
              {myPickCorrect ? '✓ Correct' : myPickWrong ? '✗ Wrong' : '★ Picked'}
            </span>
          )}
        </div>
      </div>

      {/* Team rows */}
      <div>
        <ScoreRow
          team={team1}
          score={game.team1_score}
          isWinner={game.winner_team_id === team1?.id}
          isMyPick={myPick === team1?.id}
          isFinal={isFinal}
          isLive={isLive}
          pickCount={team1 ? pickCounts?.get(team1.id) : undefined}
        />
        <div className="h-px bg-border/20 mx-3" />
        <ScoreRow
          team={team2}
          score={game.team2_score}
          isWinner={game.winner_team_id === team2?.id}
          isMyPick={myPick === team2?.id}
          isFinal={isFinal}
          isLive={isLive}
          pickCount={team2 ? pickCounts?.get(team2.id) : undefined}
        />
      </div>
    </motion.div>
  );
}

/* ─── Score Row ─── */

function ScoreRow({
  team,
  score,
  isWinner,
  isMyPick,
  isFinal,
  isLive,
  pickCount,
}: {
  team: Team | null;
  score: number | null;
  isWinner: boolean;
  isMyPick: boolean;
  isFinal: boolean;
  isLive: boolean;
  pickCount?: number;
}) {
  if (!team) {
    return (
      <div className="flex items-center gap-2 px-3.5 py-3">
        <span className="w-6" />
        <span className="text-xs text-muted-foreground/50 italic">TBD</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-2.5 px-3.5 py-3 transition-all",
      isWinner && "bg-success/5",
      !isWinner && isFinal && "opacity-45"
    )}>
      {/* Seed */}
      <span className="text-[11px] font-mono font-bold text-muted-foreground w-6 tabular-nums text-center flex-shrink-0">
        {team.seed}
      </span>

      {/* Team name */}
      <span className={cn(
        "text-sm flex-1 truncate",
        isWinner ? "font-bold text-foreground" : "font-medium",
        isMyPick && !isFinal && "text-primary",
      )}>
        {team.short_name}
      </span>

      {/* My pick star */}
      {isMyPick && (
        <span className="text-[10px] text-primary">★</span>
      )}

      {/* Pick counts */}
      {pickCount !== undefined && pickCount > 0 && (
        <span className="text-[10px] text-muted-foreground tabular-nums bg-muted/50 px-1.5 py-0.5 rounded">
          {pickCount}
        </span>
      )}

      {/* Score */}
      {score !== null && (
        <span className={cn(
          "text-base font-mono tabular-nums font-extrabold min-w-[2rem] text-right",
          isLive && "text-foreground",
          isWinner ? "text-foreground" : "text-muted-foreground"
        )}>
          {score}
        </span>
      )}

      {/* Winner check */}
      {isWinner && <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />}
    </div>
  );
}
