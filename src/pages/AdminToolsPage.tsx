import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ArrowLeft, CheckCircle2, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Game {
  id: string;
  round_number: number;
  round_name: string;
  region: string;
  game_slot: number;
  team1_id: string | null;
  team2_id: string | null;
  winner_team_id: string | null;
  team1_score: number | null;
  team2_score: number | null;
  status: string;
}

interface Team {
  id: string;
  short_name: string;
  seed: number;
}

export default function AdminToolsPage() {
  const { poolId } = useParams<{ poolId: string }>();
  const { user } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Map<string, Team>>(new Map());
  const [selectedRound, setSelectedRound] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!poolId) return;

    const fetchData = async () => {
      const { data: pool } = await supabase
        .from('pools')
        .select('tournament_id')
        .eq('id', poolId)
        .single();

      if (!pool) return;

      const { data: teamData } = await supabase
        .from('teams')
        .select('id, short_name, seed')
        .eq('tournament_id', pool.tournament_id);

      if (teamData) {
        const m = new Map<string, Team>();
        teamData.forEach(t => m.set(t.id, t));
        setTeams(m);
      }

      const { data: gameData } = await supabase
        .from('games')
        .select('*')
        .eq('tournament_id', pool.tournament_id)
        .order('round_number')
        .order('game_slot');

      if (gameData) setGames(gameData as Game[]);
      setLoading(false);
    };

    fetchData();
  }, [poolId]);

  const setWinner = async (gameId: string, winnerId: string) => {
    setSaving(gameId);

    try {
      const { error } = await supabase
        .from('games')
        .update({ winner_team_id: winnerId, status: 'final' })
        .eq('id', gameId);

      if (error) throw error;

      // Update local state
      setGames(prev => prev.map(g => g.id === gameId ? { ...g, winner_team_id: winnerId, status: 'final' } : g));

      // Advance winner to next round game
      const game = games.find(g => g.id === gameId);
      if (game) {
        const nextRound = game.round_number + 1;
        const nextSlot = Math.ceil(game.game_slot / 2);
        const isTeam1 = game.game_slot % 2 === 1;

        const nextGame = games.find(g => g.round_number === nextRound && g.game_slot === nextSlot);
        if (nextGame) {
          const updateField = isTeam1 ? 'team1_id' : 'team2_id';
          await supabase.from('games').update({ [updateField]: winnerId }).eq('id', nextGame.id);
          setGames(prev => prev.map(g => g.id === nextGame.id ? { ...g, [updateField]: winnerId } : g));
        }
      }

      // Recalculate standings
      await recalculateStandings();

      toast.success('Winner set!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(null);
    }
  };

  const recalculateStandings = async () => {
    if (!poolId) return;

    try {
      // Get all brackets in this pool
      const { data: brackets } = await supabase
        .from('brackets')
        .select('id, user_id')
        .eq('pool_id', poolId);

      if (!brackets) return;

      // Get scoring rules
      const { data: rules } = await supabase
        .from('scoring_rules')
        .select('round_number, points_per_correct_pick')
        .eq('pool_id', poolId);

      const pointsMap = new Map<number, number>();
      rules?.forEach(r => pointsMap.set(r.round_number, r.points_per_correct_pick));

      // Get all decided games
      const decidedGames = games.filter(g => g.winner_team_id);

      for (const bracket of brackets) {
        const { data: picks } = await supabase
          .from('bracket_picks')
          .select('game_id, picked_team_id, picked_in_round')
          .eq('bracket_id', bracket.id);

        if (!picks) continue;

        let totalPoints = 0;
        let correctPicks = 0;

        picks.forEach(pick => {
          const game = decidedGames.find(g => g.id === pick.game_id);
          if (game && game.winner_team_id === pick.picked_team_id) {
            correctPicks++;
            totalPoints += pointsMap.get(pick.picked_in_round) || 0;
          }
        });

        // Upsert standings
        await supabase.from('standings').upsert({
          pool_id: poolId,
          user_id: bracket.user_id,
          total_points: totalPoints,
          correct_picks: correctPicks,
          possible_points_remaining: 0, // Simplified for now
        }, { onConflict: 'pool_id,user_id' });
      }
    } catch (err) {
      console.error('Failed to recalculate standings:', err);
    }
  };

  const roundGames = games.filter(g => g.round_number === selectedRound);
  const regions = [...new Set(roundGames.map(g => g.region))];
  const ROUND_NAMES = ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite 8', 'Final Four', 'Championship'];

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <Link to={`/pools/${poolId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Pool
      </Link>

      <h1 className="text-xl font-bold mb-1">Admin Tools</h1>
      <p className="text-sm text-muted-foreground mb-6">Enter game results to update standings.</p>

      {/* Round Selector */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {ROUND_NAMES.map((name, i) => (
          <button
            key={i}
            onClick={() => setSelectedRound(i + 1)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
              selectedRound === i + 1 ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            )}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {regions.map(region => {
          const regionGames = roundGames.filter(g => g.region === region);
          return (
            <div key={region}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{region}</h3>
              <div className="space-y-2">
                {regionGames.map(game => {
                  const team1 = game.team1_id ? teams.get(game.team1_id) : null;
                  const team2 = game.team2_id ? teams.get(game.team2_id) : null;
                  const isFinal = game.status === 'final';

                  return (
                    <div key={game.id} className="matchup-card">
                      <button
                        onClick={() => team1 && !isFinal && setWinner(game.id, team1.id)}
                        disabled={!team1 || isFinal || saving === game.id}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left",
                          game.winner_team_id === team1?.id ? "bg-correct/10" : "hover:bg-secondary/50",
                          (!team1 || isFinal) && "cursor-default"
                        )}
                      >
                        {team1 ? (
                          <>
                            <span className="text-xs font-mono font-bold text-muted-foreground w-5 tabular-nums">{team1.seed}</span>
                            <span className="text-sm font-medium flex-1">{team1.short_name}</span>
                            {game.winner_team_id === team1.id && <CheckCircle2 className="w-4 h-4 text-correct" />}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">TBD</span>
                        )}
                      </button>
                      <div className="h-px bg-border mx-2" />
                      <button
                        onClick={() => team2 && !isFinal && setWinner(game.id, team2.id)}
                        disabled={!team2 || isFinal || saving === game.id}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left",
                          game.winner_team_id === team2?.id ? "bg-correct/10" : "hover:bg-secondary/50",
                          (!team2 || isFinal) && "cursor-default"
                        )}
                      >
                        {team2 ? (
                          <>
                            <span className="text-xs font-mono font-bold text-muted-foreground w-5 tabular-nums">{team2.seed}</span>
                            <span className="text-sm font-medium flex-1">{team2.short_name}</span>
                            {game.winner_team_id === team2.id && <CheckCircle2 className="w-4 h-4 text-correct" />}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">TBD</span>
                        )}
                      </button>
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
