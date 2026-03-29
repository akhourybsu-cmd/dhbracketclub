import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, ArrowLeft, Check, X, Eye, Trophy, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Team, Game, Pick, ROUND_NAMES, ROUND_SHORT,
  FIRST_FOUR_ROUND_NAME, FIRST_FOUR_ROUND_SHORT,
  getEffectiveTeam, getBracketDisplayStatus, STATUS_CONFIG, TOTAL_GAMES,
} from '@/lib/bracketUtils';

export default function BracketDetailPage() {
  const { poolId, bracketId } = useParams();
  const { user } = useAuth();
  const [bracket, setBracket] = useState<any>(null);
  const [picks, setPicks] = useState<Map<string, Pick>>(new Map());
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Map<string, Team>>(new Map());
  const [owner, setOwner] = useState<string>('');
  const [pool, setPool] = useState<any>(null);
  const [currentRound, setCurrentRound] = useState(1);
  const [hasFirstFour, setHasFirstFour] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bracketId) return;
    const fetchData = async () => {
      const { data: bracketData } = await supabase
        .from('brackets')
        .select('*, profiles(display_name)')
        .eq('id', bracketId)
        .single();
      if (!bracketData) { setLoading(false); return; }
      setBracket(bracketData);
      setOwner((bracketData as any).profiles?.display_name || 'Unknown');

      const { data: poolData } = await supabase.from('pools').select('*, tournaments(id)').eq('id', bracketData.pool_id).single();
      if (!poolData) { setLoading(false); return; }
      setPool(poolData);

      const tid = poolData.tournaments?.id;
      if (!tid) { setLoading(false); return; }

      const { data: teamData } = await supabase.from('teams').select('*').eq('tournament_id', tid);
      if (teamData) {
        const m = new Map<string, Team>();
        teamData.forEach(t => m.set(t.id, t as Team));
        setTeams(m);
      }

      const { data: gameData } = await supabase.from('games').select('*').eq('tournament_id', tid).order('round_number').order('game_slot');
      if (gameData) {
        setGames(gameData as Game[]);
        const ff = gameData.some(g => g.round_number === 0);
        setHasFirstFour(ff);
        if (ff) setCurrentRound(0);
      }

      const { data: pickData } = await supabase.from('bracket_picks').select('game_id, picked_team_id, picked_in_round').eq('bracket_id', bracketId);
      if (pickData) {
        const pm = new Map<string, Pick>();
        pickData.forEach(p => pm.set(p.game_id, p));
        setPicks(pm);
      }
      setLoading(false);
    };
    fetchData();
  }, [bracketId]);

  const displayStatus = useMemo(() => {
    if (!bracket || !pool) return 'none';
    return getBracketDisplayStatus(bracket.status, pool.lock_time, picks.size, TOTAL_GAMES);
  }, [bracket, pool, picks]);

  const roundGames = games.filter(g => g.round_number === currentRound);
  const regions = [...new Set(roundGames.map(g => g.region))];

  const champPick = useMemo(() => {
    const p = Array.from(picks.values()).find(p => p.picked_in_round === 6);
    return p ? teams.get(p.picked_team_id) : null;
  }, [picks, teams]);

  const stats = useMemo(() => {
    let correct = 0, incorrect = 0;
    picks.forEach(pick => {
      const game = games.find(g => g.id === pick.game_id);
      if (game?.winner_team_id) {
        if (game.winner_team_id === pick.picked_team_id) correct++;
        else incorrect++;
      }
    });
    return { correct, incorrect, total: picks.size };
  }, [picks, games]);

  const statusCfg = STATUS_CONFIG[displayStatus];
  const currentRoundName = currentRound === 0 ? FIRST_FOUR_ROUND_NAME : ROUND_NAMES[currentRound - 1];

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="loading-spinner-ring" />
        <p className="loading-spinner-text">Loading bracket…</p>
      </div>
    );
  }

  if (!bracket) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><Eye /></div>
        <p className="empty-state-title">Bracket not found</p>
        <p className="empty-state-desc">This bracket may have been removed.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-8">
      <Link to={`/pools/${poolId}`} className="back-link">
        <ArrowLeft /> Back to Pool
      </Link>

      {/* ═══ Header ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mb-6"
      >
        <div className="absolute -inset-x-4 -top-8 -bottom-4 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 70% 60% at 50% 0%, hsl(var(--primary) / 0.05), transparent)',
        }} />

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{
              background: 'linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.06))',
              boxShadow: '0 0 24px hsl(var(--primary) / 0.1)',
            }}>
              <Eye className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">{owner}'s Bracket</h1>
              <span className={cn("status-pill mt-1", statusCfg.className)}>{statusCfg.label}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══ Champion + Stats ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-3 mb-6"
        style={{ gridTemplateColumns: champPick ? '1fr 1fr' : '1fr' }}
      >
        {/* Champion card */}
        {champPick && (
          <div className="rounded-2xl p-5 relative overflow-hidden" style={{
            background: 'linear-gradient(135deg, hsl(var(--card)), hsl(var(--surface-elevated)))',
            border: '1px solid hsl(var(--gold) / 0.15)',
            boxShadow: '0 0 24px hsl(var(--gold) / 0.04), var(--shadow-card)',
          }}>
            <div className="absolute inset-0 pointer-events-none" style={{
              background: 'radial-gradient(ellipse 80% 60% at 50% 0%, hsl(var(--gold) / 0.05), transparent)',
            }} />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-4 h-4 text-gold" style={{ filter: 'drop-shadow(0 0 4px hsl(var(--gold) / 0.3))' }} />
                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-gold/70">Champion</span>
              </div>
              <p className="text-lg font-extrabold text-gold">{champPick.short_name}</p>
              <p className="text-xs font-mono text-muted-foreground tabular-nums mt-0.5">Seed #{champPick.seed}</p>
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl p-3 text-center relative overflow-hidden" style={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border) / 0.4)',
            boxShadow: 'var(--shadow-card)',
          }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-card-shine)', opacity: 0.4 }} />
            <span className="block text-xl font-extrabold tabular-nums relative z-10" style={{ color: 'hsl(var(--success))' }}>{stats.correct}</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground relative z-10">Correct</span>
          </div>
          <div className="rounded-xl p-3 text-center relative overflow-hidden" style={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border) / 0.4)',
            boxShadow: 'var(--shadow-card)',
          }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-card-shine)', opacity: 0.4 }} />
            <span className="block text-xl font-extrabold tabular-nums relative z-10" style={{ color: 'hsl(var(--destructive))' }}>{stats.incorrect}</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground relative z-10">Wrong</span>
          </div>
          <div className="rounded-xl p-3 text-center relative overflow-hidden" style={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border) / 0.4)',
            boxShadow: 'var(--shadow-card)',
          }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-card-shine)', opacity: 0.4 }} />
            <span className="block text-xl font-extrabold tabular-nums relative z-10">{stats.total}</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground relative z-10">Picks</span>
          </div>
        </div>
      </motion.div>

      {/* ═══ Round Nav ═══ */}
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
        <h2 className="text-xl font-extrabold tracking-tight">{currentRoundName}</h2>
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
          <RoundPill label={FIRST_FOUR_ROUND_SHORT} isActive={currentRound === 0} onClick={() => setCurrentRound(0)} />
        )}
        {ROUND_SHORT.map((label, i) => (
          <RoundPill key={i} label={label} isActive={currentRound === i + 1} onClick={() => setCurrentRound(i + 1)} isChampionship={i + 1 === 6} />
        ))}
      </div>

      {/* ═══ Games ═══ */}
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
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{region}</span>
                  <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, hsl(var(--border) / 0.4), transparent)' }} />
                </div>
                <div className="space-y-3">
                  {regionGames.map((game, idx) => {
                    const pick = picks.get(game.id);
                    const t1 = getEffectiveTeam(game, 'team1', games, teams, picks);
                    const t2 = getEffectiveTeam(game, 'team2', games, teams, picks);
                    const winner = game.winner_team_id;
                    const isChampGame = game.round_number === 6;

                    return (
                      <motion.div
                        key={game.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.035, type: 'spring', damping: 25 }}
                        className="rounded-2xl overflow-hidden relative"
                        style={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border) / 0.4)',
                          boxShadow: 'var(--shadow-card)',
                        }}
                      >
                        <div className="absolute inset-0 pointer-events-none rounded-2xl" style={{
                          background: 'var(--gradient-card-shine)',
                          opacity: 0.4,
                        }} />
                        <div className="relative z-10">
                          <DetailRow team={t1} isPicked={pick?.picked_team_id === t1?.id} winner={winner} isChampGame={isChampGame} />
                          <div className="h-px mx-4" style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--border) / 0.2), transparent)' }} />
                          <DetailRow team={t2} isPicked={pick?.picked_team_id === t2?.id} winner={winner} isChampGame={isChampGame} />
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
      {bracket?.tiebreaker_score != null && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 rounded-2xl p-5 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--card)), hsl(var(--surface-elevated)))',
            border: '1px solid hsl(var(--gold) / 0.15)',
            boxShadow: '0 0 24px hsl(var(--gold) / 0.04), var(--shadow-card)',
          }}
        >
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% 0%, hsl(var(--gold) / 0.04), transparent)',
          }} />
          <div className="flex items-center gap-2.5 mb-2 relative z-10">
            <Trophy className="w-4 h-4 text-gold" />
            <span className="text-sm font-bold">Tiebreaker</span>
          </div>
          <p className="text-2xl font-mono font-extrabold tabular-nums relative z-10">{bracket.tiebreaker_score}</p>
        </motion.div>
      )}

      <div className="h-8" />
    </div>
  );
}

