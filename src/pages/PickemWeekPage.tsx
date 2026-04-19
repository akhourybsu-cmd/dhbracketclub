import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ListChecks, ArrowRight, CalendarOff } from 'lucide-react';
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
          <p className="text-sm font-bold">{season ? 'Week not found' : 'No active season'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link to="/pickem" className="text-[12px] text-muted-foreground flex items-center gap-1 btn-press">
          <ChevronLeft className="w-4 h-4" /> Pick'em
        </Link>
        <WeekStatusPill status={weekStatus} />
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-gold/80">This Week</p>
          <h1 className="text-[26px] font-extrabold tracking-tight leading-none mt-0.5">{week.label}</h1>
        </div>
        {totalGames > 0 && (
          <div className="text-[11px] font-extrabold text-muted-foreground tabular-nums shrink-0 pb-1">
            {pickedCount}/{totalGames} <span className="text-gold">picked</span>
          </div>
        )}
      </div>

      <WeekNavigator weeks={weeks} currentWeek={week.week_number} basePath="/pickem/week" />

      {weekStatus === 'scored' && (
        <Link to={`/pickem/week/${week.week_number}/results`}>
          <div className="glass-card p-3 flex items-center gap-2 hover:bg-muted/30 transition-colors">
            <ListChecks className="w-4 h-4 text-gold" />
            <p className="text-[12px] font-extrabold flex-1">View Weekly Results</p>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </Link>
      )}

      {/* Games */}
      {games.length === 0 ? (
        <div className="space-y-2">
          <div className="glass-card p-6 text-center">
            <CalendarOff className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm font-bold mb-1">Schedule not yet imported</p>
            <p className="text-[11px] text-muted-foreground">Games will appear once an admin syncs this week.</p>
          </div>
          {/* Ghost placeholder cards */}
          <div className="space-y-2 opacity-40 pointer-events-none">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl bg-card/30 border border-border/20 p-3">
                <div className="h-3 w-24 rounded skeleton-shimmer mb-2.5" />
                <div className="flex gap-2">
                  <div className="flex-1 h-[68px] rounded-xl bg-muted/30" />
                  <div className="flex items-center text-[9px] font-extrabold text-muted-foreground/30">VS</div>
                  <div className="flex-1 h-[68px] rounded-xl bg-muted/30" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          {games.map((game, i) => {
            const myPick = picks.find((p) => p.game_id === game.id);
            return (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.25 }}
              >
                <GamePickCard
                  game={game}
                  pick={myPick}
                  onPick={(teamId) => handlePick(game.id, teamId)}
                  saving={savingId === game.id}
                />
              </motion.div>
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
