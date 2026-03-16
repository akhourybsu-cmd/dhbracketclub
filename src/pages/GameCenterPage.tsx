import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Activity, Clock, CheckCircle2, Zap, Filter, ChevronRight, AlertTriangle } from 'lucide-react';
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
  const [myPicks, setMyPicks] = useState<Map<string, string>>(new Map()); // game_id → picked_team_id
  const [pickCounts, setPickCounts] = useState<Map<string, Map<string, number>>>(new Map()); // game_id → team_id → count

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

    // Load user's picks
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

    // Load aggregate pick counts for the pool
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

  // Realtime
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

  const tabs: { key: TabFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: stats.total },
    { key: 'live', label: 'Live', count: stats.live },
    { key: 'upcoming', label: 'Upcoming', count: stats.upcoming },
    { key: 'final', label: 'Final', count: stats.final },
  ];

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">Game Center</h1>
        </div>
        <div className="flex items-center gap-2">
          {rtStatus === 'connected' && (
            <span className="flex items-center gap-1 text-[10px] text-success">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              Live
            </span>
          )}
          {lastUpdated && (
            <span className="text-[10px] text-muted-foreground">
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5",
              tab === t.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            )}
          >
            {t.key === 'live' && <Zap className="w-3 h-3" />}
            {t.label}
            <span className={cn("text-[10px] tabular-nums", tab === t.key ? "text-primary-foreground/70" : "text-muted-foreground")}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Round filter */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        <button
          onClick={() => setRoundFilter(null)}
          className={cn(
            "px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
            roundFilter === null ? "bg-card text-foreground border border-border" : "text-muted-foreground hover:text-foreground"
          )}
        >
          All Rounds
        </button>
        {ROUND_SHORT.map((name, i) => (
          <button
            key={i}
            onClick={() => setRoundFilter(i + 1)}
            className={cn(
              "px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
              roundFilter === i + 1 ? "bg-card text-foreground border border-border" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Games */}
      {filteredGames.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {tab === 'live' ? 'No live games right now.' : 'No games match your filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filteredGames.map((game, idx) => (
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
      )}
    </div>
  );
}

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

  // Check for upsets (lower seed wins)
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
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: Math.min(index * 0.02, 0.3) }}
      className={cn(
        "matchup-card relative overflow-hidden",
        isLive && "ring-1 ring-primary/40"
      )}
    >
      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-medium">
            {ROUND_SHORT[game.round_number - 1]} · {game.region}
          </span>
          {isUpset && (
            <span className="text-[9px] font-bold text-warning bg-warning/15 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <AlertTriangle className="w-2.5 h-2.5" /> UPSET
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isLive && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-destructive">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
              {(game as any).live_period ? `${(game as any).live_period} · ${(game as any).live_clock}` : 'LIVE'}
            </span>
          )}
          {isFinal && <span className="text-[10px] font-semibold text-muted-foreground">FINAL</span>}
          {!isLive && !isFinal && <span className="text-[10px] text-muted-foreground">{game.scheduled_at ? new Date(game.scheduled_at).toLocaleDateString() : 'TBD'}</span>}
          {myPick && (
            <span className={cn(
              "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
              myPickCorrect && "bg-success/15 text-success",
              myPickWrong && "bg-destructive/15 text-destructive",
              !isFinal && "bg-primary/15 text-primary"
            )}>
              {myPickCorrect ? '✓' : myPickWrong ? '✗' : '★'} My Pick
            </span>
          )}
        </div>
      </div>

      {/* Teams */}
      <TeamRow
        team={team1}
        score={game.team1_score}
        isWinner={game.winner_team_id === team1?.id}
        isMyPick={myPick === team1?.id}
        isFinal={isFinal}
        pickCount={team1 ? pickCounts?.get(team1.id) : undefined}
      />
      <div className="h-px bg-border/30 mx-2" />
      <TeamRow
        team={team2}
        score={game.team2_score}
        isWinner={game.winner_team_id === team2?.id}
        isMyPick={myPick === team2?.id}
        isFinal={isFinal}
        pickCount={team2 ? pickCounts?.get(team2.id) : undefined}
      />
    </motion.div>
  );
}

function TeamRow({
  team,
  score,
  isWinner,
  isMyPick,
  isFinal,
  pickCount,
}: {
  team: Team | null;
  score: number | null;
  isWinner: boolean;
  isMyPick: boolean;
  isFinal: boolean;
  pickCount?: number;
}) {
  if (!team) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="text-xs text-muted-foreground italic ml-5">TBD</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2.5 transition-colors",
      isWinner && "bg-success/5",
      !isWinner && isFinal && "opacity-50"
    )}>
      <span className="text-[11px] font-mono font-bold text-muted-foreground w-5 tabular-nums text-center">
        {team.seed}
      </span>
      <span className={cn(
        "text-sm font-medium flex-1 truncate",
        isWinner && "font-bold",
        isMyPick && !isFinal && "text-primary"
      )}>
        {team.short_name}
      </span>
      {isMyPick && (
        <span className="text-[9px] text-primary font-bold">★</span>
      )}
      {pickCount !== undefined && pickCount > 0 && (
        <span className="text-[10px] text-muted-foreground tabular-nums">{pickCount} picks</span>
      )}
      {score !== null && (
        <span className={cn(
          "text-sm font-mono tabular-nums font-bold min-w-[1.5rem] text-right",
          isWinner ? "text-foreground" : "text-muted-foreground"
        )}>
          {score}
        </span>
      )}
      {isWinner && <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />}
    </div>
  );
}