/* ═══ Round Pill ═══ */
function RoundPill({ label, isActive, onClick, isChampionship }: {
  label: string;
  isActive: boolean;
  onClick: () => void;
  isChampionship?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all duration-200"
      style={isActive ? {
        background: isChampionship
          ? 'linear-gradient(135deg, hsl(var(--gold) / 0.2), hsl(var(--gold) / 0.08))'
          : 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
        color: isChampionship ? 'hsl(var(--gold))' : 'hsl(var(--primary-foreground))',
        boxShadow: isChampionship
          ? '0 0 16px hsl(var(--gold) / 0.15)'
          : '0 0 16px hsl(var(--primary) / 0.25), 0 2px 8px rgba(0,0,0,0.2)',
      } : {
        background: 'hsl(var(--surface-elevated))',
        color: 'hsl(var(--muted-foreground))',
        border: '1px solid hsl(var(--border) / 0.3)',
      }}
    >
      {label}
    </button>
  );
}

/* ═══ Detail Row ═══ */
function DetailRow({ team, isPicked, winner, isChampGame }: {
  team: Team | null;
  isPicked: boolean;
  winner: string | null;
  isChampGame?: boolean;
}) {
  const isCorrect = winner && isPicked ? winner === team?.id : null;
  const isWrong = winner && isPicked ? winner !== team?.id : false;

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-3.5 transition-all duration-200 relative",
      !isPicked && winner && "opacity-35",
    )} style={{
      ...(isCorrect === true ? {
        background: 'linear-gradient(90deg, hsl(var(--success) / 0.08), hsl(var(--success) / 0.02))',
      } : isWrong ? {
        background: 'linear-gradient(90deg, hsl(var(--destructive) / 0.06), transparent)',
      } : isPicked && isCorrect === null ? {
        background: isChampGame
          ? 'linear-gradient(90deg, hsl(var(--gold) / 0.06), transparent)'
          : 'linear-gradient(90deg, hsl(var(--primary) / 0.06), transparent)',
      } : {}),
    }}>
      {/* Selection indicator */}
      {isPicked && (
        <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full" style={{
          background: isCorrect === true
            ? 'hsl(var(--success))'
            : isWrong
              ? 'hsl(var(--destructive))'
              : isChampGame ? 'hsl(var(--gold))' : 'hsl(var(--primary))',
          boxShadow: isCorrect === true
            ? '0 0 6px hsl(var(--success) / 0.3)'
            : isWrong
              ? '0 0 6px hsl(var(--destructive) / 0.3)'
              : `0 0 6px hsl(var(--${isChampGame ? 'gold' : 'primary'}) / 0.3)`,
        }} />
      )}

      {team ? (
        <>
          {/* Seed */}
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{
            background: isPicked
              ? isCorrect === true
                ? 'hsl(var(--success) / 0.12)'
                : isWrong
                  ? 'hsl(var(--destructive) / 0.1)'
                  : isChampGame ? 'hsl(var(--gold) / 0.12)' : 'hsl(var(--primary) / 0.12)'
              : 'hsl(var(--surface))',
            border: '1px solid hsl(var(--border) / 0.15)',
          }}>
            <span className="text-[11px] font-mono font-bold tabular-nums" style={{
              color: isPicked
                ? isCorrect === true
                  ? 'hsl(var(--success))'
                  : isWrong
                    ? 'hsl(var(--destructive))'
                    : isChampGame ? 'hsl(var(--gold))' : 'hsl(var(--primary))'
                : 'hsl(var(--muted-foreground))',
            }}>{team.seed}</span>
          </div>

          {/* Name */}
          <span className={cn(
            "text-sm flex-1 truncate transition-colors",
            isPicked ? "font-bold" : "font-medium text-foreground/80",
          )} style={{
            ...(isPicked && isChampGame && isCorrect === null ? { color: 'hsl(var(--gold))' } : {}),
          }}>
            {team.short_name}
          </span>

          {/* Crown for champ pick */}
          {isPicked && isChampGame && isCorrect === null && (
            <Crown className="w-4 h-4 text-gold flex-shrink-0" style={{ filter: 'drop-shadow(0 0 4px hsl(var(--gold) / 0.3))' }} />
          )}

          {/* Result icons */}
          {isPicked && isCorrect === true && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'hsl(var(--success))', boxShadow: '0 0 8px hsl(var(--success) / 0.3)' }}
            >
              <Check className="w-3 h-3 text-white" />
            </motion.div>
          )}
          {isPicked && isWrong && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'hsl(var(--destructive) / 0.15)', border: '1px solid hsl(var(--destructive) / 0.3)' }}
            >
              <X className="w-3 h-3" style={{ color: 'hsl(var(--destructive))' }} />
            </motion.div>
          )}
          {isPicked && isCorrect === null && !isChampGame && (
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{
              background: 'hsl(var(--primary))',
              boxShadow: '0 0 6px hsl(var(--primary) / 0.3)',
            }} />
          )}
        </>
      ) : (
        <>
          <div className="w-7 h-7 rounded-lg" style={{ background: 'hsl(var(--surface))', border: '1px solid hsl(var(--border) / 0.15)' }} />
          <span className="text-xs text-muted-foreground/60 italic font-medium">TBD</span>
        </>
      )}
    </div>
  );
}
