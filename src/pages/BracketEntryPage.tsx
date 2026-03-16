import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Save, Send, ChevronLeft, ChevronRight, ArrowLeft, Check, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [currentRound, setCurrentRound] = useState(0);
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

  const progress = useMemo(() => {
    const total = games.length;
    const filled = picks.size;
    return { filled, total, pct: total > 0 ? Math.round((filled / total) * 100) : 0 };
  }, [games, picks]);

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
    return (
      <div className="loading-spinner">
        <div className="loading-spinner-ring" />
        <p className="loading-spinner-text">Loading bracket…</p>
      </div>
    );
  }

  const currentRoundName = currentRound === 0 ? FIRST_FOUR_ROUND_NAME : ROUND_NAMES[currentRound - 1];
  const rc = roundCompletion[currentRound];

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header — sticky on mobile */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md -mx-4 px-4 sm:-mx-6 sm:px-6 pt-1 pb-3 mb-2 border-b border-border/20">
        <div className="flex items-center gap-3">
          <Link to={`/pools/${poolId}`} className="text-muted-foreground hover:text-foreground transition-colors p-1 -ml-1">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">Fill Your Bracket</h1>
            {bracket?.status === 'submitted' && (
              <p className="text-[10px] sm:text-xs text-success font-semibold">Submitted — editing will revert to draft</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={saveDraft} disabled={saving} className="font-semibold h-9 px-3 rounded-xl btn-press text-xs sm:text-sm">
              <Save className="w-4 h-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Save</span>
            </Button>
            <Button size="sm" onClick={submitBracket} disabled={saving} className="font-semibold h-9 px-3 rounded-xl btn-press text-xs sm:text-sm">
              <Send className="w-4 h-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Submit</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="glass-card p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">
            {progress.filled} <span className="text-muted-foreground font-normal">of</span> {progress.total} <span className="text-muted-foreground font-normal">picks</span>
          </span>
          <span className="text-sm font-extrabold text-primary tabular-nums">{progress.pct}%</span>
        </div>
        <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))' }}
            initial={{ width: 0 }}
            animate={{ width: `${progress.pct}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Round Navigation — larger touch targets */}
      <div className="flex items-center justify-between mb-3">
        <Button
          variant="ghost"
          size="icon"
          disabled={currentRound <= (hasFirstFour ? 0 : 1)}
          onClick={() => setCurrentRound(r => r - 1)}
          className="rounded-xl h-10 w-10 btn-press"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="text-center">
          <h2 className="text-lg font-extrabold tracking-tight">{currentRoundName}</h2>
          <p className="text-xs text-muted-foreground tabular-nums font-medium mt-0.5">
            {rc?.filled}/{rc?.total} picks
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          disabled={currentRound >= 6}
          onClick={() => setCurrentRound(r => r + 1)}
          className="rounded-xl h-10 w-10 btn-press"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Round Tabs — scrollable on mobile */}
      <div className="flex gap-1.5 mb-5 justify-center flex-wrap">
        {hasFirstFour && (
          <RoundPill
            label={FIRST_FOUR_ROUND_SHORT}
            isActive={currentRound === 0}
            isComplete={roundCompletion[0]?.filled === roundCompletion[0]?.total && (roundCompletion[0]?.total ?? 0) > 0}
            onClick={() => setCurrentRound(0)}
          />
        )}
        {ROUND_SHORT.map((label, i) => {
          const rcomp = roundCompletion[i + 1];
          return (
            <RoundPill
              key={i}
              label={label}
              isActive={currentRound === i + 1}
              isComplete={rcomp && rcomp.filled === rcomp.total && rcomp.total > 0}
              onClick={() => setCurrentRound(i + 1)}
            />
          );
        })}
      </div>

      {/* Games by Region */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentRound}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {regions.map(region => {
            const regionGames = roundGames.filter(g => g.region === region);
            return (
              <div key={region}>
                <div className="section-divider">
                  <h3 className="section-header mb-0">{region}</h3>
                </div>
                <div className="space-y-2.5">
                  {regionGames.map((game, idx) => {
                    const team1 = getEffectiveTeam(game, 'team1', games, teams, picks);
                    const team2 = getEffectiveTeam(game, 'team2', games, teams, picks);
                    const currentPick = picks.get(game.id);
                    const hasPlayIn = game.round_number === 1 && games.some(g => g.round_number === 0 && g.region === game.region);
                    const isPicked = !!currentPick;

                    return (
                      <motion.div
                        key={game.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03, duration: 0.25 }}
                        className={cn(
                          "matchup-card",
                          isPicked && "ring-1 ring-primary/30"
                        )}
                      >
                        {/* Game header */}
                        <div className="flex items-center justify-between px-4 py-1.5 border-b border-border/30">
                          <span className="text-[10px] font-bold text-muted-foreground/50 tabular-nums">
                            Game {game.game_slot}
                          </span>
                          {isPicked && (
                            <motion.span
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="text-[10px] font-bold text-primary flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" /> Picked
                            </motion.span>
                          )}
                        </div>

                        <MatchupTeamRow
                          team={team1}
                          isSelected={currentPick?.picked_team_id === team1?.id}
                          isOpponentSelected={currentPick?.picked_team_id === team2?.id}
                          onSelect={() => team1 && handlePick(game.id, team1.id, game.round_number)}
                          disabled={!team1}
                          isPlayInSlot={!team1 && hasPlayIn}
                        />
                        <div className="h-px bg-border/30 mx-4" />
                        <MatchupTeamRow
                          team={team2}
                          isSelected={currentPick?.picked_team_id === team2?.id}
                          isOpponentSelected={currentPick?.picked_team_id === team1?.id}
                          onSelect={() => team2 && handlePick(game.id, team2.id, game.round_number)}
                          disabled={!team2}
                          isPlayInSlot={!team2 && hasPlayIn}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* Tiebreaker */}
      {currentRound === 6 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 glass-card p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-gold" />
            <label className="text-sm font-bold">Tiebreaker</label>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Predict the total combined score of the Championship game</p>
          <Input
            type="number"
            value={tiebreaker}
            onChange={(e) => setTiebreaker(e.target.value)}
            placeholder="e.g. 145"
            className="font-mono h-12 text-center text-lg font-bold rounded-xl"
          />
        </motion.div>
      )}

      {/* Bottom spacer for mobile nav */}
      <div className="h-8" />
    </div>
  );
}

function RoundPill({ label, isActive, isComplete, onClick }: {
  label: string;
  isActive: boolean;
  isComplete: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "round-pill btn-press relative",
        isActive
          ? "round-pill-active"
          : isComplete
            ? "round-pill-complete"
            : "round-pill-default"
      )}
    >
      {label}
      {isComplete && !isActive && (
        <Check className="w-3 h-3 absolute -top-1 -right-1 text-success" />
      )}
    </button>
  );
}

function MatchupTeamRow({ team, isSelected, isOpponentSelected, onSelect, disabled, isPlayInSlot }: {
  team: Team | null;
  isSelected: boolean;
  isOpponentSelected?: boolean;
  onSelect: () => void;
  disabled: boolean;
  isPlayInSlot?: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3.5 text-left btn-press",
        "transition-all duration-150",
        isSelected && "bg-primary/10",
        !isSelected && !disabled && "hover:bg-secondary/60 active:bg-secondary/80",
        isOpponentSelected && !isSelected && "opacity-45",
        disabled && "opacity-30 cursor-not-allowed"
      )}
    >
      {team ? (
        <>
          <span className={cn(
            "text-[11px] font-mono font-bold w-7 h-7 rounded-lg flex items-center justify-center tabular-nums flex-shrink-0",
            "transition-colors duration-150",
            isSelected ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
          )}>
            {team.seed}
          </span>
          <span className={cn(
            "text-sm flex-1 min-w-0 transition-colors duration-150",
            isSelected ? "text-primary font-bold" : "font-medium"
          )}>
            <span className="block truncate">{team.short_name}</span>
          </span>
          <AnimatePresence>
            {isSelected && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0"
              >
                <Check className="w-3.5 h-3.5 text-primary-foreground" />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <>
          <span className="w-7 h-7 rounded-lg bg-secondary/50 flex-shrink-0" />
          <span className="text-xs text-muted-foreground/50 italic font-medium">
            {isPlayInSlot ? 'TBD — First Four' : 'Waiting for earlier pick'}
          </span>
        </>
      )}
    </button>
  );
}
