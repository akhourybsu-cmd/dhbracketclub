import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Team {
  id: string;
  school_name: string;
  short_name: string;
  seed: number;
  region: string;
}

const ROUND_NAMES = ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite 8', 'Final Four', 'Championship'];

export default function BracketDetailPage() {
  const { poolId, bracketId } = useParams();
  const { user } = useAuth();
  const [bracket, setBracket] = useState<any>(null);
  const [picks, setPicks] = useState<Map<string, any>>(new Map());
  const [games, setGames] = useState<any[]>([]);
  const [teams, setTeams] = useState<Map<string, Team>>(new Map());
  const [owner, setOwner] = useState<string>('');
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

      // Get pool to find tournament
      const { data: pool } = await supabase
        .from('pools')
        .select('tournament_id')
        .eq('id', bracketData.pool_id)
        .single();

      if (!pool) { setLoading(false); return; }

      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
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

      if (gameData) setGames(gameData);

      const { data: pickData } = await supabase
        .from('bracket_picks')
        .select('*')
        .eq('bracket_id', bracketId);

      if (pickData) {
        const pm = new Map();
        pickData.forEach(p => pm.set(p.game_id, p));
        setPicks(pm);
      }

      setLoading(false);
    };

    fetchData();
  }, [bracketId]);

  const roundGames = games.filter(g => g.round_number === currentRound);
  const regions = [...new Set(roundGames.map(g => g.region))];

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <Link to={`/pools/${poolId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Pool
      </Link>

      <div className="mb-4">
        <h1 className="text-lg font-bold">{owner}'s Bracket</h1>
        <span className={`status-pill ${bracket?.status === 'submitted' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>
          {bracket?.status === 'submitted' ? 'Submitted' : 'Draft'}
        </span>
      </div>

      {/* Round Nav */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" disabled={currentRound <= 1} onClick={() => setCurrentRound(r => r - 1)}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <p className="text-sm font-semibold">{ROUND_NAMES[currentRound - 1]}</p>
        <Button variant="ghost" size="icon" disabled={currentRound >= 6} onClick={() => setCurrentRound(r => r + 1)}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex gap-1 mb-6 justify-center">
        {ROUND_NAMES.map((_, i) => (
          <button key={i} onClick={() => setCurrentRound(i + 1)}
            className={cn("w-8 h-1.5 rounded-full transition-colors", currentRound === i + 1 ? "bg-primary" : "bg-secondary")} />
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
                  const pick = picks.get(game.id);
                  const team1 = game.team1_id ? teams.get(game.team1_id) : null;
                  const team2 = game.team2_id ? teams.get(game.team2_id) : null;
                  const winner = game.winner_team_id;

                  return (
                    <div key={game.id} className="matchup-card">
                      <PickRow team={team1} isPicked={pick?.picked_team_id === team1?.id} isCorrect={winner ? pick?.picked_team_id === winner && winner === team1?.id : null} />
                      <div className="h-px bg-border mx-2" />
                      <PickRow team={team2} isPicked={pick?.picked_team_id === team2?.id} isCorrect={winner ? pick?.picked_team_id === winner && winner === team2?.id : null} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {bracket?.tiebreaker_score && (
        <div className="mt-6 glass-card p-4">
          <p className="text-xs text-muted-foreground">Tiebreaker Prediction</p>
          <p className="text-lg font-mono font-bold tabular-nums">{bracket.tiebreaker_score}</p>
        </div>
      )}
    </div>
  );
}

function PickRow({ team, isPicked, isCorrect }: { team: any; isPicked: boolean; isCorrect: boolean | null }) {
  return (
    <div className={cn(
      "flex items-center gap-3 px-3 py-2.5",
      isPicked && isCorrect === true && "bg-correct/10",
      isPicked && isCorrect === false && "bg-incorrect/10",
      isPicked && isCorrect === null && "bg-primary/10"
    )}>
      {team ? (
        <>
          <span className="text-xs font-mono font-bold text-muted-foreground w-5 tabular-nums">{team.seed}</span>
          <span className={cn("text-sm font-medium flex-1", isPicked && "font-semibold")}>{team.short_name}</span>
          {isPicked && <div className={cn("w-2 h-2 rounded-full", isCorrect === true ? "bg-correct" : isCorrect === false ? "bg-incorrect" : "bg-primary")} />}
        </>
      ) : (
        <span className="text-xs text-muted-foreground italic">TBD</span>
      )}
    </div>
  );
}
