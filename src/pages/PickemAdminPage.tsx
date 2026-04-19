import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Shield, Plus, Save, Loader2, Calculator } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useActiveSeason, useSeasonWeeks, useTeams, useWeekGames } from '@/hooks/usePickem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function PickemAdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const { season, refetch: refetchSeason } = useActiveSeason();
  const { weeks, refetch: refetchWeeks } = useSeasonWeeks(season?.id);
  const { teams } = useTeams();

  const [activeWeekId, setActiveWeekId] = useState<string | null>(null);
  const { games, refetch: refetchGames } = useWeekGames(activeWeekId || undefined);
  const [newGame, setNewGame] = useState({ away: '', home: '', kickoff: '' });

  useEffect(() => {
    if (!user) return;
    (supabase as any).from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle()
      .then(({ data }: any) => {
        if (!data) { setIsAdmin(false); navigate('/pickem'); }
        else setIsAdmin(true);
      });
  }, [user, navigate]);

  if (isAdmin === null) return <div className="p-6 text-center text-xs text-muted-foreground">Checking access…</div>;

  // Activate season helper
  async function activateSeason() {
    if (!season) return;
    const { error } = await (supabase as any).from('nfl_seasons').update({ status: 'active' }).eq('id', season.id);
    if (error) return toast.error(error.message);
    toast.success('Season activated');
    refetchSeason();
  }

  async function setCurrentWeek(weekNumber: number) {
    if (!season) return;
    const { error } = await (supabase as any).from('nfl_seasons').update({ current_week: weekNumber }).eq('id', season.id);
    if (error) return toast.error(error.message);
    toast.success(`Current week → ${weekNumber}`);
    refetchSeason();
  }

  // Quick add week
  async function addWeek() {
    if (!season) return;
    const next = (weeks[weeks.length - 1]?.week_number ?? 0) + 1;
    const starts = new Date(); starts.setDate(starts.getDate() + 7 * (next - 1));
    const ends = new Date(starts); ends.setDate(ends.getDate() + 5);
    const { error } = await (supabase as any).from('nfl_weeks').insert({
      season_id: season.id, week_number: next, label: `Week ${next}`,
      starts_at: starts.toISOString(), ends_at: ends.toISOString(),
      status: 'upcoming',
    });
    if (error) return toast.error(error.message);
    toast.success(`Week ${next} added`);
    refetchWeeks();
  }

  async function setWeekStatus(id: string, status: string) {
    const { error } = await (supabase as any).from('nfl_weeks').update({ status }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Week status updated');
    refetchWeeks();
  }

  async function setFeaturedGame(weekId: string, gameId: string) {
    const { error } = await (supabase as any).from('nfl_weeks').update({ featured_game_id: gameId }).eq('id', weekId);
    if (error) return toast.error(error.message);
    toast.success('Tiebreaker game set');
    refetchWeeks();
  }

  async function addGame() {
    if (!activeWeekId || !season) return;
    if (!newGame.away || !newGame.home || !newGame.kickoff) return toast.error('Pick teams + kickoff');
    if (newGame.away === newGame.home) return toast.error('Teams must differ');
    const { error } = await (supabase as any).from('nfl_games').insert({
      season_id: season.id, week_id: activeWeekId,
      away_team_id: newGame.away, home_team_id: newGame.home,
      kickoff_at: new Date(newGame.kickoff).toISOString(),
      status: 'scheduled',
    });
    if (error) return toast.error(error.message);
    toast.success('Game added');
    setNewGame({ away: '', home: '', kickoff: '' });
    refetchGames();
  }

  async function deleteGame(id: string) {
    if (!confirm('Delete this game?')) return;
    const { error } = await (supabase as any).from('nfl_games').delete().eq('id', id);
    if (error) return toast.error(error.message);
    refetchGames();
  }

  async function saveFinal(gameId: string, away: number, home: number) {
    const game = games.find((g) => g.id === gameId)!;
    const winner = away > home ? game.away_team_id : home > away ? game.home_team_id : null;
    const { error } = await (supabase as any).from('nfl_games').update({
      away_score: away, home_score: home, status: 'final', winner_team_id: winner,
    }).eq('id', gameId);
    if (error) return toast.error(error.message);
    toast.success('Final score saved');
    refetchGames();
  }

  async function scoreWeek() {
    if (!activeWeekId) return;
    const { data, error } = await supabase.functions.invoke('score-nfl-week', {
      body: { week_id: activeWeekId },
    });
    if (error) return toast.error(error.message);
    toast.success(`Scored: ${data?.scored_users ?? 0} users`);
    refetchWeeks();
    refetchGames();
  }

  return (
    <div className="space-y-3 pb-8">
      <Link to="/pickem" className="text-[12px] text-muted-foreground flex items-center gap-1 btn-press">
        <ChevronLeft className="w-4 h-4" /> Pick'em
      </Link>
      <div className="page-header">
        <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, hsl(var(--destructive) / 0.2), hsl(var(--destructive) / 0.05))' }}>
          <Shield className="w-5 h-5 text-destructive" />
        </div>
        <div>
          <h1 className="page-header-title">Pick'em Admin</h1>
          <p className="page-header-subtitle">Schedule, finals & scoring</p>
        </div>
      </div>

      {/* Season */}
      {season && (
        <div className="glass-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Season</p>
              <p className="text-sm font-extrabold">{season.name}</p>
              <p className="text-[11px] text-muted-foreground">Status: <span className="font-bold">{season.status}</span> · Current week: {season.current_week}</p>
            </div>
            {season.status !== 'active' && <Button size="sm" onClick={activateSeason}>Activate</Button>}
          </div>
        </div>
      )}

      {/* Weeks */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-extrabold text-[13px]">Weeks</h2>
          <Button size="sm" variant="outline" onClick={addWeek}><Plus className="w-3 h-3 mr-1" /> Add</Button>
        </div>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {weeks.map((w) => (
            <div key={w.id} className={`rounded-lg p-2.5 border ${activeWeekId === w.id ? 'border-gold/40 bg-gold/5' : 'border-border/30'}`}>
              <div className="flex items-center gap-2">
                <button onClick={() => setActiveWeekId(w.id)} className="flex-1 text-left">
                  <p className="text-[12px] font-bold">{w.label}</p>
                  <p className="text-[10px] text-muted-foreground">{w.status}</p>
                </button>
                <select className="text-[10px] bg-muted rounded px-1 py-0.5" value={w.status}
                  onChange={(e) => setWeekStatus(w.id, e.target.value)}>
                  <option value="upcoming">upcoming</option>
                  <option value="open">open</option>
                  <option value="partially_locked">partially_locked</option>
                  <option value="closed">closed</option>
                  <option value="scored">scored</option>
                </select>
                <Button size="sm" variant="ghost" onClick={() => setCurrentWeek(w.week_number)}>Current</Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Games for active week */}
      {activeWeekId && (
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-[13px]">Games — {weeks.find(w => w.id === activeWeekId)?.label}</h2>
            <Button size="sm" onClick={scoreWeek}><Calculator className="w-3 h-3 mr-1" /> Score Week</Button>
          </div>

          {/* Tiebreaker selector */}
          <div className="rounded-lg bg-gold/5 border border-gold/20 p-2.5">
            <p className="text-[10px] font-bold text-gold mb-1">Tiebreaker game</p>
            <select
              className="w-full text-[12px] bg-background rounded p-2 border border-border"
              value={weeks.find(w => w.id === activeWeekId)?.featured_game_id ?? ''}
              onChange={(e) => setFeaturedGame(activeWeekId, e.target.value)}
            >
              <option value="">— None —</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>{g.away_team?.abbr} @ {g.home_team?.abbr}</option>
              ))}
            </select>
          </div>

          {/* Add game */}
          <div className="rounded-lg bg-muted/30 p-2.5 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider">Add game</p>
            <div className="grid grid-cols-2 gap-2">
              <select className="text-[12px] bg-background rounded p-2 border border-border" value={newGame.away}
                onChange={(e) => setNewGame({ ...newGame, away: e.target.value })}>
                <option value="">Away…</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.abbr} {t.name}</option>)}
              </select>
              <select className="text-[12px] bg-background rounded p-2 border border-border" value={newGame.home}
                onChange={(e) => setNewGame({ ...newGame, home: e.target.value })}>
                <option value="">Home…</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.abbr} {t.name}</option>)}
              </select>
            </div>
            <Input type="datetime-local" value={newGame.kickoff} onChange={(e) => setNewGame({ ...newGame, kickoff: e.target.value })} />
            <Button size="sm" className="w-full" onClick={addGame}><Plus className="w-3 h-3 mr-1" /> Add Game</Button>
          </div>

          {/* Game list with final-score input */}
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {games.map((g) => (
              <GameAdminRow key={g.id} game={g} onSaveFinal={saveFinal} onDelete={deleteGame} />
            ))}
            {games.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-3">No games yet for this week</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function GameAdminRow({ game, onSaveFinal, onDelete }: { game: any; onSaveFinal: (id: string, a: number, h: number) => void; onDelete: (id: string) => void }) {
  const [away, setAway] = useState(game.away_score?.toString() ?? '');
  const [home, setHome] = useState(game.home_score?.toString() ?? '');

  return (
    <div className="rounded-lg bg-card/40 border border-border/30 p-2 flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-bold truncate">{game.away_team?.abbr} @ {game.home_team?.abbr}</p>
        <p className="text-[10px] text-muted-foreground">{new Date(game.kickoff_at).toLocaleString()} · {game.status}</p>
      </div>
      <Input type="number" className="w-14 h-8 text-center" placeholder="A" value={away} onChange={(e) => setAway(e.target.value)} />
      <Input type="number" className="w-14 h-8 text-center" placeholder="H" value={home} onChange={(e) => setHome(e.target.value)} />
      <Button size="sm" variant="outline" onClick={() => onSaveFinal(game.id, parseInt(away || '0', 10), parseInt(home || '0', 10))}>
        <Save className="w-3 h-3" />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onDelete(game.id)} className="text-destructive">×</Button>
    </div>
  );
}
