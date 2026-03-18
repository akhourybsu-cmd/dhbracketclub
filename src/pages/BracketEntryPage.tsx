import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Save, Send, ChevronLeft, ChevronRight, ArrowLeft, Check, Trophy, Crown, Sparkles, Lock } from 'lucide-react';
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
  const [isLateEntry, setIsLateEntry] = useState(false);

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

      const isLocked = new Date(poolData.lock_time) <= new Date();
      const allowLate = (poolData as any).allow_late_entries === true;

      if (isLocked && !allowLate) {
        toast.error('This pool is locked.');
        navigate(`/pools/${poolId}`);
        return;
      }
      if (isLocked && allowLate) {
        setIsLateEntry(true);
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

  // Games that are locked for late entries (in_progress or final)
  const lockedGameIds = useMemo(() => {
    if (!isLateEntry) return new Set<string>();
    return new Set(games.filter(g => g.status === 'in_progress' || g.status === 'final').map(g => g.id));
  }, [games, isLateEntry]);

  const handlePick = (gameId: string, teamId: string, round: number) => {
    if (lockedGameIds.has(gameId)) return;
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
    const pickableGames = games.filter(g => !lockedGameIds.has(g.id));
    const pickableCount = pickableGames.length;
    const filledPickable = pickableGames.filter(g => picks.has(g.id)).length;
    if (filledPickable < pickableCount) {
      toast.error(`Complete all ${pickableCount} available picks before submitting. You have ${filledPickable}.`);
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

  // Champion pick for display
  const champPick = useMemo(() => {
    const p = Array.from(picks.values()).find(p => p.picked_in_round === 6);
    return p ? teams.get(p.picked_team_id) : null;
  }, [picks, teams]);

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
  const isChampionshipRound = currentRound === 6;

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* ═══ Sticky Header ═══ */}
      <div className="sticky top-0 z-30 -mx-4 px-4 sm:-mx-6 sm:px-6 pt-1 pb-3 mb-2" style={{
        background: 'linear-gradient(180deg, hsl(var(--background)), hsl(var(--background) / 0.95))',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid hsl(var(--border) / 0.15)',
      }}>
        <div className="flex items-center gap-3">
          <Link to={`/pools/${poolId}`} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 -ml-1.5 rounded-xl hover:bg-secondary/50">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">Fill Your Bracket</h1>
            {bracket?.status === 'submitted' && (
              <p className="text-[10px] sm:text-xs font-semibold" style={{ color: 'hsl(var(--success))' }}>Submitted — editing will revert to draft</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={saveDraft} disabled={saving} className="font-semibold h-9 px-3 rounded-xl btn-press text-xs sm:text-sm">
              <Save className="w-4 h-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Save</span>
            </Button>
            <Button size="sm" onClick={submitBracket} disabled={saving} className="font-semibold h-9 px-3 rounded-xl btn-press text-xs sm:text-sm" style={{
              background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
              boxShadow: '0 0 16px hsl(var(--primary) / 0.2)',
            }}>
              <Send className="w-4 h-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Submit</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ═══ Progress Bar ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-4 mb-5 relative overflow-hidden"
        style={{
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border) / 0.4)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-card-shine)', opacity: 0.5 }} />
        <div className="flex items-center justify-between mb-2.5 relative z-10">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold tabular-nums">{progress.filled}</span>
            <span className="text-sm text-muted-foreground font-medium">/ {progress.total} picks</span>
          </div>
          <span className="text-lg font-extrabold tabular-nums text-primary">{progress.pct}%</span>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden relative z-10" style={{ background: 'hsl(var(--surface))' }}>
          <motion.div
            className="h-full rounded-full"
            style={{
              background: progress.pct === 100
                ? 'linear-gradient(90deg, hsl(var(--success)), hsl(var(--accent)))'
                : 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
              boxShadow: '0 0 12px hsl(var(--primary) / 0.3)',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progress.pct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        {champPick && (
          <div className="flex items-center gap-2 mt-3 relative z-10">
            <Crown className="w-3.5 h-3.5 text-gold" />
            <span className="text-xs text-muted-foreground">Champion:</span>
            <span className="text-xs font-bold text-gold">{champPick.short_name}</span>
          </div>
        )}
      </motion.div>

      {/* ═══ Late Entry Banner ═══ */}
      {isLateEntry && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-4 mb-5 flex items-start gap-3"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--warning) / 0.1), hsl(var(--warning) / 0.03))',
            border: '1px solid hsl(var(--warning) / 0.2)',
          }}
        >
          <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'hsl(var(--warning))' }} />
          <div>
            <p className="text-xs font-bold" style={{ color: 'hsl(var(--warning))' }}>Late Entry Mode</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Games that are in progress or finished are locked. You'll miss points for those games.
            </p>
          </div>
        </motion.div>
      )}

      {/* ═══ Round Navigation ═══ */}
      <div className="flex items-center justify-between mb-3">
        <button
          disabled={currentRound <= (hasFirstFour ? 0 : 1)}
          onClick={() => setCurrentRound(r => r - 1)}
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-20"
          style={{
            background: 'hsl(var(--surface-elevated))',
            border: '1px solid hsl(var(--border) / 0.3)',
          }}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h2 className="text-xl font-extrabold tracking-tight">{currentRoundName}</h2>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground tabular-nums font-medium">
              {rc?.filled}/{rc?.total} picks
            </span>
            {rc && rc.filled === rc.total && rc.total > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  background: 'hsl(var(--success) / 0.12)',
                  color: 'hsl(var(--success))',
                }}
              >
                <Check className="w-2.5 h-2.5" /> Done
              </motion.span>
            )}
          </div>
        </div>
        <button
          disabled={currentRound >= 6}
          onClick={() => setCurrentRound(r => r + 1)}
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-20"
          style={{
            background: 'hsl(var(--surface-elevated))',
            border: '1px solid hsl(var(--border) / 0.3)',
          }}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* ═══ Round Tabs ═══ */}
      <div className="flex gap-1.5 mb-6 justify-center flex-wrap">
        {hasFirstFour && (
          <RoundPill
            label={FIRST_FOUR_ROUND_SHORT}
            isActive={currentRound === 0}
            isComplete={roundCompletion[0]?.filled === roundCompletion[0]?.total && (roundCompletion[0]?.total ?? 0) > 0}
            onClick={() => setCurrentRound(0)}
            progress={roundCompletion[0] ? roundCompletion[0].filled / roundCompletion[0].total : 0}
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
              progress={rcomp && rcomp.total > 0 ? rcomp.filled / rcomp.total : 0}
              isChampionship={i + 1 === 6}
            />
          );
        })}
      </div>

      {/* ═══ Games by Region ═══ */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentRound}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.25, type: 'spring', damping: 25, stiffness: 300 }}
          className="space-y-7"
        >
          {regions.map(region => {
            const regionGames = roundGames.filter(g => g.region === region);
            return (
              <div key={region}>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 mb-3"
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    {region}
                  </span>
                  <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, hsl(var(--border) / 0.4), transparent)' }} />
                  <span className="text-[10px] text-muted-foreground/40 tabular-nums font-medium">
                    {regionGames.filter(g => picks.has(g.id)).length}/{regionGames.length}
                  </span>
                </motion.div>
                <div className="space-y-3">
                  {regionGames.map((game, idx) => {
                    const team1 = getEffectiveTeam(game, 'team1', games, teams, picks);
                    const team2 = getEffectiveTeam(game, 'team2', games, teams, picks);
                    const currentPick = picks.get(game.id);
                    const hasPlayIn = game.round_number === 1 && games.some(g => g.round_number === 0 && g.region === game.region);
                    const isPicked = !!currentPick;
                    const isGameLocked = lockedGameIds.has(game.id);

                    return (
                      <motion.div
                        key={game.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.035, type: 'spring', damping: 25, stiffness: 300 }}
                        className={cn("rounded-2xl overflow-hidden relative group", isGameLocked && "opacity-50")}
                        style={{
                          background: 'hsl(var(--card))',
                          border: isGameLocked
                            ? '1px solid hsl(var(--destructive) / 0.2)'
                            : isPicked
                              ? '1px solid hsl(var(--primary) / 0.25)'
                              : '1px solid hsl(var(--border) / 0.4)',
                          boxShadow: isPicked && !isGameLocked
                            ? '0 0 16px hsl(var(--primary) / 0.06), var(--shadow-card)'
                            : 'var(--shadow-card)',
                          transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
                        }}
                      >
                        {/* Shine overlay */}
                        <div className="absolute inset-0 pointer-events-none rounded-2xl" style={{
                          background: 'var(--gradient-card-shine)',
                          opacity: 0.4,
                        }} />

                        {/* Game header */}
                        <div className="flex items-center justify-between px-4 py-2 relative z-10" style={{
                          background: isGameLocked
                            ? 'hsl(var(--destructive) / 0.04)'
                            : 'hsl(var(--surface) / 0.4)',
                          borderBottom: '1px solid hsl(var(--border) / 0.15)',
                        }}>
                          <span className="text-[10px] font-bold text-muted-foreground/40 tabular-nums">
                            Game {game.game_slot}
                          </span>
                          {isGameLocked ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
                              background: 'hsl(var(--destructive) / 0.1)',
                              color: 'hsl(var(--destructive))',
                              border: '1px solid hsl(var(--destructive) / 0.15)',
                            }}>
                              <Lock className="w-2.5 h-2.5" /> Locked
                            </span>
                          ) : isPicked ? (
                            <motion.span
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{
                                background: 'linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))',
                                color: 'hsl(var(--primary))',
                                border: '1px solid hsl(var(--primary) / 0.12)',
                              }}
                            >
                              <Check className="w-3 h-3" /> Picked
                            </motion.span>
                          ) : null}
                        </div>

                        <div className="relative z-10">
                          <MatchupTeamRow
                            team={team1}
                            isSelected={currentPick?.picked_team_id === team1?.id}
                            isOpponentSelected={currentPick?.picked_team_id === team2?.id}
                            onSelect={() => team1 && handlePick(game.id, team1.id, game.round_number)}
                            disabled={!team1 || isGameLocked}
                            isPlayInSlot={!team1 && hasPlayIn}
                            isChampionshipRound={isChampionshipRound}
                          />
                          <div className="h-px mx-4" style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--border) / 0.2), transparent)' }} />
                          <MatchupTeamRow
                            team={team2}
                            isSelected={currentPick?.picked_team_id === team2?.id}
                            isOpponentSelected={currentPick?.picked_team_id === team1?.id}
                            onSelect={() => team2 && handlePick(game.id, team2.id, game.round_number)}
                            disabled={!team2 || isGameLocked}
                            isPlayInSlot={!team2 && hasPlayIn}
                            isChampionshipRound={isChampionshipRound}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* ═══ Tiebreaker ═══ */}
      {currentRound === 6 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 rounded-2xl p-6 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--card)), hsl(var(--surface-elevated)))',
            border: '1px solid hsl(var(--gold) / 0.15)',
            boxShadow: '0 0 24px hsl(var(--gold) / 0.04), var(--shadow-card)',
          }}
        >
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% 0%, hsl(var(--gold) / 0.04), transparent)',
          }} />
          <div className="flex items-center gap-2.5 mb-3 relative z-10">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{
              background: 'linear-gradient(135deg, hsl(var(--gold) / 0.2), hsl(var(--gold) / 0.06))',
            }}>
              <Trophy className="w-4 h-4 text-gold" />
            </div>
            <label className="text-sm font-bold">Tiebreaker</label>
          </div>
          <p className="text-xs text-muted-foreground mb-4 relative z-10">Predict the total combined score of the Championship game</p>
          <Input
            type="number"
            value={tiebreaker}
            onChange={(e) => setTiebreaker(e.target.value)}
            placeholder="e.g. 145"
            className="font-mono h-14 text-center text-xl font-bold rounded-xl relative z-10"
            style={{
              background: 'hsl(var(--surface))',
              border: '1px solid hsl(var(--border) / 0.4)',
            }}
          />
        </motion.div>
      )}

      <div className="h-8" />
    </div>
  );
}

