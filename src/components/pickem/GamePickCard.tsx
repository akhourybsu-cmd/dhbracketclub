import { Lock, Check, X, Tv } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { useEffect, useRef, useState } from 'react';
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
  weekLocked?: boolean;
  cardLocked?: boolean;
};

export function GamePickCard({ game, pick, onPick, saving, weekLocked, cardLocked }: Props) {
  const { play } = useSoundEffect();
  const locked = weekLocked ?? isGameLocked(game);
  const blocked = locked || cardLocked;
  const isFinal = game.status === 'final';
  const isLive = game.status === 'live';
  const pickedId = pick?.picked_team_id;

  // Track which side was just tapped — drives the sweep animation
  const [sweptSide, setSweptSide] = useState<'home' | 'away' | null>(null);
  const sweepTimerRef = useRef<number | null>(null);
  useEffect(() => () => { if (sweepTimerRef.current) clearTimeout(sweepTimerRef.current); }, []);

  function handleTap(side: 'home' | 'away', teamId: string) {
    if (blocked || saving) return;
    play('tap');
    setSweptSide(side);
    if (sweepTimerRef.current) clearTimeout(sweepTimerRef.current);
    sweepTimerRef.current = window.setTimeout(() => setSweptSide(null), 700);
    onPick(teamId);
  }

  const TeamButton = ({ side }: { side: 'away' | 'home' }) => {
    const team = side === 'away' ? game.away_team : game.home_team;
    const teamId = side === 'away' ? game.away_team_id : game.home_team_id;
    const score = side === 'away' ? game.away_score : game.home_score;
    const selected = pickedId === teamId;
    const isWinner = isFinal && game.winner_team_id === teamId;
    const wasCorrect = isFinal && selected && pick?.is_correct === true;
    const wasWrong = isFinal && selected && pick?.is_correct === false;
    const showSweep = sweptSide === side && selected && !isFinal;

    return (
      <motion.button
        type="button"
        disabled={locked || saving}
        whileTap={!locked && !saving ? { scale: 0.97 } : undefined}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        onClick={() => handleTap(side, teamId)}
        className={cn(
          'flex-1 flex items-center gap-2.5 px-3 min-h-[68px] py-2.5 rounded-xl transition-all duration-150 btn-press',
          'border text-left relative overflow-hidden',
          selected && !isFinal && 'pk-selected',
          !selected && !locked && 'bg-card/70 hover:bg-muted/40 border-border/40',
          locked && !selected && 'bg-muted/20 border-border/20 opacity-55',
          locked && selected && !isFinal && 'pk-selected opacity-90',
          wasCorrect && 'bg-success/15 border-success/55 ring-2 ring-success/35 shadow-[0_0_18px_hsl(var(--success)/0.18)]',
          wasWrong && 'bg-destructive/10 border-destructive/45',
          isWinner && !selected && isFinal && 'border-success/35 bg-success/5',
        )}
        aria-pressed={selected}
        aria-label={`Pick ${team?.city ?? ''} ${team?.name ?? ''}${selected ? ' (selected)' : ''}`}
      >
        {showSweep && <span className="pk-sweep" aria-hidden />}
        <div className="relative">
          <TeamLogo
            team={team}
            size={38}
            className={cn(
              'transition-all',
              selected && !isFinal && 'ring-2 ring-gold/60 ring-offset-1 ring-offset-card',
              locked && !selected && 'grayscale opacity-70',
            )}
          />
          {selected && !isFinal && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-gold flex items-center justify-center shadow-[0_0_8px_hsl(var(--gold)/0.6)]"
            >
              <Check className="w-2.5 h-2.5 text-background" strokeWidth={3.5} />
            </motion.div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-[13px] font-extrabold leading-tight truncate tracking-tight',
            isWinner && 'text-success',
          )}>{team?.abbr}</p>
          <p className="text-[10px] text-muted-foreground/80 truncate">{team?.name}</p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          {(isFinal || isLive) && score !== null && (
            <span className={cn(
              'text-[18px] font-extrabold tabular-nums leading-none',
              isWinner && 'text-success',
              !isWinner && isFinal && 'text-muted-foreground/70',
            )}>
              {score}
            </span>
          )}
          {wasCorrect && <Check className="w-3.5 h-3.5 text-success" />}
          {wasWrong && <X className="w-3.5 h-3.5 text-destructive" />}
        </div>
      </motion.button>
    );
  };

  return (
    <div className="pk-scorebug p-3">
      {/* Scorebug header: time + status (broadcast lower-third) */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5">
          <Tv className="w-3 h-3 text-muted-foreground/60" />
          <p className="text-[10px] font-extrabold text-muted-foreground/85 uppercase tracking-[0.14em] tabular-nums">
            {format(new Date(game.kickoff_at), 'EEE h:mm a')}
          </p>
        </div>
        {isFinal ? (
          <span className="pk-stamp pk-stamp-locked">Final</span>
        ) : isLive ? (
          <span className="pk-stamp pk-stamp-live">
            <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse" /> Live
          </span>
        ) : locked ? (
          <span className="pk-stamp pk-stamp-locked"><Lock className="w-2.5 h-2.5" /> Locked</span>
        ) : (
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-success">Open</span>
        )}
      </div>

      <div className="flex items-stretch gap-2">
        <TeamButton side="away" />
        <div
          className="flex items-center justify-center text-[9px] font-extrabold tracking-[0.18em] text-muted-foreground/60 px-1"
          aria-hidden
        >
          <span className="px-1.5 py-1 rounded-full bg-black/40 border border-white/10">@</span>
        </div>
        <TeamButton side="home" />
      </div>
    </div>
  );
}
