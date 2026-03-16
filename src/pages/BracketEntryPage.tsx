import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Save, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Team {
  id: string;
  school_name: string;
  short_name: string;
  seed: number;
  region: string;
}

interface Game {
  id: string;
  round_number: number;
  round_name: string;
  region: string;
  game_slot: number;
  team1_id: string | null;
  team2_id: string | null;
  status: string;
}

interface Pick {
  game_id: string;
  picked_team_id: string;
  picked_in_round: number;
}

const ROUND_NAMES = ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite 8', 'Final Four', 'Championship'];

export default function BracketEntryPage() {
  const { poolId } = useParams<{ poolId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Map<string, Team>>(new Map());
  const [picks, setPicks] = useState<Map<string, Pick>>(new Map());
  const [bracket, setBracket] = useState<any>(null);
  const [tiebreaker, setTiebreaker] = useState<string>('');
  const [currentRound, setCurrentRound] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pool, setPool] = useState<any>(null);

  useEffect(() => {
    if (!poolId || !user) return;

    const fetchData = async () => {
      // Get pool
      const { data: poolData } = await supabase
        .from('pools')
        .select('*, tournaments(id)')
        .eq('id', poolId)
        .single();

      if (!poolData) return;
      setPool(poolData);

      const tournamentId = poolData.tournaments?.id;
      if (!tournamentId) return;

      // Check if locked
      if (new Date(poolData.lock_time) <= new Date()) {
        toast.error('This pool is locked. You can no longer edit picks.');
        navigate(`/pools/${poolId}`);
        return;
      }

      // Get teams
      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('tournament_id', tournamentId);

      if (teamData) {
        const teamMap = new Map<string, Team>();
        teamData.forEach(t => teamMap.set(t.id, t));
        setTeams(teamMap);
      }

      // Get games
      const { data: gameData } = await supabase
        .from('games')
        .select('id, round_number, round_name, region, game_slot, team1_id, team2_id, status')
        .eq('tournament_id', tournamentId)
        .order('round_number')
        .order('game_slot');

      if (gameData) setGames(gameData);

      // Get existing bracket & picks
      const { data: bracketData } = await supabase
        .from('brackets')
        .select('*')
        .eq('pool_id', poolId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (bracketData) {
        setBracket(bracketData);
        setTiebreaker(bracketData.tiebreaker_score?.toString() || '');

        const { data: pickData } = await supabase
          .from('bracket_picks')
          .select('game_id, picked_team_id, picked_in_round')
          .eq('bracket_id', bracketData.id);

        if (pickData) {
          const pickMap = new Map<string, Pick>();
          pickData.forEach(p => pickMap.set(p.game_id, p));
          setPicks(pickMap);
        }
      }

      setLoading(false);
    };

    fetchData();
  }, [poolId, user, navigate]);

  const getTeamForSlot = useCallback((game: Game, slot: 'team1' | 'team2'): Team | null => {
    const teamId = slot === 'team1' ? game.team1_id : game.team2_id;
    if (!teamId) return null;
    return teams.get(teamId) || null;
  }, [teams]);

  // Determine which team fills a game slot based on picks from previous round
  const getEffectiveTeam = useCallback((game: Game, slot: 'team1' | 'team2'): Team | null => {
    const directTeam = getTeamForSlot(game, slot);
    if (directTeam) return directTeam;

    // For later rounds, check if a pick from the feeder game provides the team
    if (game.round_number <= 1) return null;

    const prevRoundGames = games.filter(g => g.round_number === game.round_number - 1);
    // game_slot logic: for game_slot N in round R, feeder games are slots (N*2-1) and (N*2) from round R-1
    const feederSlot = slot === 'team1' ? game.game_slot * 2 - 1 : game.game_slot * 2;
    const feederGame = prevRoundGames.find(g => g.game_slot === feederSlot);
    
    if (feederGame) {
      const pick = picks.get(feederGame.id);
      if (pick) return teams.get(pick.picked_team_id) || null;
    }
    return null;
  }, [games, picks, teams, getTeamForSlot]);

  const handlePick = (gameId: string, teamId: string, round: number) => {
    const newPicks = new Map(picks);
    newPicks.set(gameId, { game_id: gameId, picked_team_id: teamId, picked_in_round: round });

    // Clear downstream picks that depend on this game's winner
    const clearDownstream = (fromRound: number, fromSlot: number) => {
      const game = games.find(g => g.round_number === fromRound && g.game_slot === fromSlot);
      if (!game) return;
      
      // Find next round game that this feeds into
      const nextRound = fromRound + 1;
      const nextSlot = Math.ceil(fromSlot / 2);
      const nextGame = games.find(g => g.round_number === nextRound && g.game_slot === nextSlot);
      
      if (nextGame) {
        const existingPick = newPicks.get(nextGame.id);
        if (existingPick) {
          // Check if the pick is still valid
          const t1 = getEffectiveTeamFromPicks(nextGame, 'team1', newPicks);
          const t2 = getEffectiveTeamFromPicks(nextGame, 'team2', newPicks);
          if (existingPick.picked_team_id !== t1?.id && existingPick.picked_team_id !== t2?.id) {
            newPicks.delete(nextGame.id);
            clearDownstream(nextRound, nextSlot);
          }
        }
      }
    };

    const currentGame = games.find(g => g.id === gameId);
    if (currentGame) {
      clearDownstream(currentGame.round_number, currentGame.game_slot);
    }

    setPicks(newPicks);
  };

  const getEffectiveTeamFromPicks = (game: Game, slot: 'team1' | 'team2', pickMap: Map<string, Pick>): Team | null => {
    const directTeam = getTeamForSlot(game, slot);
    if (directTeam) return directTeam;

    if (game.round_number <= 1) return null;
    const prevRoundGames = games.filter(g => g.round_number === game.round_number - 1);
    const feederSlot = slot === 'team1' ? game.game_slot * 2 - 1 : game.game_slot * 2;
    const feederGame = prevRoundGames.find(g => g.game_slot === feederSlot);
    
    if (feederGame) {
      const pick = pickMap.get(feederGame.id);
      if (pick) return teams.get(pick.picked_team_id) || null;
    }
    return null;
  };

  const saveDraft = async () => {
    if (!user || !poolId) return;
    setSaving(true);

    try {
      let bracketId = bracket?.id;

      if (!bracketId) {
        const { data: newBracket, error } = await supabase
          .from('brackets')
          .insert({
            pool_id: poolId,
            user_id: user.id,
            status: 'draft',
            tiebreaker_score: tiebreaker ? parseInt(tiebreaker) : null,
          })
          .select()
          .single();

        if (error) throw error;
        bracketId = newBracket.id;
        setBracket(newBracket);
      } else {
        await supabase
          .from('brackets')
          .update({ tiebreaker_score: tiebreaker ? parseInt(tiebreaker) : null })
          .eq('id', bracketId);
      }

      // Upsert picks
      if (picks.size > 0) {
        const pickArray = Array.from(picks.values()).map(p => ({
          bracket_id: bracketId,
          game_id: p.game_id,
          picked_team_id: p.picked_team_id,
          picked_in_round: p.picked_in_round,
        }));

        // Delete existing picks and re-insert
        await supabase.from('bracket_picks').delete().eq('bracket_id', bracketId);
        const { error: pickError } = await supabase.from('bracket_picks').insert(pickArray);
        if (pickError) throw pickError;
      }

      toast.success('Draft saved!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const submitBracket = async () => {
    await saveDraft();
    if (!bracket?.id && !picks.size) return;

    const bracketId = bracket?.id;
    if (!bracketId) return;

    try {
      const { error } = await supabase
        .from('brackets')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', bracketId);

      if (error) throw error;
      toast.success('Bracket submitted! Good luck! 🏀');
      navigate(`/pools/${poolId}`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const roundGames = games.filter(g => g.round_number === currentRound);
  const regions = [...new Set(roundGames.map(g => g.region))];

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">Fill Your Bracket</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={saveDraft} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> Save
          </Button>
          <Button size="sm" onClick={submitBracket} disabled={saving}>
            <Send className="w-4 h-4 mr-1" /> Submit
          </Button>
        </div>
      </div>

      {/* Round Navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          disabled={currentRound <= 1}
          onClick={() => setCurrentRound(r => r - 1)}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold">{ROUND_NAMES[currentRound - 1]}</p>
          <p className="text-[10px] text-muted-foreground">Round {currentRound} of 6</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          disabled={currentRound >= 6}
          onClick={() => setCurrentRound(r => r + 1)}
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Round Progress Pills */}
      <div className="flex gap-1 mb-6 justify-center">
        {ROUND_NAMES.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentRound(i + 1)}
            className={cn(
              "w-8 h-1.5 rounded-full transition-colors",
              currentRound === i + 1 ? "bg-primary" : "bg-secondary"
            )}
          />
        ))}
      </div>

      {/* Games */}
      <div className="space-y-6">
        {regions.map(region => {
          const regionGames = roundGames.filter(g => g.region === region);
          return (
            <div key={region}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {region}
              </h3>
              <div className="space-y-2">
                {regionGames.map(game => {
                  const team1 = getEffectiveTeam(game, 'team1');
                  const team2 = getEffectiveTeam(game, 'team2');
                  const currentPick = picks.get(game.id);

                  return (
                    <div key={game.id} className="matchup-card">
                      <TeamRow
                        team={team1}
                        isSelected={currentPick?.picked_team_id === team1?.id}
                        onSelect={() => team1 && handlePick(game.id, team1.id, game.round_number)}
                        disabled={!team1}
                      />
                      <div className="h-px bg-border mx-2" />
                      <TeamRow
                        team={team2}
                        isSelected={currentPick?.picked_team_id === team2?.id}
                        onSelect={() => team2 && handlePick(game.id, team2.id, game.round_number)}
                        disabled={!team2}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tiebreaker */}
      {currentRound === 6 && (
        <div className="mt-6 glass-card p-4">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Tiebreaker: Total Points in Championship Game
          </label>
          <Input
            type="number"
            value={tiebreaker}
            onChange={(e) => setTiebreaker(e.target.value)}
            placeholder="e.g. 145"
            className="font-mono"
          />
        </div>
      )}
    </div>
  );
}

function TeamRow({ team, isSelected, onSelect, disabled }: {
  team: Team | null;
  isSelected: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
        isSelected ? "bg-primary/15" : "hover:bg-secondary/50",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      {team ? (
        <>
          <span className="text-xs font-mono font-bold text-muted-foreground w-5 tabular-nums">
            {team.seed}
          </span>
          <span className={cn("text-sm font-medium flex-1", isSelected && "text-primary")}>
            {team.short_name}
          </span>
          {isSelected && (
            <div className="w-2 h-2 rounded-full bg-primary" />
          )}
        </>
      ) : (
        <span className="text-xs text-muted-foreground italic">TBD</span>
      )}
    </button>
  );
}
