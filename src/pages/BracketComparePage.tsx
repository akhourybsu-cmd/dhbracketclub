import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Team, Game, Pick, ROUND_NAMES, ROUND_SHORT, getEffectiveTeam } from '@/lib/bracketUtils';

export default function BracketComparePage() {
  const { poolId } = useParams<{ poolId: string }>();
  const [searchParams] = useSearchParams();
  const bracketAId = searchParams.get('a');
  const bracketBId = searchParams.get('b');
  const { user } = useAuth();

  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Map<string, Team>>(new Map());
  const [picksA, setPicksA] = useState<Map<string, Pick>>(new Map());
  const [picksB, setPicksB] = useState<Map<string, Pick>>(new Map());
  const [nameA, setNameA] = useState('');
  const [nameB, setNameB] = useState('');
  const [currentRound, setCurrentRound] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!poolId || !bracketAId || !bracketBId) return;

    const fetchData = async () => {
      const { data: pool } = await supabase.from('pools').select('tournament_id').eq('id', poolId).single();
      if (!pool) return;

      const { data: teamData } = await supabase.from('teams').select('*').eq('tournament_id', pool.tournament_id);
      if (teamData) {
        const m = new Map<string, Team>();
        teamData.forEach(t => m.set(t.id, t as Team));
        setTeams(m);
      }

      const { data: gameData } = await supabase.from('games').select('*')
        .eq('tournament_id', pool.tournament_id).order('round_number').order('game_slot');
      if (gameData) setGames(gameData as Game[]);

      // Bracket A
      const { data: bA } = await supabase.from('brackets').select('*, profiles(display_name)').eq('id', bracketAId).single();
      if (bA) setNameA((bA as any).profiles?.display_name || 'Player A');
      const { data: pA } = await supabase.from('bracket_picks').select('game_id, picked_team_id, picked_in_round').eq('bracket_id', bracketAId);
      if (pA) { const m = new Map<string, Pick>(); pA.forEach(p => m.set(p.game_id, p)); setPicksA(m); }

      // Bracket B
      const { data: bB } = await supabase.from('brackets').select('*, profiles(display_name)').eq('id', bracketBId).single();
      if (bB) setNameB((bB as any).profiles?.display_name || 'Player B');
      const { data: pB } = await supabase.from('bracket_picks').select('game_id, picked_team_id, picked_in_round').eq('bracket_id', bracketBId);
      if (pB) { const m = new Map<string, Pick>(); pB.forEach(p => m.set(p.game_id, p)); setPicksB(m); }

      setLoading(false);
    };
    fetchData();
  }, [poolId, bracketAId, bracketBId]);

  const roundGames = games.filter(g => g.round_number === currentRound);
  const regions = [...new Set(roundGames.map(g => g.region))];

  // Diff stats
  const diffStats = useMemo(() => {
    let same = 0, diff = 0, onlyA = 0, onlyB = 0;
    const allGameIds = new Set([...picksA.keys(), ...picksB.keys()]);
    allGameIds.forEach(gid => {
      const a = picksA.get(gid);
      const b = picksB.get(gid);
      if (a && b) {
        if (a.picked_team_id === b.picked_team_id) same++;
        else diff++;
      } else if (a) onlyA++;
      else onlyB++;
    });
    return { same, diff, onlyA, onlyB };
  }, [picksA, picksB]);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <Link to={`/pools/${poolId}/leaderboard`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Leaderboard
      </Link>

      <h1 className="text-lg font-bold mb-1">Compare Brackets</h1>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-medium text-primary">{nameA}</span>
        <span className="text-xs text-muted-foreground">vs</span>
        <span className="text-sm font-medium text-accent">{nameB}</span>
      </div>

      {/* Diff Summary */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="glass-card p-2.5 text-center">
          <p className="text-lg font-bold tabular-nums text-success">{diffStats.same}</p>
          <p className="text-[10px] text-muted-foreground">Same Picks</p>
        </div>
        <div className="glass-card p-2.5 text-center">
          <p className="text-lg font-bold tabular-nums text-warning">{diffStats.diff}</p>
          <p className="text-[10px] text-muted-foreground">Different</p>
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

      {/* Comparison */}
      <div className="space-y-5">
        {regions.map(region => {
          const regionGames = roundGames.filter(g => g.region === region);
          return (
            <div key={region}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{region}</h3>
              <div className="space-y-2">
                {regionGames.map(game => {
                  const t1 = getEffectiveTeam(game, 'team1', games, teams, picksA);
                  const t2 = getEffectiveTeam(game, 'team2', games, teams, picksA);
                  const pickA = picksA.get(game.id);
                  const pickB = picksB.get(game.id);
                  const same = pickA && pickB && pickA.picked_team_id === pickB.picked_team_id;
                  const winner = game.winner_team_id;

                  return (
                    <div key={game.id} className={cn("matchup-card", !same && pickA && pickB && "ring-1 ring-warning/30")}>
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-0">
                        {/* Header */}
                        <div className="px-3 py-1 text-[10px] font-medium text-primary border-b border-border/30">{nameA}</div>
                        <div className="px-2 py-1 text-[10px] text-muted-foreground border-b border-border/30 text-center">vs</div>
                        <div className="px-3 py-1 text-[10px] font-medium text-accent border-b border-border/30 text-right">{nameB}</div>

                        {/* Picks */}
                        <div className={cn("px-3 py-2", pickA && winner === pickA.picked_team_id ? "bg-correct/8" : pickA && winner && winner !== pickA.picked_team_id ? "bg-incorrect/8" : "")}>
                          {pickA ? (
                            <span className="text-sm font-medium">{teams.get(pickA.picked_team_id)?.short_name || '?'}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </div>
                        <div className="flex items-center justify-center">
                          {same ? (
                            <div className="w-2 h-2 rounded-full bg-success" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-warning" />
                          )}
                        </div>
                        <div className={cn("px-3 py-2 text-right", pickB && winner === pickB.picked_team_id ? "bg-correct/8" : pickB && winner && winner !== pickB.picked_team_id ? "bg-incorrect/8" : "")}>
                          {pickB ? (
                            <span className="text-sm font-medium">{teams.get(pickB.picked_team_id)?.short_name || '?'}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </div>
                      </div>
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
