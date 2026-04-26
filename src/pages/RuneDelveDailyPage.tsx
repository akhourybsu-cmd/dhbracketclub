import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Flame, Trophy, Sparkles } from 'lucide-react';
import { useTodayDaily, useMyDailyRun, useMyDailyStreak, useDailyLeaderboard } from '@/hooks/useDailyChallenge';
import { getDailyModifier } from '@/lib/runedelve/dailyModifiers';
import { ClassBadge } from '@/components/runedelve/ClassBadge';
import type { HeroClass } from '@/lib/runedelve/classConfig';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Daily Challenge landing page. Shows today's modifiers, the player's status
 * for today (not yet attempted / completed with stars), the leaderboard, and
 * the streak counters.
 *
 * NOTE: The "Begin Daily Run" CTA currently routes the player to the seeded
 * level via the regular play route. Full modifier application in combat will
 * be wired in the next pass — this page already conveys the rules so players
 * understand what's coming when they tap in.
 */
export default function RuneDelveDailyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const today = useTodayDaily();
  const { data: myRun, isLoading: runLoading } = useMyDailyRun();
  const { data: streak } = useMyDailyStreak();
  const { data: board } = useDailyLeaderboard(10);

  const myRank = (board ?? []).find(r => r.user_id === user?.id)?.rank;
  const isWeekend = today.modifiers.length === 3;
  const completed = !!myRun;

  return (
    <div className="space-y-4 pb-8">
      {/* Hero banner */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="glass-card p-5 relative overflow-hidden" style={{
          background: 'linear-gradient(160deg, hsl(var(--gold) / 0.12), hsl(var(--primary) / 0.08))',
          borderColor: 'hsl(var(--gold) / 0.25)',
        }}>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold tracking-[0.18em]" style={{
              background: 'hsl(var(--gold) / 0.2)', color: 'hsl(var(--gold))',
            }}>DAILY CHALLENGE</span>
            <span className="text-[10px] font-extrabold text-foreground/70 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {today.dateStr}
            </span>
            {isWeekend && (
              <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider bg-destructive/15 text-destructive">
                Weekend Gauntlet
              </span>
            )}
          </div>
          <h2 className="rd-title text-2xl tracking-wide leading-tight text-foreground">Today's Trial</h2>
          <p className="text-[12px] text-foreground/75 mb-4 italic">
            One attempt. Same modifiers for every delver. Climb the daily board.
          </p>

          {completed ? (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 mb-3">
              <p className="text-[11px] font-extrabold text-primary mb-1">
                {'★'.repeat(myRun!.stars)}{'☆'.repeat(3 - myRun!.stars)} · Score {myRun!.score.toLocaleString()}
              </p>
              <p className="text-[11px] text-foreground/80">
                {myRun!.dungeon_cleared ? 'Daily cleared. Come back tomorrow for a fresh trial.' : 'Better luck tomorrow — the daily resets at 00:00 UTC.'}
              </p>
            </div>
          ) : runLoading ? (
            <div className="h-12 rounded-xl skeleton-shimmer mb-3" />
          ) : (
            <button
              onClick={() => navigate(`/rune-delve/play/${today.levelNumber}`)}
              className="w-full h-12 rounded-xl font-extrabold text-sm btn-press flex items-center justify-center gap-2 mb-2"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--gold)), hsl(var(--primary-glow)))',
                color: 'hsl(var(--background))',
                boxShadow: 'var(--shadow-glow)',
              }}
            >
              <Sparkles className="w-4 h-4" /> Begin Daily · Level {today.levelNumber}
            </button>
          )}
        </div>
      </motion.div>

      {/* Modifiers */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">Active Modifiers</p>
        {today.modifiers.map(id => {
          const m = getDailyModifier(id);
          return (
            <div key={id} className="glass-card p-3 flex gap-3 items-start">
              <div className="text-2xl shrink-0 leading-none mt-0.5" aria-hidden>{m.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-[13px]">{m.name}</p>
                <p className="text-[11px] text-foreground/80 leading-snug">{m.rule}</p>
                <p className="text-[10px] text-muted-foreground italic mt-0.5">{m.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Streak */}
      <div className="grid grid-cols-3 gap-2">
        <StreakCard label="Current" value={streak?.current_streak ?? 0} icon={<Flame className="w-3 h-3" />} highlight />
        <StreakCard label="Best" value={streak?.best_streak ?? 0} />
        <StreakCard label="Lifetime" value={streak?.lifetime_clears ?? 0} />
      </div>

      {/* Rewards reminder */}
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 text-[11px] text-foreground/85 leading-snug">
        <p className="font-extrabold text-primary mb-1.5">Rewards</p>
        <ul className="space-y-0.5">
          <li>• Clear → 50 shards + 100 XP</li>
          <li>• 2★ → +25 shards · 3★ → +50 shards</li>
          <li>• 7-day streak → 200 shards + Daily Devotee title</li>
          <li>• 30-day streak → 1000 shards + Eternal Pilgrim title</li>
        </ul>
      </div>

      {/* Daily Leaderboard */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-rd-display font-extrabold text-[14px] flex items-center gap-1.5 tracking-wide">
            <Trophy className="w-3.5 h-3.5 text-gold" /> Today's Top
          </h3>
          {myRank && <span className="text-[10px] font-extrabold text-foreground/75">You: #{myRank}</span>}
        </div>
        {(board ?? []).length === 0 ? (
          <p className="text-[11px] text-center text-foreground/75 py-4">Be the first to attempt today's trial.</p>
        ) : (
          <div className="space-y-1.5 rd-stagger">
            {(board ?? []).slice(0, 10).map(r => (
              <div key={r.id} className="flex items-center gap-2.5 text-[12px]">
                <span className="w-5 font-mono font-extrabold text-foreground/75">#{r.rank}</span>
                <ClassBadge cls={r.hero_class as HeroClass} size="sm" />
                <span className="font-rd-display flex-1 truncate font-extrabold tracking-wide">
                  {r.profile.display_name ?? 'Anonymous'}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums">{'★'.repeat(r.stars)}</span>
                <span className="font-mono font-extrabold tabular-nums" style={{ color: 'hsl(var(--gold))' }}>
                  {r.score.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StreakCard({ label, value, icon, highlight }: { label: string; value: number; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="glass-card p-3 text-center" style={highlight ? { borderColor: 'hsl(var(--gold) / 0.3)' } : undefined}>
      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 justify-center">
        {icon}{label}
      </p>
      <p className="font-mono font-extrabold text-lg tabular-nums mt-0.5" style={{ color: 'hsl(var(--gold))' }}>{value}</p>
    </div>
  );
}
