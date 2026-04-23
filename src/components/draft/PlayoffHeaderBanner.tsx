import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import {
  getPlayoffRoundShort,
  getPlayoffGameLabel,
  getPlayoffGlyph,
  formatSeriesScore,
  type PlayoffRound,
} from '@/lib/playoffStyle';

interface PlayoffHeaderBannerProps {
  round: PlayoffRound;
  matchNumber?: number | null;
  seasonName?: string | null;
  userAName?: string | null;
  userBName?: string | null;
  finalsWins?: Record<string, number> | null;
  userA?: string | null;
  userB?: string | null;
}

/** Full-width amber tournament strip shown at the top of a playoff DraftDetail. */
export function PlayoffHeaderBanner({
  round,
  matchNumber,
  seasonName,
  userAName,
  userBName,
  finalsWins,
  userA,
  userB,
}: PlayoffHeaderBannerProps) {
  const series = formatSeriesScore(round, finalsWins, userA, userB);
  const glyph = getPlayoffGlyph(round);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative overflow-hidden rounded-2xl px-4 py-3 mb-4"
      style={{
        background: 'linear-gradient(135deg, hsl(45 93% 52% / 0.18), hsl(38 92% 50% / 0.08) 60%, transparent)',
        border: '1px solid hsl(45 93% 52% / 0.35)',
        boxShadow: '0 6px 28px -10px hsl(45 93% 52% / 0.45), inset 0 1px 0 hsl(45 93% 52% / 0.2)',
      }}
    >
      {/* Bracket-rail motif */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, hsl(45 93% 52% / 0.7), transparent)' }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, hsl(45 93% 52% / 0.4), transparent)' }}
      />
      <div className="absolute -right-3 -top-3 text-5xl opacity-10 select-none pointer-events-none" aria-hidden>
        {glyph}
      </div>

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Trophy className="w-3.5 h-3.5" style={{ color: 'hsl(45 93% 52%)' }} strokeWidth={2.5} />
            <span
              className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
              style={{ color: 'hsl(45 93% 52%)' }}
            >
              {getPlayoffRoundShort(round)}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground/70">·</span>
            <span className="text-[10px] font-bold tracking-wide text-foreground/85">
              {getPlayoffGameLabel(round, matchNumber)}
            </span>
          </div>
          {(userAName || userBName) && (
            <div className="text-[11px] font-bold text-foreground/80 truncate">
              {userAName || 'TBD'} <span className="text-muted-foreground/60">vs</span> {userBName || 'TBD'}
              {series && (
                <span
                  className="ml-2 inline-flex items-center px-1.5 py-[1px] rounded font-mono text-[10px] font-extrabold tabular-nums"
                  style={{ background: 'hsl(45 93% 52% / 0.18)', color: 'hsl(45 93% 52%)' }}
                >
                  {series}
                </span>
              )}
            </div>
          )}
        </div>
        {seasonName && (
          <div className="text-right flex-shrink-0">
            <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Season</div>
            <div className="text-[11px] font-extrabold tracking-tight" style={{ color: 'hsl(45 93% 52%)' }}>
              {seasonName}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
