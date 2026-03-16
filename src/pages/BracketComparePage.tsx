import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { ArrowLeft, ChevronLeft, ChevronRight, GitCompare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
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

      const { data: bA } = await supabase.from('brackets').select('*, profiles(display_name)').eq('id', bracketAId).single();
      if (bA) setNameA((bA as any).profiles?.display_name || 'Player A');
      const { data: pA } = await supabase.from('bracket_picks').select('game_id, picked_team_id, picked_in_round').eq('bracket_id', bracketAId);
      if (pA) { const m = new Map<string, Pick>(); pA.forEach(p => m.set(p.game_id, p)); setPicksA(m); }

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

  const diffStats = useMemo(() => {
    let same = 0, diff = 0;
    const allGameIds = new Set([...picksA.keys(), ...picksB.keys()]);
    allGameIds.forEach(gid => {
      const a = picksA.get(gid);
      const b = picksB.get(gid);
      if (a && b) {
        if (a.picked_team_id === b.picked_team_id) same++;
        else diff++;
      }
    });
    return { same, diff };
  }, [picksA, picksB]);

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="loading-spinner-ring" />
        <p className="loading-spinner-text">Loading brackets…</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link to={`/pools/${poolId}/leaderboard`} className="back-link">
        <ArrowLeft /> Back to Leaderboard
      </Link>

      {/* Header */}
      <div className="page-header">
        <div className="page-header-icon">
          <GitCompare />
        </div>
        <div>
          <h1 className="page-header-title">Compare Brackets</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-semibold text-primary">{nameA}</span>
            <span className="text-[10px] text-muted-foreground">vs</span>
            <span className="text-xs font-semibold text-accent">{nameB}</span>
          </div>
        </div>
      </div>

      {/* Diff Summary */}
      <div className="grid grid-cols-2 gap-2.5 mb-6">
        <div className="stat-card">
          <span className="stat-value text-success">{diffStats.same}</span>
          <span className="stat-label">Same Picks</span>
        </div>
        <div className="stat-card">
          <span className="stat-value text-warning">{diffStats.diff}</span>
          <span className="stat-label">Different</span>
        </div>
      </div>

      {/* Round Nav */}
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="icon" disabled={currentRound <= 1} onClick={() => setCurrentRound(r => r - 1)} className="rounded-xl h-10 w-10 btn-press">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-lg font-extrabold tracking-tight">{ROUND_NAMES[currentRound - 1]}</h2>
        <Button variant="ghost" size="icon" disabled={currentRound >= 6} onClick={() => setCurrentRound(r => r + 1)} className="rounded-xl h-10 w-10 btn-press">
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex gap-1.5 mb-5 justify-center flex-wrap">
        {ROUND_SHORT.map((label, i) => (
          <button
            key={i}
            onClick={() => setCurrentRound(i + 1)}
            className={cn(
              "round-pill btn-press",
              currentRound === i + 1 ? "round-pill-active" : "round-pill-default"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Comparison */}
      <div className="space-y-6">
        {regions.map(region => {
          const regionGames = roundGames.filter(g => g.region === region);
          return (
            <div key={region}>
              <div className="section-divider">
                <span className="section-header mb-0">{region}</span>
              </div>
              <div className="space-y-2.5">
                {regionGames.map((game, idx) => {
                  const pickA = picksA.get(game.id);
                  const pickB = picksB.get(game.id);
                  const same = pickA && pickB && pickA.picked_team_id === pickB.picked_team_id;
                  const winner = game.winner_team_id;

                  return (
                    <motion.div
                      key={game.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className={cn("matchup-card", !same && pickA && pickB && "ring-1 ring-warning/30")}
                    >
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-0">
                        {/* Header */}
                        <div className="px-3.5 py-1.5 text-[10px] font-semibold text-primary border-b border-border/30">{nameA}</div>
                        <div className="px-2 py-1.5 text-[10px] text-muted-foreground border-b border-border/30 text-center">vs</div>
                        <div className="px-3.5 py-1.5 text-[10px] font-semibold text-accent border-b border-border/30 text-right">{nameB}</div>

                        {/* Picks */}
                        <div className={cn("px-3.5 py-3", pickA && winner === pickA.picked_team_id ? "bg-correct/8" : pickA && winner && winner !== pickA.picked_team_id ? "bg-incorrect/8" : "")}>
                          {pickA ? (
                            <span className="text-sm font-medium">{teams.get(pickA.picked_team_id)?.short_name || '?'}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50 italic">—</span>
                          )}
                        </div>
                        <div className="flex items-center justify-center">
                          {same ? (
                            <div className="w-2 h-2 rounded-full bg-success" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-warning" />
                          )}
                        </div>
                        <div className={cn("px-3.5 py-3 text-right", pickB && winner === pickB.picked_team_id ? "bg-correct/8" : pickB && winner && winner !== pickB.picked_team_id ? "bg-incorrect/8" : "")}>
                          {pickB ? (
                            <span className="text-sm font-medium">{teams.get(pickB.picked_team_id)?.short_name || '?'}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50 italic">—</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="h-8" />
    </div>
  );
}
