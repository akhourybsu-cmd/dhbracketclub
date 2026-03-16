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
  AlertTriangle, Database, Activity, FlaskConical, ChevronDown, ChevronRight, Settings2, Radio
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SyncRunCard } from '@/components/admin/SyncRunCard';
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

  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [providerName, setProviderName] = useState<string>('espn');

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

  useGameUpdates(tournamentId, fetchData);
  useSyncRunUpdates(fetchSyncRuns);

  // ─── Manual Game Controls ─────────────────────────────────────────
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
    return (
      <div className="loading-spinner">
        <div className="loading-spinner-ring" />
        <p className="loading-spinner-text">Loading admin tools…</p>
      </div>
    );
  }

  // Sync health
  const lastRun = syncRuns[0];
  const isCurrentlySyncing = !!syncing || lastRun?.status === 'running';
  const staleMinutes = lastSyncedAt ? (Date.now() - new Date(lastSyncedAt).getTime()) / 60000 : Infinity;
  const hasRecentError = lastRun?.status === 'failed';
  const hasWarnings = lastRun?.status === 'completed_with_errors' || lastRun?.status === 'completed_with_warnings';

  let healthLabel: string, healthColor: string, healthDot: string;
  if (isCurrentlySyncing) { healthLabel = 'Syncing…'; healthColor = 'text-primary'; healthDot = 'bg-primary animate-pulse'; }
  else if (hasRecentError) { healthLabel = 'Degraded'; healthColor = 'text-destructive'; healthDot = 'bg-destructive'; }
  else if (staleMinutes > 120) { healthLabel = lastSyncedAt ? 'Stale' : 'Manual Mode'; healthColor = 'text-warning'; healthDot = 'bg-warning'; }
  else if (hasWarnings) { healthLabel = 'Warnings'; healthColor = 'text-warning'; healthDot = 'bg-warning'; }
  else { healthLabel = 'Healthy'; healthColor = 'text-success'; healthDot = 'bg-success'; }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back */}
      <Link to={`/pools/${poolId}`} className="back-link">
        <ArrowLeft /> Back to Pool
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Settings2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Admin Tools</h1>
            <p className="text-sm text-muted-foreground">Manage games, sync, and simulate</p>
          </div>
        </div>
      </div>

      {/* Sync Health Banner */}
      <div className={cn(
        "glass-card px-4 py-3 mb-5 flex items-center justify-between",
        hasRecentError && "border-destructive/30",
        staleMinutes > 120 && !hasRecentError && "border-warning/30"
      )}>
        <div className="flex items-center gap-2.5">
          <span className={cn("w-2.5 h-2.5 rounded-full", healthDot)} />
          <div>
            <span className={cn("text-xs font-bold", healthColor)}>{healthLabel}</span>
            <span className="text-[10px] text-muted-foreground ml-2 tabular-nums">
              {lastSyncedAt ? `${Math.round(staleMinutes)}m ago` : 'Never synced'}
            </span>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground tabular-nums">
          {lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : '—'}
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        {[
          { value: totalDecided, label: 'Final', color: '' },
          { value: totalLive, label: 'Live', color: 'text-live' },
          { value: games.length - totalDecided - totalLive, label: 'Upcoming', color: '' },
          { value: lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—', label: 'Last Sync', color: 'text-xs' },
        ].map((s, i) => (
          <div key={i} className="stat-card py-3">
            <span className={cn("stat-value", s.color)}>{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Tab selector */}
      <div className="flex gap-1.5 mb-5 p-1 bg-muted/30 rounded-xl">
        {([
          { key: 'games' as AdminTab, icon: Database, label: 'Games' },
          { key: 'sync' as AdminTab, icon: RefreshCw, label: 'Sync' },
          { key: 'simulate' as AdminTab, icon: FlaskConical, label: 'Simulate' },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all",
              activeTab === t.key
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
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
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-muted-foreground font-medium">Manual game entry & overrides</span>
            <Button variant="outline" size="sm" onClick={recalculateStandings} disabled={recalculating} className="gap-1.5 text-xs h-8 rounded-lg">
              <RefreshCw className={cn("w-3 h-3", recalculating && "animate-spin")} />
              Recalculate
            </Button>
          </div>

          {/* Round selector */}
          <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-none">
            {ROUND_SHORT.map((name, i) => {
              const rGames = games.filter(g => g.round_number === i + 1);
              const decided = rGames.filter(g => g.winner_team_id).length;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedRound(i + 1)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all flex items-center gap-1.5",
                    selectedRound === i + 1
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-card text-muted-foreground hover:text-foreground border border-border/50"
                  )}
                >
                  {name}
                  {decided > 0 && (
                    <span className={cn(
                      "text-[9px] tabular-nums px-1 py-0.5 rounded",
                      selectedRound === i + 1 ? "bg-primary-foreground/20" : "bg-muted"
                    )}>
                      {decided}/{rGames.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Round progress */}
          <div className="glass-card px-4 py-3 mb-4 flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">{ROUND_NAMES[selectedRound - 1]}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tabular-nums">{roundStats.decided}/{roundStats.total}</span>
              <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-success rounded-full transition-all" style={{ width: `${roundStats.total > 0 ? (roundStats.decided / roundStats.total) * 100 : 0}%` }} />
              </div>
            </div>
          </div>

          {/* Game cards by region */}
          <div className="space-y-5">
            {regions.map(region => {
              const regionGames = roundGames.filter(g => g.region === region);
              return (
                <div key={region}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="section-header mb-0">{region}</span>
                    <div className="flex-1 h-px bg-border/30" />
                  </div>
                  <div className="space-y-2">
                    {regionGames.map(game => {
                      const team1 = game.team1_id ? teams.get(game.team1_id) : null;
                      const team2 = game.team2_id ? teams.get(game.team2_id) : null;
                      const isFinal = game.status === 'final';
                      const isLive = game.status === 'in_progress';
                      const gameScores = scores.get(game.id) || { team1: '', team2: '' };

                      return (
                        <div key={game.id} className={cn(
                          "glass-card overflow-hidden",
                          isLive && "ring-1 ring-live/40"
                        )}>
                          {/* Status badges row */}
                          {(isLive || game.is_result_final) && (
                            <div className="px-3 py-1.5 bg-muted/20 border-b border-border/30 flex items-center gap-1.5">
                              {isLive && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-live">
                                  <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE
                                </span>
                              )}
                              {game.is_result_final && (
                                <span className="text-[9px] font-bold text-success bg-success/10 px-1.5 py-0.5 rounded-full">SYNCED</span>
                              )}
                            </div>
                          )}

                          {/* Team 1 */}
                          <button onClick={() => team1 && setWinner(game.id, team1.id)} disabled={!team1 || saving === game.id}
                            className={cn("w-full flex items-center gap-2 px-3.5 py-2.5 transition-colors text-left",
                              game.winner_team_id === team1?.id ? "bg-success/5" : "hover:bg-muted/30", !team1 && "cursor-default")}>
                            {team1 ? (<>
                              <span className="text-[11px] font-mono font-bold text-muted-foreground w-5 tabular-nums text-center">{team1.seed}</span>
                              <span className="text-sm font-medium flex-1 truncate">{team1.short_name}</span>
                              <Input type="number" placeholder="—" value={gameScores.team1}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => { e.stopPropagation(); setScores(prev => { const n = new Map(prev); n.set(game.id, { ...gameScores, team1: e.target.value }); return n; }); }}
                                className="w-14 h-8 text-center text-xs font-mono p-0 rounded-lg" />
                              {game.winner_team_id === team1.id && <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />}
                            </>) : <span className="text-xs text-muted-foreground/50 italic ml-5">TBD</span>}
                          </button>

                          <div className="h-px bg-border/20 mx-3" />

                          {/* Team 2 */}
                          <button onClick={() => team2 && setWinner(game.id, team2.id)} disabled={!team2 || saving === game.id}
                            className={cn("w-full flex items-center gap-2 px-3.5 py-2.5 transition-colors text-left",
                              game.winner_team_id === team2?.id ? "bg-success/5" : "hover:bg-muted/30", !team2 && "cursor-default")}>
                            {team2 ? (<>
                              <span className="text-[11px] font-mono font-bold text-muted-foreground w-5 tabular-nums text-center">{team2.seed}</span>
                              <span className="text-sm font-medium flex-1 truncate">{team2.short_name}</span>
                              <Input type="number" placeholder="—" value={gameScores.team2}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => { e.stopPropagation(); setScores(prev => { const n = new Map(prev); n.set(game.id, { ...gameScores, team2: e.target.value }); return n; }); }}
                                className="w-14 h-8 text-center text-xs font-mono p-0 rounded-lg" />
                              {game.winner_team_id === team2.id && <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />}
                            </>) : <span className="text-xs text-muted-foreground/50 italic ml-5">TBD</span>}
                          </button>

                          {isFinal && (
                            <div className="px-3.5 py-2 border-t border-border/20 bg-muted/10">
                              <button onClick={() => resetGame(game.id)} disabled={saving === game.id}
                                className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors font-medium">
                                <RotateCcw className="w-3 h-3" /> Reset Result
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
        <div className="space-y-5">
          {/* Sync actions */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold">Sync Actions</h3>
              <select
                value={providerName}
                onChange={e => setProviderName(e.target.value)}
                className="bg-muted text-foreground text-[11px] font-medium rounded-lg px-2.5 py-1.5 border border-border"
              >
                <option value="espn">ESPN</option>
                <option value="stub">Stub (test)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
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
                    "glass-card p-3.5 text-left hover-lift transition-all",
                    syncing === s.action && "ring-1 ring-primary/50"
                  )}
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <s.icon className={cn("w-4 h-4 text-primary", syncing === s.action && "animate-spin")} />
                  </div>
                  <p className="text-xs font-bold mb-0.5">{s.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-snug">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Recent sync runs */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-sm font-bold">Recent Sync Runs</h3>
              <div className="flex-1 h-px bg-border/30" />
              <span className="text-[10px] text-muted-foreground tabular-nums">{syncRuns.length} total</span>
            </div>
            {syncRuns.length === 0 ? (
              <div className="text-center py-6">
                <RefreshCw className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No sync runs yet.</p>
              </div>
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
        <div className="space-y-5">
          {/* Warning banner */}
          <div className="glass-card p-4 flex items-start gap-3 border-warning/30">
            <div className="w-8 h-8 rounded-lg bg-warning/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <FlaskConical className="w-4 h-4 text-warning" />
            </div>
            <div>
              <p className="text-xs font-bold text-warning">Simulation Mode</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">For testing only. Changes are written to the database and will affect standings.</p>
            </div>
          </div>

          {/* Simulate game state */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-bold mb-4">Simulate Game State</h3>

            <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">Select Game</label>
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
              className="w-full bg-muted text-foreground text-sm rounded-lg px-3 py-2.5 mb-4 border border-border focus:ring-1 focus:ring-primary"
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
                  <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">New Status</label>
                  <div className="flex gap-1.5 mb-4">
                    {(['scheduled', 'in_progress', 'final'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setSimStatus(s)}
                        className={cn(
                          "flex-1 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all",
                          simStatus === s ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>

                  {simStatus !== 'scheduled' && (
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium block mb-1">{t1?.short_name || 'Team 1'}</label>
                        <Input type="number" value={simScore1} onChange={e => setSimScore1(e.target.value)} placeholder="0" className="h-9 text-center font-mono rounded-lg" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium block mb-1">{t2?.short_name || 'Team 2'}</label>
                        <Input type="number" value={simScore2} onChange={e => setSimScore2(e.target.value)} placeholder="0" className="h-9 text-center font-mono rounded-lg" />
                      </div>
                    </div>
                  )}

                  {simStatus === 'final' && (
                    <>
                      <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">Winner</label>
                      <div className="flex gap-1.5 mb-4">
                        <button onClick={() => setSimWinner('team1')}
                          className={cn("flex-1 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all",
                            simWinner === 'team1' ? "bg-success text-white shadow-sm" : "bg-muted text-muted-foreground")}>
                          {t1?.short_name || 'Team 1'}
                        </button>
                        <button onClick={() => setSimWinner('team2')}
                          className={cn("flex-1 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all",
                            simWinner === 'team2' ? "bg-success text-white shadow-sm" : "bg-muted text-muted-foreground")}>
                          {t2?.short_name || 'Team 2'}
                        </button>
                      </div>
                    </>
                  )}

                  <Button onClick={runSimulation} disabled={simRunning} className="w-full gap-2 h-10 rounded-xl font-bold">
                    <Play className={cn("w-4 h-4", simRunning && "animate-spin")} />
                    {simRunning ? 'Simulating…' : `Apply → ${simStatus}`}
                  </Button>
                </>
              );
            })()}
          </div>

          {/* Quick presets */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-bold mb-1">Quick Presets</h3>
            <p className="text-[11px] text-muted-foreground mb-4">Rapidly simulate game progression for testing.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="text-xs h-9 rounded-lg font-semibold gap-1.5"
                onClick={async () => {
                  const scheduled = games.filter(g => g.status === 'scheduled' && g.team1_id && g.team2_id);
                  if (scheduled.length === 0) { toast.error('No scheduled games with teams'); return; }
                  const game = scheduled[0];
                  await supabase.from('games').update({ status: 'in_progress', team1_score: 0, team2_score: 0, live_period: '1st Half', live_clock: '20:00' }).eq('id', game.id);
                  toast.success('Started first scheduled game');
                  fetchData();
                }}>
                <Play className="w-3.5 h-3.5" /> Start Next
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-9 rounded-lg font-semibold gap-1.5"
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
                <CheckCircle2 className="w-3.5 h-3.5" /> Finalize All
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
