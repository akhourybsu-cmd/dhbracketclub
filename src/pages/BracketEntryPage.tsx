import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Save, Send, ChevronLeft, ChevronRight, ArrowLeft, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  Team, Game, Pick, ROUND_NAMES, ROUND_SHORT, TOTAL_GAMES, FIRST_FOUR_GAMES,
  FIRST_FOUR_ROUND_NAME, FIRST_FOUR_ROUND_SHORT,
  getEffectiveTeam, handlePickWithCascade,
} from '@/lib/bracketUtils';

export default function BracketEntryPage() {
  const { poolId } = useParams<{ poolId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Map<string, Team>>(new Map());
  const [picks, setPicks] = useState<Map<string, Pick>>(new Map());
  const [bracket, setBracket] = useState<any>(null);
  const [tiebreaker, setTiebreaker] = useState<string>('');
  const [hasFirstFour, setHasFirstFour] = useState(false);
  const [currentRound, setCurrentRound] = useState(0); // Will be set after data loads
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pool, setPool] = useState<any>(null);

  useEffect(() => {
    if (!poolId || !user) return;
    const fetchData = async () => {
      const { data: poolData } = await supabase
        .from('pools')
        .select('*, tournaments(id)')
        .eq('id', poolId)
        .single();

      if (!poolData) return;
      setPool(poolData);

      const tournamentId = poolData.tournaments?.id;
      if (!tournamentId) return;

      if (new Date(poolData.lock_time) <= new Date()) {
        toast.error('This pool is locked.');
        navigate(`/pools/${poolId}`);
        return;
      }

      const { data: teamData } = await supabase.from('teams').select('*').eq('tournament_id', tournamentId);
      if (teamData) {
        const m = new Map<string, Team>();
        teamData.forEach(t => m.set(t.id, t as Team));
        setTeams(m);
      }

      const { data: gameData } = await supabase
        .from('games')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('round_number')
        .order('game_slot');
      if (gameData) {
        setGames(gameData as Game[]);
        const ff = gameData.some(g => g.round_number === 0);
        setHasFirstFour(ff);
        setCurrentRound(ff ? 0 : 1);
      }

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
          const pm = new Map<string, Pick>();
          pickData.forEach(p => pm.set(p.game_id, p));
          setPicks(pm);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [poolId, user, navigate]);

  const handlePick = (gameId: string, teamId: string, round: number) => {
    setPicks(prev => handlePickWithCascade(gameId, teamId, round, games, teams, prev));
  };

  // Progress calculation
  const progress = useMemo(() => {
    const total = games.length;
    const filled = picks.size;
    return { filled, total, pct: total > 0 ? Math.round((filled / total) * 100) : 0 };
  }, [games, picks]);

  // Per-round completion
  const roundCompletion = useMemo(() => {
    const result: Record<number, { total: number; filled: number }> = {};
    const startRound = hasFirstFour ? 0 : 1;
    for (let r = startRound; r <= 6; r++) {
      const roundGames = games.filter(g => g.round_number === r);
      const filled = roundGames.filter(g => picks.has(g.id)).length;
      result[r] = { total: roundGames.length, filled };
    }
    return result;
  }, [games, picks, hasFirstFour]);

  const saveDraft = async (): Promise<string | null> => {
    if (!user || !poolId) return null;
    setSaving(true);
    try {
      let bracketId = bracket?.id;
      if (!bracketId) {
        const { data: newBracket, error } = await supabase
          .from('brackets')
          .insert({ pool_id: poolId, user_id: user.id, status: 'draft', tiebreaker_score: tiebreaker ? parseInt(tiebreaker) : null })
          .select()
          .single();
        if (error) throw error;
        bracketId = newBracket.id;
        setBracket(newBracket);
      } else {
        await supabase.from('brackets')
          .update({ tiebreaker_score: tiebreaker ? parseInt(tiebreaker) : null })
          .eq('id', bracketId);
      }

      if (picks.size > 0) {
        const pickArray = Array.from(picks.values()).map(p => ({
          bracket_id: bracketId,
          game_id: p.game_id,
          picked_team_id: p.picked_team_id,
          picked_in_round: p.picked_in_round,
        }));
        await supabase.from('bracket_picks').delete().eq('bracket_id', bracketId);
        const { error: pickError } = await supabase.from('bracket_picks').insert(pickArray);
        if (pickError) throw pickError;
      }

      toast.success('Draft saved!');
      return bracketId;
    } catch (err: any) {
      toast.error(err.message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const submitBracket = async () => {
    if (progress.filled < progress.total) {
      toast.error(`Complete all ${progress.total} picks before submitting. You have ${progress.filled}.`);
      return;
    }
    const bracketId = await saveDraft();
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
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link to={`/pools/${poolId}`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Fill Your Bracket</h1>
          {bracket?.status === 'submitted' && (
            <p className="text-xs text-success font-medium">Submitted — editing will set back to draft</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={saveDraft} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> Save
          </Button>
          <Button size="sm" onClick={submitBracket} disabled={saving}>
            <Send className="w-4 h-4 mr-1" /> Submit
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="glass-card p-3 mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium">
            {progress.filled} of {progress.total} picks
          </span>
          <span className="text-xs font-bold text-primary tabular-nums">{progress.pct}%</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress.pct}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Round Navigation */}
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="icon" disabled={currentRound <= (hasFirstFour ? 0 : 1)} onClick={() => setCurrentRound(r => r - 1)}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold">
            {currentRound === 0 ? FIRST_FOUR_ROUND_NAME : ROUND_NAMES[currentRound - 1]}
          </p>
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {roundCompletion[currentRound]?.filled}/{roundCompletion[currentRound]?.total} picks
          </p>
        </div>
        <Button variant="ghost" size="icon" disabled={currentRound >= 6} onClick={() => setCurrentRound(r => r + 1)}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Round Tabs */}
      <div className="flex gap-1.5 mb-5 justify-center flex-wrap">
        {hasFirstFour && (
          <button
            onClick={() => setCurrentRound(0)}
            className={cn(
              "px-2 py-1 rounded-md text-[10px] font-semibold transition-colors relative",
              currentRound === 0
                ? "bg-primary text-primary-foreground"
                : roundCompletion[0]?.filled === roundCompletion[0]?.total && roundCompletion[0]?.total > 0
                  ? "bg-success/15 text-success"
                  : "bg-secondary text-secondary-foreground"
            )}
          >
            {FIRST_FOUR_ROUND_SHORT}
            {roundCompletion[0]?.filled === roundCompletion[0]?.total && roundCompletion[0]?.total > 0 && currentRound !== 0 && (
              <Check className="w-2.5 h-2.5 absolute -top-1 -right-1" />
            )}
          </button>
        )}
        {ROUND_SHORT.map((label, i) => {
          const rc = roundCompletion[i + 1];
          const isComplete = rc && rc.filled === rc.total && rc.total > 0;
          return (
            <button
              key={i}
              onClick={() => setCurrentRound(i + 1)}
              className={cn(
                "px-2 py-1 rounded-md text-[10px] font-semibold transition-colors relative",
                currentRound === i + 1
                  ? "bg-primary text-primary-foreground"
                  : isComplete
                    ? "bg-success/15 text-success"
                    : "bg-secondary text-secondary-foreground"
              )}
            >
              {label}
              {isComplete && currentRound !== i + 1 && (
                <Check className="w-2.5 h-2.5 absolute -top-1 -right-1" />
              )}
            </button>
          );
        })}
      </div>

      {/* Games */}
      <div className="space-y-5">
        {regions.map(region => {
          const regionGames = roundGames.filter(g => g.region === region);
          return (
            <div key={region}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{region}</h3>
              <div className="space-y-2">
                {regionGames.map(game => {
                  const team1 = getEffectiveTeam(game, 'team1', games, teams, picks);
                  const team2 = getEffectiveTeam(game, 'team2', games, teams, picks);
                  const currentPick = picks.get(game.id);

                  return (
                    <div key={game.id} className="matchup-card">
                      <MatchupTeamRow
                        team={team1}
                        isSelected={currentPick?.picked_team_id === team1?.id}
                        onSelect={() => team1 && handlePick(game.id, team1.id, game.round_number)}
                        disabled={!team1}
                      />
                      <div className="h-px bg-border mx-2" />
                      <MatchupTeamRow
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
        <div className="mt-5 glass-card p-4">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Tiebreaker: Predicted total score of the Championship game
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

      {/* Bottom spacer for mobile nav */}
      <div className="h-4" />
    </div>
  );
}

function MatchupTeamRow({ team, isSelected, onSelect, disabled, isPlayInSlot }: {
  team: Team | null;
  isSelected: boolean;
  onSelect: () => void;
  disabled: boolean;
  isPlayInSlot?: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all",
        isSelected ? "bg-primary/12" : "hover:bg-secondary/50",
        disabled && "opacity-30 cursor-not-allowed"
      )}
    >
      {team ? (
        <>
          <span className="text-[11px] font-mono font-bold text-muted-foreground w-5 tabular-nums text-center">
            {team.seed}
          </span>
          <span className={cn("text-sm font-medium flex-1 truncate", isSelected && "text-primary font-semibold")}>
            {team.short_name}
          </span>
          {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0" />}
        </>
      ) : (
        <>
          <span className="w-5" />
          <span className="text-xs text-muted-foreground/50 italic">
            {isPlayInSlot ? 'TBD — First Four' : 'Waiting for earlier pick'}
          </span>
        </>
      )}
    </button>
  );
}