/* ═══ Round Pill ═══ */
function RoundPill({ label, isActive, isComplete, onClick, progress = 0, isChampionship }: {
  label: string;
  isActive: boolean;
  isComplete: boolean;
  onClick: () => void;
  progress?: number;
  isChampionship?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="relative px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all duration-200"
      style={isActive ? {
        background: isChampionship
          ? 'linear-gradient(135deg, hsl(var(--gold) / 0.2), hsl(var(--gold) / 0.08))'
          : 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
        color: isChampionship ? 'hsl(var(--gold))' : 'hsl(var(--primary-foreground))',
        boxShadow: isChampionship
          ? '0 0 16px hsl(var(--gold) / 0.15)'
          : '0 0 16px hsl(var(--primary) / 0.25), 0 2px 8px rgba(0,0,0,0.2)',
      } : isComplete ? {
        background: 'linear-gradient(135deg, hsl(var(--success) / 0.12), hsl(var(--success) / 0.04))',
        color: 'hsl(var(--success))',
        border: '1px solid hsl(var(--success) / 0.15)',
      } : {
        background: 'hsl(var(--surface-elevated))',
        color: 'hsl(var(--muted-foreground))',
        border: '1px solid hsl(var(--border) / 0.3)',
      }}
    >
      {label}
      {isComplete && !isActive && (
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{
          background: 'hsl(var(--success))',
          boxShadow: '0 0 6px hsl(var(--success) / 0.3)',
        }}>
          <Check className="w-2 h-2 text-white" />
        </span>
      )}
    </button>
  );
}

