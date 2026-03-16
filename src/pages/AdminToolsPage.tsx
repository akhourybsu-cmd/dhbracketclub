import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, CheckCircle2, RotateCcw, RefreshCw, Play, Zap, Clock,
  AlertTriangle, Database, Activity, FlaskConical, ChevronDown, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Game, Team, ROUND_NAMES, ROUND_SHORT } from '@/lib/bracketUtils';
import { useGameUpdates, useSyncRunUpdates } from '@/hooks/useRealtimeSubscription';

type AdminTab = 'games' | 'sync' | 'simulate';

interface SyncRun {
  id: string;
  provider_name: string;
  sync_type: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
  raw_summary: any;
}

export default function AdminToolsPage() {
  const { poolId } = useParams<{ poolId: string }>();
  const { user } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Map<string, Team>>(new Map());
  const [selectedRound, setSelectedRound] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [scores, setScores] = useState<Map<string, { team1: string; team2: string }>>(new Map());
  const [tournamentId, setTournamentId] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('games');

  // Sync state
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [providerName, setProviderName] = useState<string>('espn');

  // Simulation state
  const [simGameId, setSimGameId] = useState('');
  const [simStatus, setSimStatus] = useState<'scheduled' | 'in_progress' | 'final'>('in_progress');
  const [simScore1, setSimScore1] = useState('');
  const [simScore2, setSimScore2] = useState('');
  const [simWinner, setSimWinner] = useState<'team1' | 'team2' | ''>('');
  const [simRunning, setSimRunning] = useState(false);

  const fetchData = useCallback(async () => {
    if (!poolId) return;
    const { data: pool } = await supabase.from('pools').select('tournament_id, tournaments(last_synced_at)').eq('id', poolId).single();
    if (!pool) return;
    setTournamentId(pool.tournament_id);
    setLastSyncedAt((pool as any).tournaments?.last_synced_at || null);

    const [{ data: teamData }, { data: gameData }] = await Promise.all([
      supabase.from('teams').select('*').eq('tournament_id', pool.tournament_id),
      supabase.from('games').select('*').eq('tournament_id', pool.tournament_id).order('round_number').order('game_slot'),
    ]);

    if (teamData) {
      const m = new Map<string, Team>();
      teamData.forEach(t => m.set(t.id, t as Team));
      setTeams(m);
    }
    if (gameData) {
      setGames(gameData as Game[]);
      const sm = new Map<string, { team1: string; team2: string }>();
      gameData.forEach(g => {
        sm.set(g.id, { team1: g.team1_score?.toString() || '', team2: g.team2_score?.toString() || '' });
      });
      setScores(sm);
    }
    setLoading(false);
  }, [poolId]);

  const fetchSyncRuns = useCallback(async () => {
    const { data } = await supabase
      .from('sync_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setSyncRuns(data as SyncRun[]);
  }, []);

  useEffect(() => { fetchData(); fetchSyncRuns(); }, [fetchData, fetchSyncRuns]);

  // Realtime
  useGameUpdates(tournamentId, fetchData);
  useSyncRunUpdates(fetchSyncRuns);

  // ─── Manual Game Controls (preserved from phase 1) ─────────────────
  const setWinner = async (gameId: string, winnerId: string) => {
    setSaving(gameId);
    try {
      const s = scores.get(gameId);
      await supabase.from('games').update({
        winner_team_id: winnerId, status: 'final', is_result_final: true,
        team1_score: s?.team1 ? parseInt(s.team1) : null,
        team2_score: s?.team2 ? parseInt(s.team2) : null,
      }).eq('id', gameId);

      setGames(prev => prev.map(g => g.id === gameId ? {
        ...g, winner_team_id: winnerId, status: 'final',
        team1_score: s?.team1 ? parseInt(s.team1) : null,
        team2_score: s?.team2 ? parseInt(s.team2) : null,
      } : g));

      // Advance winner
      const game = games.find(g => g.id === gameId);
      if (game) {
        const nextRound = game.round_number + 1;
        const nextSlot = Math.ceil(game.game_slot / 2);
        const isTeam1 = game.game_slot % 2 === 1;
        const nextGame = games.find(g => g.round_number === nextRound && g.game_slot === nextSlot);
        if (nextGame) {
          const field = isTeam1 ? 'team1_id' : 'team2_id';
          await supabase.from('games').update({ [field]: winnerId }).eq('id', nextGame.id);
          setGames(prev => prev.map(g => g.id === nextGame.id ? { ...g, [field]: winnerId } : g));
        }
      }

      // Log + history
      if (user) {
        await supabase.from('admin_logs').insert({
          pool_id: poolId!, actor_user_id: user.id,
          action_type: 'manual_set_winner',
          action_payload: { game_id: gameId, winner_team_id: winnerId, source: 'admin_manual' },
        });
        await supabase.from('game_state_history').insert({
          game_id: gameId,
          new_status: 'final', new_winner_team_id: winnerId,
          new_score: { team1: s?.team1 ? parseInt(s.team1) : null, team2: s?.team2 ? parseInt(s.team2) : null },
          changed_by_source: 'admin_manual',
        });
      }
      toast.success('Result saved (manual override)');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(null);
    }
  };

  const resetGame = async (gameId: string) => {
    setSaving(gameId);
    try {
      await supabase.from('games').update({
        winner_team_id: null, status: 'scheduled', team1_score: null, team2_score: null,
        is_result_final: false, live_clock: null, live_period: null,
      }).eq('id', gameId);

      setGames(prev => prev.map(g => g.id === gameId ? {
        ...g, winner_team_id: null, status: 'scheduled', team1_score: null, team2_score: null,
      } : g));

      if (user) {
        await supabase.from('admin_logs').insert({
          pool_id: poolId!, actor_user_id: user.id,
          action_type: 'reset_game', action_payload: { game_id: gameId },
        });
      }
      toast.success('Game reset.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(null);
    }
  };

  const recalculateStandings = async () => {
    if (!poolId || !tournamentId) return;
    setRecalculating(true);
    try {
      // Use server-side recalculation via edge function (security: never trust client scoring)
      const res = await supabase.functions.invoke('sync-games', {
        body: { action: 'recalculateStandings', tournamentId, poolId },
      });
      if (res.error) throw new Error(res.error.message);
      const result = res.data;
      if (result.success) {
        const stats = result.result?.standings || result.result || {};
        toast.success(`Standings recalculated: ${stats.bracketsScored || 0} brackets, ${stats.standingsChanged || 0} changes`);
        fetchData();
      } else {
        toast.error(result.error || 'Recalculation failed');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRecalculating(false);
    }
  };

  // ─── Sync Controls ─────────────────────────────────────────────────
  const triggerSync = async (action: string) => {
    if (!tournamentId) return;
    setSyncing(action);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await supabase.functions.invoke('sync-games', {
        body: { action, tournamentId, poolId, providerName },
      });

      if (res.error) throw new Error(res.error.message);
      const result = res.data;
      if (result.success) {
        toast.success(`Sync completed: ${action}`);
        fetchData();
        fetchSyncRuns();
      } else {
        toast.error(result.error || 'Sync failed');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSyncing(null);
    }
  };

  // ─── Simulation ────────────────────────────────────────────────────
  const runSimulation = async () => {
    if (!simGameId) { toast.error('Select a game'); return; }
    setSimRunning(true);
    try {
      const game = games.find(g => g.id === simGameId);
      if (!game) throw new Error('Game not found');

      const updatePayload: Record<string, any> = { status: simStatus };

      if (simStatus === 'in_progress') {
        updatePayload.team1_score = simScore1 ? parseInt(simScore1) : 0;
        updatePayload.team2_score = simScore2 ? parseInt(simScore2) : 0;
        updatePayload.live_period = '2nd Half';
        updatePayload.live_clock = '12:00';
        updatePayload.is_result_final = false;
      } else if (simStatus === 'final') {
        updatePayload.team1_score = simScore1 ? parseInt(simScore1) : 0;
        updatePayload.team2_score = simScore2 ? parseInt(simScore2) : 0;
        updatePayload.live_clock = null;
        updatePayload.live_period = null;
        updatePayload.is_result_final = true;

        if (simWinner === 'team1' && game.team1_id) {
          updatePayload.winner_team_id = game.team1_id;
        } else if (simWinner === 'team2' && game.team2_id) {
          updatePayload.winner_team_id = game.team2_id;
        }

        // Advance winner
        if (updatePayload.winner_team_id) {
          const nextRound = game.round_number + 1;
          const nextSlot = Math.ceil(game.game_slot / 2);
          const isTeam1Slot = game.game_slot % 2 === 1;
          const field = isTeam1Slot ? 'team1_id' : 'team2_id';
          const nextGame = games.find(g => g.round_number === nextRound && g.game_slot === nextSlot);
          if (nextGame) {
            await supabase.from('games').update({ [field]: updatePayload.winner_team_id }).eq('id', nextGame.id);
          }
        }
      } else {
        updatePayload.team1_score = null;
        updatePayload.team2_score = null;
        updatePayload.winner_team_id = null;
        updatePayload.is_result_final = false;
        updatePayload.live_clock = null;
        updatePayload.live_period = null;
      }

      await supabase.from('games').update(updatePayload).eq('id', simGameId);

      // Log to game_state_history
      await supabase.from('game_state_history').insert({
        game_id: simGameId,
        previous_status: game.status,
        new_status: simStatus,
        new_score: { team1: updatePayload.team1_score, team2: updatePayload.team2_score },
        new_winner_team_id: updatePayload.winner_team_id || null,
        changed_by_source: 'simulation',
      });

      if (user) {
        await supabase.from('admin_logs').insert({
          pool_id: poolId!, actor_user_id: user.id,
          action_type: 'simulation',
          action_payload: { game_id: simGameId, simulated_status: simStatus, ...updatePayload },
        });
      }

      toast.success(`Simulation: Game → ${simStatus}`);
      fetchData();

      // Auto-recalculate if finalized
      if (simStatus === 'final') {
        await recalculateStandings();
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSimRunning(false);
    }
  };

  // ─── Derived data ──────────────────────────────────────────────────
  const roundGames = games.filter(g => g.round_number === selectedRound);
  const regions = [...new Set(roundGames.map(g => g.region))];
  const roundStats = { total: roundGames.length, decided: roundGames.filter(g => g.winner_team_id).length };
  const totalDecided = games.filter(g => g.winner_team_id).length;
  const totalLive = games.filter(g => g.status === 'in_progress').length;

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <Link to={`/pools/${poolId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Pool
      </Link>

      <h1 className="text-xl font-bold mb-1">Admin Control Center</h1>
      <p className="text-sm text-muted-foreground mb-2">Manage games, sync data, and simulate results.</p>

      {/* Sync Health Banner */}
      {(() => {
        const lastRun = syncRuns[0];
        const isCurrentlySyncing = !!syncing || lastRun?.status === 'running';
        const staleMinutes = lastSyncedAt ? (Date.now() - new Date(lastSyncedAt).getTime()) / 60000 : Infinity;
        const hasRecentError = lastRun?.status === 'failed';
        const hasWarnings = lastRun?.status === 'completed_with_errors' || lastRun?.status === 'completed_with_warnings';

        let healthLabel: string;
        let healthColor: string;
        let healthBg: string;

        if (isCurrentlySyncing) {
          healthLabel = 'Syncing';
          healthColor = 'text-primary';
          healthBg = 'bg-primary/10 border-primary/20';
        } else if (hasRecentError) {
          healthLabel = 'Degraded';
          healthColor = 'text-destructive';
          healthBg = 'bg-destructive/10 border-destructive/20';
        } else if (staleMinutes > 120) {
          healthLabel = lastSyncedAt ? 'Stale' : 'Manual Mode';
          healthColor = 'text-warning';
          healthBg = 'bg-warning/10 border-warning/20';
        } else if (hasWarnings) {
          healthLabel = 'Healthy (warnings)';
          healthColor = 'text-warning';
          healthBg = 'bg-warning/10 border-warning/20';
        } else {
          healthLabel = 'Healthy';
          healthColor = 'text-success';
          healthBg = 'bg-success/10 border-success/20';
        }

        return (
          <div className={cn("rounded-lg px-3 py-2 mb-4 flex items-center justify-between border", healthBg)}>
            <div className="flex items-center gap-2">
              <span className={cn("w-2 h-2 rounded-full", healthColor.replace('text-', 'bg-'), isCurrentlySyncing && "animate-pulse")} />
              <span className={cn("text-xs font-semibold", healthColor)}>{healthLabel}</span>
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {lastSyncedAt ? `Synced ${Math.round(staleMinutes)}m ago` : 'Never synced'}
            </span>
          </div>
        );
      })()}

      {/* Stats Strip */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="glass-card p-2 text-center">
          <p className="text-lg font-bold tabular-nums">{totalDecided}</p>
          <p className="text-[9px] text-muted-foreground">Final</p>
        </div>
        <div className="glass-card p-2 text-center">
          <p className="text-lg font-bold tabular-nums text-primary">{totalLive}</p>
          <p className="text-[9px] text-muted-foreground">Live</p>
        </div>
        <div className="glass-card p-2 text-center">
          <p className="text-lg font-bold tabular-nums">{games.length - totalDecided - totalLive}</p>
          <p className="text-[9px] text-muted-foreground">Upcoming</p>
        </div>
        <div className="glass-card p-2 text-center">
          <p className="text-[10px] font-bold truncate">{lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : '—'}</p>
          <p className="text-[9px] text-muted-foreground">Last Sync</p>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex gap-1.5 mb-4">
        {([
          { key: 'games' as AdminTab, icon: Database, label: 'Games' },
          { key: 'sync' as AdminTab, icon: RefreshCw, label: 'Sync' },
          { key: 'simulate' as AdminTab, icon: FlaskConical, label: 'Simulate' },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
              activeTab === t.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            )}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ GAMES TAB ═══ */}
      {activeTab === 'games' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground font-medium">Manual game entry & overrides</span>
            <Button variant="outline" size="sm" onClick={recalculateStandings} disabled={recalculating} className="gap-1 text-xs h-7">
              <RefreshCw className={cn("w-3 h-3", recalculating && "animate-spin")} />
              Recalc
            </Button>
          </div>

          {/* Round Selector */}
          <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
            {ROUND_SHORT.map((name, i) => {
              const rGames = games.filter(g => g.round_number === i + 1);
              const decided = rGames.filter(g => g.winner_team_id).length;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedRound(i + 1)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors flex items-center gap-1",
                    selectedRound === i + 1 ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                  )}
                >
                  {name}
                  {decided > 0 && <span className={cn("text-[9px] tabular-nums", selectedRound === i + 1 ? "text-primary-foreground/70" : "text-muted-foreground")}>{decided}/{rGames.length}</span>}
                </button>
              );
            })}
          </div>

          {/* Progress */}
          <div className="glass-card p-2.5 mb-3 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{ROUND_NAMES[selectedRound - 1]}: {roundStats.decided}/{roundStats.total} decided</span>
            <div className="h-1.5 w-20 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-success rounded-full" style={{ width: `${roundStats.total > 0 ? (roundStats.decided / roundStats.total) * 100 : 0}%` }} />
            </div>
          </div>

          {/* Game cards */}
          <div className="space-y-4">
            {regions.map(region => {
              const regionGames = roundGames.filter(g => g.region === region);
              return (
                <div key={region}>
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{region}</h3>
                  <div className="space-y-2">
                    {regionGames.map(game => {
                      const team1 = game.team1_id ? teams.get(game.team1_id) : null;
                      const team2 = game.team2_id ? teams.get(game.team2_id) : null;
                      const isFinal = game.status === 'final';
                      const isLive = game.status === 'in_progress';
                      const gameScores = scores.get(game.id) || { team1: '', team2: '' };

                      return (
                        <div key={game.id} className={cn("matchup-card relative", isLive && "ring-1 ring-primary/30")}>
                          {/* Status badges */}
                          {(isLive || game.is_result_final) && (
                            <div className="absolute top-1 right-2 flex gap-1">
                              {isLive && <span className="text-[8px] font-bold text-primary bg-primary/15 px-1.5 py-0.5 rounded-full">LIVE</span>}
                              {game.is_result_final && <span className="text-[8px] font-bold text-success bg-success/15 px-1.5 py-0.5 rounded-full">SYNCED</span>}
                            </div>
                          )}

                          {/* Team 1 */}
                          <button onClick={() => team1 && setWinner(game.id, team1.id)} disabled={!team1 || saving === game.id}
                            className={cn("w-full flex items-center gap-2 px-3 py-2 transition-colors text-left",
                              game.winner_team_id === team1?.id ? "bg-success/5" : "hover:bg-secondary/50", !team1 && "cursor-default")}>
                            {team1 ? (<>
                              <span className="text-[11px] font-mono font-bold text-muted-foreground w-5 tabular-nums text-center">{team1.seed}</span>
                              <span className="text-sm font-medium flex-1 truncate">{team1.short_name}</span>
                              <Input type="number" placeholder="—" value={gameScores.team1}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => { e.stopPropagation(); setScores(prev => { const n = new Map(prev); n.set(game.id, { ...gameScores, team1: e.target.value }); return n; }); }}
                                className="w-12 h-7 text-center text-xs font-mono p-0" />
                              {game.winner_team_id === team1.id && <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />}
                            </>) : <span className="text-xs text-muted-foreground italic ml-5">TBD</span>}
                          </button>
                          <div className="h-px bg-border mx-2" />
                          {/* Team 2 */}
                          <button onClick={() => team2 && setWinner(game.id, team2.id)} disabled={!team2 || saving === game.id}
                            className={cn("w-full flex items-center gap-2 px-3 py-2 transition-colors text-left",
                              game.winner_team_id === team2?.id ? "bg-success/5" : "hover:bg-secondary/50", !team2 && "cursor-default")}>
                            {team2 ? (<>
                              <span className="text-[11px] font-mono font-bold text-muted-foreground w-5 tabular-nums text-center">{team2.seed}</span>
                              <span className="text-sm font-medium flex-1 truncate">{team2.short_name}</span>
                              <Input type="number" placeholder="—" value={gameScores.team2}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => { e.stopPropagation(); setScores(prev => { const n = new Map(prev); n.set(game.id, { ...gameScores, team2: e.target.value }); return n; }); }}
                                className="w-12 h-7 text-center text-xs font-mono p-0" />
                              {game.winner_team_id === team2.id && <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />}
                            </>) : <span className="text-xs text-muted-foreground italic ml-5">TBD</span>}
                          </button>
                          {isFinal && (
                            <div className="px-3 py-1 border-t border-border/30">
                              <button onClick={() => resetGame(game.id)} disabled={saving === game.id}
                                className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors">
                                <RotateCcw className="w-3 h-3" /> Reset
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ SYNC TAB ═══ */}
      {activeTab === 'sync' && (
        <div className="space-y-4">
          {/* Sync Actions */}
          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold mb-3">Sync Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              {([
                { action: 'runFullSync', label: 'Full Sync', icon: RefreshCw, desc: 'Metadata + Games + Results + Standings' },
                { action: 'syncGameResults', label: 'Results Only', icon: Activity, desc: 'Scores & winners only' },
                { action: 'syncGames', label: 'Games Only', icon: Database, desc: 'Schedule & structure' },
                { action: 'recalculateStandings', label: 'Recalc Standings', icon: Zap, desc: 'Re-score all brackets' },
              ]).map(s => (
                <button
                  key={s.action}
                  onClick={() => triggerSync(s.action)}
                  disabled={!!syncing}
                  className={cn(
                    "glass-card p-3 text-left hover:bg-card/90 transition-colors",
                    syncing === s.action && "ring-1 ring-primary/50"
                  )}
                >
                  <s.icon className={cn("w-4 h-4 text-primary mb-1", syncing === s.action && "animate-spin")} />
                  <p className="text-xs font-semibold">{s.label}</p>
                  <p className="text-[9px] text-muted-foreground">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Sync Runs */}
          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold mb-3">Recent Sync Runs</h3>
            {syncRuns.length === 0 ? (
              <p className="text-xs text-muted-foreground">No sync runs yet.</p>
            ) : (
              <div className="space-y-2">
                {syncRuns.slice(0, 10).map(run => (
                  <SyncRunCard key={run.id} run={run} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ SIMULATE TAB ═══ */}
      {activeTab === 'simulate' && (
        <div className="space-y-4">
          <div className="glass-card p-3 flex items-center gap-2 border border-warning/30">
            <FlaskConical className="w-4 h-4 text-warning flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-warning">Simulation Mode</p>
              <p className="text-[10px] text-muted-foreground">For testing only. Changes are written to the database and will affect standings.</p>
            </div>
          </div>

          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold mb-3">Simulate Game State</h3>

            {/* Game selector */}
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Select Game</label>
            <select
              value={simGameId}
              onChange={e => {
                setSimGameId(e.target.value);
                const g = games.find(g => g.id === e.target.value);
                if (g) {
                  setSimScore1(g.team1_score?.toString() || '');
                  setSimScore2(g.team2_score?.toString() || '');
                }
              }}
              className="w-full bg-secondary text-foreground text-sm rounded-lg px-3 py-2 mb-3 border border-border"
            >
              <option value="">— Choose a game —</option>
              {games.map(g => {
                const t1 = g.team1_id ? teams.get(g.team1_id) : null;
                const t2 = g.team2_id ? teams.get(g.team2_id) : null;
                return (
                  <option key={g.id} value={g.id}>
                    {ROUND_SHORT[g.round_number - 1]} · {g.region} · {t1?.short_name || 'TBD'} vs {t2?.short_name || 'TBD'} [{g.status}]
                  </option>
                );
              })}
            </select>

            {simGameId && (() => {
              const game = games.find(g => g.id === simGameId);
              const t1 = game?.team1_id ? teams.get(game.team1_id) : null;
              const t2 = game?.team2_id ? teams.get(game.team2_id) : null;
              return (
                <>
                  {/* Status */}
                  <label className="text-[11px] font-medium text-muted-foreground mb-1 block">New Status</label>
                  <div className="flex gap-1.5 mb-3">
                    {(['scheduled', 'in_progress', 'final'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setSimStatus(s)}
                        className={cn(
                          "flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors",
                          simStatus === s ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                        )}
                      >
                        {s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>

                  {/* Scores */}
                  {simStatus !== 'scheduled' && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">{t1?.short_name || 'Team 1'}</label>
                        <Input type="number" value={simScore1} onChange={e => setSimScore1(e.target.value)} placeholder="0" className="h-8 text-center font-mono" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">{t2?.short_name || 'Team 2'}</label>
                        <Input type="number" value={simScore2} onChange={e => setSimScore2(e.target.value)} placeholder="0" className="h-8 text-center font-mono" />
                      </div>
                    </div>
                  )}

                  {/* Winner */}
                  {simStatus === 'final' && (
                    <>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Winner</label>
                      <div className="flex gap-1.5 mb-3">
                        <button onClick={() => setSimWinner('team1')}
                          className={cn("flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors",
                            simWinner === 'team1' ? "bg-success text-success-foreground" : "bg-secondary text-secondary-foreground")}>
                          {t1?.short_name || 'Team 1'}
                        </button>
                        <button onClick={() => setSimWinner('team2')}
                          className={cn("flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors",
                            simWinner === 'team2' ? "bg-success text-success-foreground" : "bg-secondary text-secondary-foreground")}>
                          {t2?.short_name || 'Team 2'}
                        </button>
                      </div>
                    </>
                  )}

                  <Button onClick={runSimulation} disabled={simRunning} className="w-full gap-2">
                    <Play className={cn("w-4 h-4", simRunning && "animate-spin")} />
                    {simRunning ? 'Simulating...' : `Apply Simulation → ${simStatus}`}
                  </Button>
                </>
              );
            })()}
          </div>

          {/* Quick multi-step simulation */}
          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold mb-2">Quick Simulation Presets</h3>
            <p className="text-[10px] text-muted-foreground mb-3">Rapidly simulate game progression for testing.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="text-xs h-8"
                onClick={async () => {
                  const scheduled = games.filter(g => g.status === 'scheduled' && g.team1_id && g.team2_id);
                  if (scheduled.length === 0) { toast.error('No scheduled games with teams'); return; }
                  const game = scheduled[0];
                  await supabase.from('games').update({ status: 'in_progress', team1_score: 0, team2_score: 0, live_period: '1st Half', live_clock: '20:00' }).eq('id', game.id);
                  toast.success('Started first scheduled game');
                  fetchData();
                }}>
                <Play className="w-3 h-3 mr-1" /> Start Next Game
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-8"
                onClick={async () => {
                  const live = games.filter(g => g.status === 'in_progress');
                  if (live.length === 0) { toast.error('No live games'); return; }
                  for (const g of live) {
                    const s1 = Math.floor(Math.random() * 40) + 50;
                    const s2 = Math.floor(Math.random() * 40) + 50;
                    const winnerId = s1 > s2 ? g.team1_id : g.team2_id;
                    await supabase.from('games').update({
                      status: 'final', team1_score: s1, team2_score: s2, winner_team_id: winnerId,
                      is_result_final: true, live_clock: null, live_period: null,
                    }).eq('id', g.id);
                    // Advance winner
                    if (winnerId) {
                      const nextRound = g.round_number + 1;
                      const nextSlot = Math.ceil(g.game_slot / 2);
                      const field = g.game_slot % 2 === 1 ? 'team1_id' : 'team2_id';
                      const nextGame = games.find(ng => ng.round_number === nextRound && ng.game_slot === nextSlot);
                      if (nextGame) {
                        await supabase.from('games').update({ [field]: winnerId }).eq('id', nextGame.id);
                      }
                    }
                  }
                  toast.success(`Finalized ${live.length} live games`);
                  fetchData();
                  setTimeout(recalculateStandings, 500);
                }}>
                <CheckCircle2 className="w-3 h-3 mr-1" /> Finalize All Live
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SyncRunCard({ run }: { run: SyncRun }) {
  const [expanded, setExpanded] = useState(false);
  const statusColors: Record<string, string> = {
    running: 'text-primary bg-primary/15',
    completed: 'text-success bg-success/15',
    completed_with_errors: 'text-warning bg-warning/15',
    failed: 'text-destructive bg-destructive/15',
  };

  return (
    <div className="border border-border/30 rounded-lg overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary/30 transition-colors">
        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", statusColors[run.status] || 'text-muted-foreground bg-secondary')}>
          {run.status.replace(/_/g, ' ').toUpperCase()}
        </span>
        <span className="text-[11px] font-medium flex-1 truncate">{run.sync_type}</span>
        <span className="text-[10px] text-muted-foreground tabular-nums">{new Date(run.started_at).toLocaleTimeString()}</span>
        {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-3 py-2 border-t border-border/20 text-[10px] space-y-1">
              <p><span className="text-muted-foreground">Provider:</span> {run.provider_name}</p>
              {run.finished_at && <p><span className="text-muted-foreground">Duration:</span> {Math.round((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s</p>}
              {run.error_message && <p className="text-destructive">Error: {run.error_message}</p>}
              {run.raw_summary && (
                <pre className="text-[9px] bg-secondary/50 rounded p-2 overflow-x-auto whitespace-pre-wrap mt-1">
                  {JSON.stringify(run.raw_summary, null, 2)}
                </pre>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
