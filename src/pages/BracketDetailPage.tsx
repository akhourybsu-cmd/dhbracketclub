import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, ArrowLeft, Check, X, Eye, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
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
    <div className="max-w-2xl mx-auto">
      <Link to={`/pools/${poolId}`} className="back-link">
        <ArrowLeft /> Back to Pool
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="page-header mb-0">
          <div className="page-header-icon">
            <Eye />
          </div>
          <div>
            <h1 className="page-header-title">{owner}'s Bracket</h1>
            <span className={cn("status-pill mt-0.5", statusCfg.className)}>{statusCfg.label}</span>
          </div>
        </div>
        {champPick && (
          <div className="glass-card px-3.5 py-2.5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Champion</p>
            <p className="text-sm font-bold">{champPick.short_name}</p>
            <p className="text-[10px] font-mono text-muted-foreground tabular-nums">({champPick.seed})</p>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5 mb-6">
        <div className="stat-card">
          <span className="stat-value text-success">{stats.correct}</span>
          <span className="stat-label">Correct</span>
        </div>
        <div className="stat-card">
          <span className="stat-value text-destructive">{stats.incorrect}</span>
          <span className="stat-label">Wrong</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Picks</span>
        </div>
      </div>

      {/* Round Nav */}
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

      {/* Round pills */}
      <div className="flex gap-1.5 mb-5 justify-center flex-wrap">
        {hasFirstFour && (
          <RoundPill
            label={FIRST_FOUR_ROUND_SHORT}
            isActive={currentRound === 0}
            onClick={() => setCurrentRound(0)}
          />
        )}
        {ROUND_SHORT.map((label, i) => (
          <RoundPill
            key={i}
            label={label}
            isActive={currentRound === i + 1}
            onClick={() => setCurrentRound(i + 1)}
          />
        ))}
      </div>

      {/* Games */}
      <div className="space-y-6">
        {regions.map(region => {
          const regionGames = roundGames.filter(g => g.region === region);
          return (
            <div key={region}>
              <div className="section-divider">
                <span className="section-header mb-0">{region}</span>
              </div>
              <div className="space-y-2.5">
                {regionGames.map(game => {
                  const pick = picks.get(game.id);
                  const t1 = getEffectiveTeam(game, 'team1', games, teams, picks);
                  const t2 = getEffectiveTeam(game, 'team2', games, teams, picks);
                  const winner = game.winner_team_id;

                  return (
                    <motion.div
                      key={game.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="matchup-card"
                    >
                      <DetailRow team={t1} isPicked={pick?.picked_team_id === t1?.id} winner={winner} />
                      <div className="h-px bg-border/20 mx-3" />
                      <DetailRow team={t2} isPicked={pick?.picked_team_id === t2?.id} winner={winner} />
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {bracket?.tiebreaker_score != null && (
        <div className="mt-6 glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-gold" />
            <span className="text-sm font-bold">Tiebreaker</span>
          </div>
          <p className="text-lg font-mono font-bold tabular-nums">{bracket.tiebreaker_score}</p>
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}

function RoundPill({ label, isActive, onClick }: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "round-pill btn-press",
        isActive ? "round-pill-active" : "round-pill-default"
      )}
    >
      {label}
    </button>
  );
}

function DetailRow({ team, isPicked, winner }: { team: Team | null; isPicked: boolean; winner: string | null }) {
  const isCorrect = winner && isPicked ? winner === team?.id : null;
  const isWrong = winner && isPicked ? winner !== team?.id : false;

  return (
    <div className={cn(
      "flex items-center gap-3 px-3.5 py-3",
      isCorrect === true && "bg-correct/10",
      isWrong && "bg-incorrect/8",
      isPicked && isCorrect === null && "bg-primary/8"
    )}>
      {team ? (
        <>
          <span className="text-[11px] font-mono font-bold text-muted-foreground w-6 tabular-nums text-center flex-shrink-0">{team.seed}</span>
          <span className={cn("text-sm font-medium flex-1 truncate", isPicked && "font-bold")}>{team.short_name}</span>
          {isPicked && isCorrect === true && <Check className="w-4 h-4 text-correct flex-shrink-0" />}
          {isPicked && isWrong && <X className="w-4 h-4 text-destructive flex-shrink-0" />}
          {isPicked && isCorrect === null && <div className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0" />}
        </>
      ) : (
        <span className="text-xs text-muted-foreground/50 italic ml-6">TBD</span>
      )}
    </div>
  );
}
