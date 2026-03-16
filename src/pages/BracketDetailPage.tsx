import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, ArrowLeft, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
      if (gameData) setGames(gameData as Game[]);

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

  // Champion pick
  const champPick = useMemo(() => {
    const p = Array.from(picks.values()).find(p => p.picked_in_round === 6);
    return p ? teams.get(p.picked_team_id) : null;
  }, [picks, teams]);

  // Stats
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

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!bracket) {
    return <div className="text-center py-12 text-muted-foreground">Bracket not found.</div>;
  }

  return (
    <div>
      <Link to={`/pools/${poolId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Pool
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold">{owner}'s Bracket</h1>
          <span className={`status-pill ${statusCfg.className} mt-1`}>{statusCfg.label}</span>
        </div>
        {champPick && (
          <div className="glass-card px-3 py-2 text-center">
            <p className="text-[10px] text-muted-foreground">Champion</p>
            <p className="text-sm font-bold">{champPick.short_name}</p>
            <p className="text-[10px] font-mono text-muted-foreground">({champPick.seed})</p>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="glass-card p-2.5 text-center">
          <p className="text-lg font-bold tabular-nums text-success">{stats.correct}</p>
          <p className="text-[10px] text-muted-foreground">Correct</p>
        </div>
        <div className="glass-card p-2.5 text-center">
          <p className="text-lg font-bold tabular-nums text-destructive">{stats.incorrect}</p>
          <p className="text-[10px] text-muted-foreground">Wrong</p>
        </div>
        <div className="glass-card p-2.5 text-center">
          <p className="text-lg font-bold tabular-nums">{stats.total}</p>
          <p className="text-[10px] text-muted-foreground">Picks</p>
        </div>
      </div>

      {/* Round Nav */}
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="icon" disabled={currentRound <= 1} onClick={() => setCurrentRound(r => r - 1)}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <p className="text-sm font-semibold">{ROUND_NAMES[currentRound - 1]}</p>
        <Button variant="ghost" size="icon" disabled={currentRound >= 6} onClick={() => setCurrentRound(r => r + 1)}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex gap-1.5 mb-5 justify-center">
        {ROUND_SHORT.map((label, i) => (
          <button key={i} onClick={() => setCurrentRound(i + 1)}
            className={cn("px-2 py-1 rounded-md text-[10px] font-semibold transition-colors",
              currentRound === i + 1 ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")} />
        ))}
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
                  const pick = picks.get(game.id);
                  const t1 = getEffectiveTeam(game, 'team1', games, teams, picks);
                  const t2 = getEffectiveTeam(game, 'team2', games, teams, picks);
                  const winner = game.winner_team_id;

                  return (
                    <div key={game.id} className="matchup-card">
                      <DetailRow team={t1} isPicked={pick?.picked_team_id === t1?.id} winner={winner} />
                      <div className="h-px bg-border mx-2" />
                      <DetailRow team={t2} isPicked={pick?.picked_team_id === t2?.id} winner={winner} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {bracket?.tiebreaker_score != null && (
        <div className="mt-5 glass-card p-4">
          <p className="text-xs text-muted-foreground">Tiebreaker Prediction</p>
          <p className="text-lg font-mono font-bold tabular-nums">{bracket.tiebreaker_score}</p>
        </div>
      )}
    </div>
  );
}

function DetailRow({ team, isPicked, winner }: { team: Team | null; isPicked: boolean; winner: string | null }) {
  const isCorrect = winner && isPicked ? winner === team?.id : null;
  const isWrong = winner && isPicked ? winner !== team?.id : false;

  return (
    <div className={cn(
      "flex items-center gap-3 px-3 py-2.5",
      isCorrect === true && "bg-correct/10",
      isWrong && "bg-incorrect/8",
      isPicked && isCorrect === null && "bg-primary/8"
    )}>
      {team ? (
        <>
          <span className="text-[11px] font-mono font-bold text-muted-foreground w-5 tabular-nums text-center">{team.seed}</span>
          <span className={cn("text-sm font-medium flex-1 truncate", isPicked && "font-semibold")}>{team.short_name}</span>
          {isPicked && isCorrect === true && <Check className="w-4 h-4 text-correct flex-shrink-0" />}
          {isPicked && isWrong && <X className="w-4 h-4 text-destructive flex-shrink-0" />}
          {isPicked && isCorrect === null && <div className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0" />}
        </>
      ) : (
        <span className="text-xs text-muted-foreground/50 italic ml-5">TBD</span>
      )}
    </div>
  );
}
