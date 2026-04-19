import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Trophy, Check, X } from 'lucide-react';
import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useActiveSeason, useSeasonWeeks, useWeekGames, useMyWeekPicks, useWeeklyStandings,
} from '@/hooks/usePickem';
import { TeamLogo } from '@/components/pickem/TeamLogo';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function PickemWeekResultsPage() {
  const { weekNumber } = useParams<{ weekNumber: string }>();
  const num = parseInt(weekNumber || '1', 10);
  const { user } = useAuth();
  const { season } = useActiveSeason();
  const { weeks } = useSeasonWeeks(season?.id);
  const week = useMemo(() => weeks.find((w) => w.week_number === num), [weeks, num]);
  const { games } = useWeekGames(week?.id);
  const { picks } = useMyWeekPicks(week?.id);
  const { standings } = useWeeklyStandings(week?.id);

  const correctCount = picks.filter((p) => p.is_correct === true).length;
  const totalScored = picks.filter((p) => p.is_correct !== null).length;

  return (
    <div className="space-y-3 pb-6">
      <div className="flex items-center justify-between">
        <Link to="/pickem" className="text-[12px] text-muted-foreground flex items-center gap-1 btn-press">
          <ChevronLeft className="w-4 h-4" /> Pick'em
        </Link>
        <Link to={`/pickem/week/${num}`} className="text-[12px] text-gold font-bold btn-press">
          Slate
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{week?.label ?? `Week ${num}`} Results</h1>
        <p className="text-[12px] text-muted-foreground">
          You got <span className="font-bold text-foreground">{correctCount}</span> of {totalScored || picks.length} correct
        </p>
      </div>

      {/* Per-game results */}
      <div className="space-y-2">
        {games.map((game) => {
          const myPick = picks.find((p) => p.game_id === game.id);
          const winner = game.winner_team_id;
          const isFinal = game.status === 'final';
          const wasCorrect = myPick?.is_correct === true;
          const wasWrong = myPick?.is_correct === false;
          return (
            <div key={game.id} className={cn(
              'rounded-2xl border p-3',
              wasCorrect && 'bg-success/5 border-success/30',
              wasWrong && 'bg-destructive/5 border-destructive/30',
              !myPick && isFinal && 'bg-muted/20 border-border/30',
              !isFinal && 'bg-card/40 border-border/30',
            )}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {format(new Date(game.kickoff_at), 'EEE h:mm a')}
                </p>
                {isFinal ? (
                  wasCorrect ? <Check className="w-4 h-4 text-success" />
                  : wasWrong ? <X className="w-4 h-4 text-destructive" />
                  : <span className="text-[10px] font-bold text-muted-foreground">No pick</span>
                ) : (
                  <span className="text-[10px] font-bold text-muted-foreground">{game.status === 'live' ? 'LIVE' : 'Pending'}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <TeamRow team={game.away_team} score={game.away_score} isWinner={winner === game.away_team_id} myPickHere={myPick?.picked_team_id === game.away_team_id} />
                <span className="text-[10px] text-muted-foreground">@</span>
                <TeamRow team={game.home_team} score={game.home_score} isWinner={winner === game.home_team_id} myPickHere={myPick?.picked_team_id === game.home_team_id} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Weekly leaderboard */}
      <div className="glass-card overflow-hidden">
        <div className="p-3.5 border-b border-border/20 flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5 text-gold" />
          <h3 className="font-bold text-[13px]">Weekly Leaderboard</h3>
        </div>
        {standings.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">No scored picks yet for this week.</div>
        ) : (
          <div className="divide-y divide-border/10">
            {standings.map((s, i) => {
              const isMe = s.user_id === user?.id;
              const rank = s.rank ?? i + 1;
              return (
                <div key={s.id} className={cn(
                  'flex items-center gap-3 px-4 py-3',
                  isMe && 'bg-gold/5 border-l-2 border-l-gold',
                )}>
                  <div className="w-6 text-center text-[12px] font-extrabold tabular-nums">
                    {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold truncate">{(s.profiles as any)?.display_name ?? 'Unknown'}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {s.correct_picks}/{s.total_picks} · {Math.round((s.accuracy || 0) * 100)}%
                      {s.tiebreak_delta != null && <> · TB ±{s.tiebreak_delta}</>}
                    </p>
                  </div>
                  <div className="text-base font-extrabold tabular-nums">{s.correct_picks}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamRow({ team, score, isWinner, myPickHere }: { team?: any; score: number | null; isWinner: boolean; myPickHere: boolean }) {
  return (
    <div className={cn(
      'flex-1 flex items-center gap-2 p-2 rounded-lg',
      isWinner && 'bg-success/10',
      myPickHere && !isWinner && 'ring-1 ring-border',
    )}>
      <TeamLogo team={team} size={28} />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-extrabold leading-tight truncate">{team?.abbr}</p>
      </div>
      {score !== null && <span className={cn('text-[14px] font-extrabold tabular-nums', isWinner && 'text-success')}>{score}</span>}
    </div>
  );
}