/* ═══ Matchup Team Row ═══ */
function MatchupTeamRow({ team, isSelected, isOpponentSelected, onSelect, disabled, isPlayInSlot, isChampionshipRound }: {
  team: Team | null;
  isSelected: boolean;
  isOpponentSelected?: boolean;
  onSelect: () => void;
  disabled: boolean;
  isPlayInSlot?: boolean;
  isChampionshipRound?: boolean;
}) {
  return (
    <motion.button
      onClick={onSelect}
      disabled={disabled}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-4 text-left transition-all duration-200 relative",
        !isSelected && !disabled && "hover:bg-secondary/40",
        isOpponentSelected && !isSelected && "opacity-35",
        disabled && "opacity-25 cursor-not-allowed"
      )}
      style={isSelected ? {
        background: isChampionshipRound
          ? 'linear-gradient(90deg, hsl(var(--gold) / 0.08), hsl(var(--gold) / 0.02))'
          : 'linear-gradient(90deg, hsl(var(--primary) / 0.1), hsl(var(--primary) / 0.02))',
      } : undefined}
    >
      {/* Selection indicator bar */}
      {isSelected && (
        <motion.div
          layoutId="selection-bar"
          className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full"
          style={{
            background: isChampionshipRound ? 'hsl(var(--gold))' : 'hsl(var(--primary))',
            boxShadow: isChampionshipRound
              ? '0 0 8px hsl(var(--gold) / 0.4)'
              : '0 0 8px hsl(var(--primary) / 0.4)',
          }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        />
      )}

      {team ? (
        <>
          {/* Seed badge */}
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-mono font-bold tabular-nums flex-shrink-0 transition-all duration-200",
          )} style={isSelected ? {
            background: isChampionshipRound
              ? 'linear-gradient(135deg, hsl(var(--gold) / 0.2), hsl(var(--gold) / 0.08))'
              : 'linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.08))',
            color: isChampionshipRound ? 'hsl(var(--gold))' : 'hsl(var(--primary))',
            border: `1px solid hsl(var(--${isChampionshipRound ? 'gold' : 'primary'}) / 0.15)`,
          } : {
            background: 'hsl(var(--surface))',
            color: 'hsl(var(--muted-foreground))',
            border: '1px solid hsl(var(--border) / 0.2)',
          }}>
            {team.seed}
          </div>

          {/* Team name */}
          <span className={cn(
            "text-sm flex-1 min-w-0 transition-all duration-200",
            isSelected
              ? isChampionshipRound ? "text-gold font-bold" : "text-primary font-bold"
              : "font-medium text-foreground/80"
          )}>
            <span className="block truncate">{team.short_name}</span>
          </span>

          {/* Championship crown */}
          {isSelected && isChampionshipRound && (
            <motion.div
              initial={{ rotate: -20, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <Crown className="w-4 h-4 text-gold" style={{ filter: 'drop-shadow(0 0 4px hsl(var(--gold) / 0.3))' }} />
            </motion.div>
          )}

          {/* Selection check */}
          <AnimatePresence>
            {isSelected && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: isChampionshipRound
                    ? 'linear-gradient(135deg, hsl(var(--gold)), hsl(var(--gold) / 0.8))'
                    : 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
                  boxShadow: isChampionshipRound
                    ? '0 0 10px hsl(var(--gold) / 0.3)'
                    : '0 0 10px hsl(var(--primary) / 0.3)',
                }}
              >
                <Check className="w-3.5 h-3.5 text-white" />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <>
          <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{
            background: 'hsl(var(--surface))',
            border: '1px solid hsl(var(--border) / 0.15)',
          }} />
          <span className="text-xs text-muted-foreground/40 italic font-medium">
            {isPlayInSlot ? 'TBD — First Four' : 'Waiting for earlier pick'}
          </span>
        </>
      )}
    </motion.button>
  );
}
