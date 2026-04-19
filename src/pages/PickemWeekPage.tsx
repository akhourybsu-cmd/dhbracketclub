import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ListChecks, ArrowRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  useActiveSeason, useSeasonWeeks, useWeekGames, useMyWeekPicks, useMyTiebreaker,
  savePick, saveTiebreaker, deriveWeekStatus,
} from '@/hooks/usePickem';
import { GamePickCard } from '@/components/pickem/GamePickCard';
import { TiebreakerInput } from '@/components/pickem/TiebreakerInput';
import { WeekStatusPill } from '@/components/pickem/WeekStatusPill';
import { WeekNavigator } from '@/components/pickem/WeekNavigator';

export default function PickemWeekPage() {
  const { weekNumber } = useParams<{ weekNumber: string }>();
  const num = parseInt(weekNumber || '1', 10);
  const navigate = useNavigate();
  const { user } = useAuth();

  const { season } = useActiveSeason();
  const { weeks } = useSeasonWeeks(season?.id);
  const week = useMemo(() => weeks.find((w) => w.week_number === num), [weeks, num]);
  const { games, refetch: refetchGames } = useWeekGames(week?.id);
  const { picks, refetch: refetchPicks } = useMyWeekPicks(week?.id);
  const { tiebreaker, refetch: refetchTb } = useMyTiebreaker(week?.id);
  const [savingId, setSavingId] = useState<string | null>(null);

  const featured = games.find((g) => g.id === week?.featured_game_id);
  const weekStatus = week ? (games.length > 0 ? deriveWeekStatus(games) : week.status) : 'upcoming';
  const pickedCount = picks.length;
  const totalGames = games.length;

  async function handlePick(gameId: string, teamId: string) {
    if (!user || !week || !season) return;
    setSavingId(gameId);
    try {
      await savePick({
        user_id: user.id,
        game_id: gameId,
        week_id: week.id,
        season_id: season.id,
        picked_team_id: teamId,
      });
      await refetchPicks();
    } catch (e: any) {
      toast.error(e.message || 'Could not save pick — game may be locked');
    } finally {
      setSavingId(null);
    }
  }

  async function handleTiebreakerSave(value: number) {
    if (!user || !week || !season) return;
    try {
      await saveTiebreaker({
        user_id: user.id,
        week_id: week.id,
        season_id: season.id,
        predicted_total: value,
      });
      await refetchTb();
    } catch (e: any) {
      toast.error(e.message || 'Could not save tiebreaker');
    }
  }

  if (!season || !week) {
    return (
      <div className="space-y-3">
        <Link to="/pickem" className="text-[12px] text-muted-foreground flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> Back
        </Link>
        <div className="glass-card p-6 text-center">
          <p className="text-sm">{season ? 'Week not found' : 'No active season'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link to="/pickem" className="text-[12px] text-muted-foreground flex items-center gap-1 btn-press">
          <ChevronLeft className="w-4 h-4" /> Pick'em
        </Link>
        <WeekStatusPill status={weekStatus} />
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">{week.label}</h1>
        <div className="text-[11px] font-bold text-muted-foreground tabular-nums">
          {pickedCount}/{totalGames} <span className="text-gold">picked</span>
        </div>
      </div>

      <WeekNavigator weeks={weeks} currentWeek={week.week_number} basePath="/pickem/week" />

      {weekStatus === 'scored' && (
        <Link to={`/pickem/week/${week.week_number}/results`}>
          <div className="glass-card p-3 flex items-center gap-2 hover:bg-muted/30 transition-colors">
            <ListChecks className="w-4 h-4 text-gold" />
            <p className="text-[12px] font-bold flex-1">View Weekly Results</p>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </Link>
      )}

      {/* Games */}
      {games.length === 0 ? (
        <div className="glass-card p-6 text-center">
          <p className="text-sm font-bold mb-1">No games scheduled yet</p>
          <p className="text-xs text-muted-foreground">An admin will populate this week's schedule.</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          {games.map((game) => {
            const myPick = picks.find((p) => p.game_id === game.id);
            return (
              <GamePickCard
                key={game.id}
                game={game}
                pick={myPick}
                onPick={(teamId) => handlePick(game.id, teamId)}
                saving={savingId === game.id}
              />
            );
          })}

          {featured && (
            <TiebreakerInput
              game={featured}
              predicted={tiebreaker?.predicted_total}
              actual={tiebreaker?.actual_total}
              onChange={handleTiebreakerSave}
            />
          )}
        </motion.div>
      )}
    </div>
  );
}
