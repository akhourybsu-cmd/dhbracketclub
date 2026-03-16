import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ArrowLeft, CheckCircle2, RotateCcw, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { Game, Team, ROUND_NAMES, DEFAULT_SCORING, calculateBracketScore } from '@/lib/bracketUtils';

export default function AdminToolsPage() {
  const { poolId } = useParams<{ poolId: string }>();
  const { user } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Map<string, Team>>(new Map());
  const [selectedRound, setSelectedRound] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [scores, setScores] = useState<Map<string, { team1: string; team2: string }>>(new Map());
  const [tournamentId, setTournamentId] = useState('');

  useEffect(() => {
    if (!poolId) return;
    const fetchData = async () => {
      const { data: pool } = await supabase.from('pools').select('tournament_id').eq('id', poolId).single();
      if (!pool) return;
      setTournamentId(pool.tournament_id);

      const { data: teamData } = await supabase.from('teams').select('*').eq('tournament_id', pool.tournament_id);
      if (teamData) {
        const m = new Map<string, Team>();
        teamData.forEach(t => m.set(t.id, t as Team));
        setTeams(m);
      }

      const { data: gameData } = await supabase.from('games').select('*')
        .eq('tournament_id', pool.tournament_id).order('round_number').order('game_slot');
      if (gameData) {
        setGames(gameData as Game[]);
        const sm = new Map<string, { team1: string; team2: string }>();
        gameData.forEach(g => {
          sm.set(g.id, { team1: g.team1_score?.toString() || '', team2: g.team2_score?.toString() || '' });
        });
        setScores(sm);
      }
      setLoading(false);
    };
    fetchData();
  }, [poolId]);

  const setWinner = async (gameId: string, winnerId: string) => {
    setSaving(gameId);
    try {
      const s = scores.get(gameId);
      const { error } = await supabase.from('games').update({
        winner_team_id: winnerId,
        status: 'final',
        team1_score: s?.team1 ? parseInt(s.team1) : null,
        team2_score: s?.team2 ? parseInt(s.team2) : null,
      }).eq('id', gameId);
      if (error) throw error;

      setGames(prev => prev.map(g => g.id === gameId ? {
        ...g, winner_team_id: winnerId, status: 'final',
        team1_score: s?.team1 ? parseInt(s.team1) : null,
        team2_score: s?.team2 ? parseInt(s.team2) : null,
      } : g));

      // Advance winner
      const game = games.find(g => g.id === gameId);
      if (game) {
        const nextRound = game.round_number + 1;
        const nextSlot = Math.ceil(game.game_slot / 2);
        const isTeam1 = game.game_slot % 2 === 1;
        const nextGame = games.find(g => g.round_number === nextRound && g.game_slot === nextSlot);
        if (nextGame) {
          const field = isTeam1 ? 'team1_id' : 'team2_id';
          await supabase.from('games').update({ [field]: winnerId }).eq('id', nextGame.id);
          setGames(prev => prev.map(g => g.id === nextGame.id ? { ...g, [field]: winnerId } : g));
        }
      }

      // Log admin action
      if (user) {
        await supabase.from('admin_logs').insert({
          pool_id: poolId!,
          actor_user_id: user.id,
          action_type: 'set_winner',
          action_payload: { game_id: gameId, winner_team_id: winnerId },
        });
      }

      toast.success('Result saved!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(null);
    }
  };

  const resetGame = async (gameId: string) => {
    setSaving(gameId);
    try {
      await supabase.from('games').update({
        winner_team_id: null, status: 'scheduled', team1_score: null, team2_score: null,
      }).eq('id', gameId);

      setGames(prev => prev.map(g => g.id === gameId ? {
        ...g, winner_team_id: null, status: 'scheduled', team1_score: null, team2_score: null,
      } : g));

      if (user) {
        await supabase.from('admin_logs').insert({
          pool_id: poolId!, actor_user_id: user.id,
          action_type: 'reset_game', action_payload: { game_id: gameId },
        });
      }

      toast.success('Game reset.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(null);
    }
  };

  const recalculateStandings = async () => {
    if (!poolId) return;
    setRecalculating(true);
    try {
      const { data: brackets } = await supabase.from('brackets').select('id, user_id').eq('pool_id', poolId);
      if (!brackets) return;

      const { data: rules } = await supabase.from('scoring_rules')
        .select('round_number, points_per_correct_pick').eq('pool_id', poolId);

      const scoringRules: Record<number, number> = {};
      rules?.forEach(r => { scoringRules[r.round_number] = r.points_per_correct_pick; });
      if (Object.keys(scoringRules).length === 0) {
        Object.assign(scoringRules, DEFAULT_SCORING);
      }

      // Use fresh games data
      const { data: freshGames } = await supabase.from('games').select('*').eq('tournament_id', tournamentId);
      const allGames = (freshGames || []) as Game[];

      for (const bracket of brackets) {
        const { data: picks } = await supabase.from('bracket_picks')
          .select('game_id, picked_team_id, picked_in_round').eq('bracket_id', bracket.id);
        if (!picks) continue;

        const result = calculateBracketScore(picks, allGames, scoringRules);

        await supabase.from('standings').upsert({
          pool_id: poolId,
          user_id: bracket.user_id,
          total_points: result.totalPoints,
          correct_picks: result.correctPicks,
          possible_points_remaining: result.possiblePointsRemaining,
        }, { onConflict: 'pool_id,user_id' });
      }

      if (user) {
        await supabase.from('admin_logs').insert({
          pool_id: poolId, actor_user_id: user.id,
          action_type: 'recalculate_standings', action_payload: { bracket_count: brackets.length },
        });
      }

      toast.success(`Standings recalculated for ${brackets.length} brackets!`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRecalculating(false);
    }
  };

  const roundGames = games.filter(g => g.round_number === selectedRound);
  const regions = [...new Set(roundGames.map(g => g.region))];

  // Round stats
  const roundStats = {
    total: roundGames.length,
    decided: roundGames.filter(g => g.winner_team_id).length,
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
        <div>
          <h1 className="text-xl font-bold">Admin Tools</h1>
          <p className="text-sm text-muted-foreground">Enter game results and manage standings.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={recalculateStandings}
          disabled={recalculating}
          className="gap-1"
        >
          <RefreshCw className={cn("w-4 h-4", recalculating && "animate-spin")} />
          {recalculating ? 'Recalculating...' : 'Recalc'}
        </Button>
      </div>

      {/* Round Selector */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {ROUND_NAMES.map((name, i) => {
          const rGames = games.filter(g => g.round_number === i + 1);
          const decided = rGames.filter(g => g.winner_team_id).length;
          return (
            <button
              key={i}
              onClick={() => setSelectedRound(i + 1)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1",
                selectedRound === i + 1 ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
              )}
            >
              {name}
              {decided > 0 && (
                <span className={cn("text-[10px] tabular-nums",
                  selectedRound === i + 1 ? "text-primary-foreground/70" : "text-muted-foreground"
                )}>
                  {decided}/{rGames.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Stats */}
      <div className="glass-card p-3 mb-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {ROUND_NAMES[selectedRound - 1]}: {roundStats.decided}/{roundStats.total} decided
        </span>
        <div className="h-1.5 w-24 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-success rounded-full" style={{ width: `${roundStats.total > 0 ? (roundStats.decided / roundStats.total) * 100 : 0}%` }} />
        </div>
      </div>

      {/* Games */}
      <div className="space-y-5">
        {regions.map(region => {
          const regionGames = roundGames.filter(g => g.region === region);
          return (
            <div key={region}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{region}</h3>
              <div className="space-y-3">
                {regionGames.map(game => {
                  const team1 = game.team1_id ? teams.get(game.team1_id) : null;
                  const team2 = game.team2_id ? teams.get(game.team2_id) : null;
                  const isFinal = game.status === 'final';
                  const gameScores = scores.get(game.id) || { team1: '', team2: '' };

                  return (
                    <div key={game.id} className="matchup-card">
                      {/* Team 1 */}
                      <button
                        onClick={() => team1 && setWinner(game.id, team1.id)}
                        disabled={!team1 || saving === game.id}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2.5 transition-colors text-left",
                          game.winner_team_id === team1?.id ? "bg-correct/10" : "hover:bg-secondary/50",
                          !team1 && "cursor-default"
                        )}
                      >
                        {team1 ? (
                          <>
                            <span className="text-[11px] font-mono font-bold text-muted-foreground w-5 tabular-nums text-center">{team1.seed}</span>
                            <span className="text-sm font-medium flex-1 truncate">{team1.short_name}</span>
                            <Input
                              type="number"
                              placeholder="—"
                              value={gameScores.team1}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation();
                                setScores(prev => {
                                  const n = new Map(prev);
                                  n.set(game.id, { ...gameScores, team1: e.target.value });
                                  return n;
                                });
                              }}
                              className="w-12 h-7 text-center text-xs font-mono p-0 bg-surface"
                            />
                            {game.winner_team_id === team1.id && <CheckCircle2 className="w-4 h-4 text-correct flex-shrink-0" />}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground italic ml-5">TBD</span>
                        )}
                      </button>
                      <div className="h-px bg-border mx-2" />
                      {/* Team 2 */}
                      <button
                        onClick={() => team2 && setWinner(game.id, team2.id)}
                        disabled={!team2 || saving === game.id}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2.5 transition-colors text-left",
                          game.winner_team_id === team2?.id ? "bg-correct/10" : "hover:bg-secondary/50",
                          !team2 && "cursor-default"
                        )}
                      >
                        {team2 ? (
                          <>
                            <span className="text-[11px] font-mono font-bold text-muted-foreground w-5 tabular-nums text-center">{team2.seed}</span>
                            <span className="text-sm font-medium flex-1 truncate">{team2.short_name}</span>
                            <Input
                              type="number"
                              placeholder="—"
                              value={gameScores.team2}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation();
                                setScores(prev => {
                                  const n = new Map(prev);
                                  n.set(game.id, { ...gameScores, team2: e.target.value });
                                  return n;
                                });
                              }}
                              className="w-12 h-7 text-center text-xs font-mono p-0 bg-surface"
                            />
                            {game.winner_team_id === team2.id && <CheckCircle2 className="w-4 h-4 text-correct flex-shrink-0" />}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground italic ml-5">TBD</span>
                        )}
                      </button>
                      {/* Reset button */}
                      {isFinal && (
                        <div className="px-3 py-1.5 border-t border-border/30">
                          <button
                            onClick={() => resetGame(game.id)}
                            disabled={saving === game.id}
                            className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" /> Reset result
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
