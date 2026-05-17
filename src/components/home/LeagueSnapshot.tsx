// DH Club Home — League Snapshot
//
// Compact season pulse card. Renders only when Draft Arena is installed AND
// a season is active. Replaces the older sprawling League block with: top-3
// inline standings, a season progress bar, and a single tap target into the
// season hub. Keeps text minimum, signal maximum.

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, ChevronRight, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusPill } from '@/components/ui/status-pill';

interface StandingLite {
  id: string;
  user_id: string;
  rank: number | null;
  season_points: number;
  profiles?: { display_name?: string } | null;
}

interface Props {
  season: { id: string; name: string; status: string; season_label?: string | null };
  standings: StandingLite[];
  /** Number of regular drafts completed. */
  regularEntries: number;
  /** Total target drafts in the regular season. */
  seasonTarget: number;
  userId: string | undefined;
}

export function LeagueSnapshot({ season, standings, regularEntries, seasonTarget, userId }: Props) {
  const isPlayoffs = season.status === 'playoffs';
  const progress = seasonTarget > 0 ? Math.min(100, Math.round((regularEntries / seasonTarget) * 100)) : 0;
  const top3 = standings.slice(0, 3);
  const myStanding = standings.find(s => s.user_id === userId);
  const myInTop3 = top3.some(s => s.user_id === userId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="mb-5"
    >
      <Link to="/drafts?tab=season" className="block group active:scale-[0.99] transition-transform">
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{
            background: 'radial-gradient(ellipse 70% 60% at 100% 0%, hsl(var(--gold) / 0.14), transparent 60%), linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.92))',
            border: '1px solid hsl(var(--gold) / 0.28)',
            boxShadow: '0 0 18px -8px hsl(var(--gold) / 0.4)',
          }}
        >
          {/* Header row */}
          <div className="flex items-center justify-between px-3.5 pt-3">
            <div className="flex items-center gap-1.5 min-w-0">
              <Trophy className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'hsl(var(--gold))' }} />
              <p className="text-[9px] font-extrabold uppercase tracking-[0.22em] truncate" style={{ color: 'hsl(var(--gold))' }}>
                {season.season_label ? `${season.season_label} · LEAGUE` : 'LEAGUE'}
              </p>
            </div>
            {isPlayoffs ? (
              <StatusPill variant="premium" size="xs" dot pulse>Playoffs</StatusPill>
            ) : (
              <span className="text-[9.5px] font-bold tabular-nums text-muted-foreground/70">
                {regularEntries}/{seasonTarget} drafts
              </span>
            )}
          </div>

          {/* Title + chevron */}
          <div className="flex items-center justify-between gap-2 px-3.5 pt-1.5">
            <h2 className="text-[14px] font-extrabold tracking-tight truncate">{season.name}</h2>
            <ChevronRight className="w-4 h-4 text-muted-foreground/55 flex-shrink-0" />
          </div>

          {/* Top 3 inline */}
          {top3.length > 0 && (
            <div className="px-3.5 mt-2 space-y-1">
              {top3.map((s, idx) => {
                const podium: Array<string> = ['hsl(var(--gold))', 'hsl(0 0% 75%)', 'hsl(35 60% 55%)'];
                const isMe = s.user_id === userId;
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-md flex items-center justify-center text-[8.5px] font-extrabold flex-shrink-0"
                      style={{
                        background: `${podium[idx]}26`,
                        color: podium[idx],
                        border: `1px solid ${podium[idx]}55`,
                      }}
                    >
                      {idx + 1}
                    </span>
                    <span
                      className={cn(
                        'text-[11px] font-semibold truncate flex-1',
                        isMe && 'text-[hsl(var(--gold))]',
                      )}
                    >
                      {s.profiles?.display_name || 'Unknown'}{isMe && ' · you'}
                    </span>
                    {idx === 0 && <Crown className="w-3 h-3 flex-shrink-0" style={{ color: 'hsl(var(--gold))' }} />}
                    <span className="text-[11px] font-extrabold tabular-nums" style={{ color: 'hsl(var(--gold))' }}>
                      {s.season_points}
                    </span>
                  </div>
                );
              })}
              {/* If user isn't in top 3, surface their rank inline */}
              {!myInTop3 && myStanding && (
                <div className="flex items-center gap-2 pt-1 mt-1 border-t border-border/15">
                  <span className="w-4 h-4 rounded-md flex items-center justify-center text-[8.5px] font-extrabold flex-shrink-0 text-muted-foreground/70 bg-muted/40">
                    #{myStanding.rank ?? '—'}
                  </span>
                  <span className="text-[11px] font-semibold truncate flex-1 text-[hsl(var(--gold))]">You</span>
                  <span className="text-[11px] font-extrabold tabular-nums" style={{ color: 'hsl(var(--gold))' }}>
                    {myStanding.season_points}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Progress bar */}
          {!isPlayoffs && seasonTarget > 0 && (
            <div className="px-3.5 mt-3 mb-3">
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'hsl(var(--muted) / 0.4)' }}>
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, hsl(var(--gold) / 0.7), hsl(var(--gold)))',
                    boxShadow: '0 0 8px hsl(var(--gold) / 0.4)',
                  }}
                />
              </div>
            </div>
          )}
          {(isPlayoffs || seasonTarget === 0) && <div className="h-3" />}
        </div>
      </Link>
    </motion.div>
  );
}
