import { Lock, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { TeamLogo } from './TeamLogo';
import type { NflGame, NflPick } from '@/hooks/usePickem';
import { isGameLocked } from '@/hooks/usePickem';
import { useSoundEffect } from '@/hooks/useSoundEffect';

type Props = {
  game: NflGame;
  pick?: NflPick;
  onPick: (teamId: string) => void;
  saving?: boolean;
};

export function GamePickCard({ game, pick, onPick, saving }: Props) {
  const { play } = useSoundEffect();
  const locked = isGameLocked(game);
  const isFinal = game.status === 'final';
  const isLive = game.status === 'live';
  const pickedId = pick?.picked_team_id;

  const TeamButton = ({ side }: { side: 'away' | 'home' }) => {
    const team = side === 'away' ? game.away_team : game.home_team;
    const teamId = side === 'away' ? game.away_team_id : game.home_team_id;
    const score = side === 'away' ? game.away_score : game.home_score;
    const selected = pickedId === teamId;
    const isWinner = isFinal && game.winner_team_id === teamId;
    const wasCorrect = isFinal && selected && pick?.is_correct === true;
    const wasWrong = isFinal && selected && pick?.is_correct === false;

    return (
      <button
        type="button"
        disabled={locked || saving}
        onClick={() => { play('tap'); onPick(teamId); }}
        className={cn(
          'flex-1 flex items-center gap-2.5 px-3 min-h-[60px] py-2.5 rounded-xl transition-all duration-150 btn-press',
          'border text-left',
          selected && !isFinal && 'bg-gold/15 border-gold/50 ring-2 ring-gold/30 shadow-sm',
          !selected && !locked && 'bg-card hover:bg-muted/40 border-border/40',
          locked && !selected && 'bg-muted/20 border-border/20 opacity-60',
          locked && selected && !isFinal && 'bg-gold/10 border-gold/40 opacity-90',
          wasCorrect && 'bg-success/15 border-success/50 ring-2 ring-success/30',
          wasWrong && 'bg-destructive/10 border-destructive/40',
          isWinner && !selected && isFinal && 'border-success/30',
        )}
        aria-pressed={selected}
        aria-label={`Pick ${team?.city ?? ''} ${team?.name ?? ''}${selected ? ' (selected)' : ''}`}
      >
        <TeamLogo team={team} size={36} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-extrabold leading-tight truncate">{team?.abbr}</p>
          <p className="text-[10px] text-muted-foreground/80 truncate">{team?.name}</p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          {(isFinal || isLive) && score !== null && (
            <span className={cn(
              'text-[15px] font-extrabold tabular-nums',
              isWinner && 'text-success',
            )}>
              {score}
            </span>
          )}
          {wasCorrect && <Check className="w-3.5 h-3.5 text-success" />}
          {wasWrong && <X className="w-3.5 h-3.5 text-destructive" />}
        </div>
      </button>
    );
  };

  return (
    <div className="rounded-2xl bg-card/40 border border-border/30 p-3">
      {/* Header row: time + status */}
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">
          {format(new Date(game.kickoff_at), 'EEE h:mm a')}
        </p>
        {locked ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
            {isLive && <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />}
            {isFinal ? 'FINAL' : isLive ? 'LIVE' : <><Lock className="w-2.5 h-2.5" /> LOCKED</>}
          </span>
        ) : (
          <span className="text-[10px] font-bold text-success">OPEN</span>
        )}
      </div>

      <div className="flex items-stretch gap-2">
        <TeamButton side="away" />
        <div className="flex items-center text-[10px] font-bold text-muted-foreground/50">@</div>
        <TeamButton side="home" />
      </div>
    </div>
  );
}
