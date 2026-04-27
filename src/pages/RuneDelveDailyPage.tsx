import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Flame, Trophy, Sparkles, Timer } from 'lucide-react';
import { useTodayDaily, useMyDailyRun, useMyDailyStreak, useDailyLeaderboard } from '@/hooks/useDailyChallenge';
import { ClassBadge } from '@/components/runedelve/ClassBadge';
import type { HeroClass } from '@/lib/runedelve/classConfig';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Daily Endless Survival landing page. Shows the 2-minute arena rules,
 * the player's status for today, the kill-count leaderboard, and streaks.
 */
export default function RuneDelveDailyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const today = useTodayDaily();
  const { data: myRun, isLoading: runLoading } = useMyDailyRun();
  const { data: streak } = useMyDailyStreak();
  const { data: board } = useDailyLeaderboard(10);

  const myRank = (board ?? []).find(r => r.user_id === user?.id)?.rank;
  const completed = !!myRun;

  return (
    <div className="space-y-4 pb-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="glass-card p-5 relative overflow-hidden" style={{
          background: 'linear-gradient(160deg, hsl(var(--gold) / 0.12), hsl(var(--primary) / 0.08))',
          borderColor: 'hsl(var(--gold) / 0.25)',
        }}>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold tracking-[0.18em]" style={{
              background: 'hsl(var(--gold) / 0.2)', color: 'hsl(var(--gold))',
            }}>ENDLESS SURVIVAL</span>
            <span className="text-[10px] font-extrabold text-foreground/70 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {today.dateStr}
            </span>
            <span className="text-[10px] font-extrabold text-foreground/70 uppercase tracking-wider flex items-center gap-1">
              <Timer className="w-3 h-3" /> {today.timeLimitSec / 60}:00
            </span>
          </div>
          <h2 className="rd-title text-2xl tracking-wide leading-tight text-foreground">Today's Arena</h2>
          <p className="text-[12px] text-foreground/75 mb-4 italic">
            Two minutes. No move limit. Kill as many enemies as you can before the timer or your HP hits zero.
          </p>

          {completed ? (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 mb-3">
              <p className="text-[11px] font-extrabold text-primary mb-1">
                {'★'.repeat(myRun!.stars)}{'☆'.repeat(3 - myRun!.stars)} · {myRun!.kills_count} kills · {myRun!.score.toLocaleString()} pts
              </p>
              <p className="text-[11px] text-foreground/80">
                Today's run is logged. Come back tomorrow at 00:00 UTC for a fresh attempt.
              </p>
            </div>
          ) : runLoading ? (
            <div className="h-12 rounded-xl skeleton-shimmer mb-3" />
          ) : (
            <button
              onClick={() => navigate('/rune-delve/endless')}
              className="w-full h-12 rounded-xl font-extrabold text-sm btn-press flex items-center justify-center gap-2 mb-2"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--gold)), hsl(var(--primary-glow)))',
                color: 'hsl(var(--background))',
                boxShadow: 'var(--shadow-glow)',
              }}
            >
              <Sparkles className="w-4 h-4" /> Begin Endless Run
            </button>
          )}
        </div>
      </motion.div>

      {/* Wave ramp */}
      <div className="glass-card p-4 space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Wave Ramp</p>
        {[
          { t: '0:00', label: 'Skirmish', desc: 'Single foes, base HP' },
          { t: '0:20', label: 'Pressure', desc: '+20% HP, occasional pairs' },
          { t: '0:40', label: 'Onslaught', desc: '+50% HP, mini-bosses appear' },
          { t: '1:00', label: 'Swarm', desc: '+100% HP, all spawns are pairs' },
          { t: '1:30', label: 'Final Push', desc: '+200% HP, bosses possible' },
        ].map(w => (
          <div key={w.t} className="flex items-center gap-2 text-[11px]">
            <span className="font-mono font-extrabold tabular-nums w-10" style={{ color: 'hsl(var(--gold))' }}>{w.t}</span>
            <span className="font-extrabold w-20">{w.label}</span>
            <span className="text-foreground/70 flex-1">{w.desc}</span>
          </div>
        ))}
      </div>

      {/* Streak */}
      <div className="grid grid-cols-3 gap-2">
        <StreakCard label="Current" value={streak?.current_streak ?? 0} icon={<Flame className="w-3 h-3" />} highlight />
        <StreakCard label="Best" value={streak?.best_streak ?? 0} />
        <StreakCard label="Lifetime" value={streak?.lifetime_clears ?? 0} />
      </div>

      {/* Reward ladder */}
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 text-[11px] text-foreground/85 leading-snug">
        <p className="font-extrabold text-primary mb-1.5">Reward Ladder · per kill count</p>
        <ul className="space-y-0.5">
          <li>• 0–4 kills → 25 shards</li>
          <li>• 5–9 → 75 shards · ★</li>
          <li>• 10–14 → 150 shards</li>
          <li>• 15–19 → 250 shards · ★★</li>
          <li>• 20–29 → 400 shards</li>
          <li>• 30+ → 600 shards · 🏆 Endless Conqueror</li>
          <li>• 50+ → 900 shards · 🏆 Eternal</li>
        </ul>
      </div>

      {/* Leaderboard — by kill count */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-rd-display font-extrabold text-[14px] flex items-center gap-1.5 tracking-wide">
            <Trophy className="w-3.5 h-3.5 text-gold" /> Today's Top
          </h3>
          {myRank && <span className="text-[10px] font-extrabold text-foreground/75">You: #{myRank}</span>}
        </div>
        {(board ?? []).length === 0 ? (
          <p className="text-[11px] text-center text-foreground/75 py-4">Be the first to enter today's arena.</p>
        ) : (
          <div className="space-y-1.5 rd-stagger">
            {(board ?? []).slice(0, 10).map(r => (
              <div key={r.id} className="flex items-center gap-2.5 text-[12px]">
                <span className="w-5 font-mono font-extrabold text-foreground/75">#{r.rank}</span>
                <ClassBadge cls={r.hero_class as HeroClass} size="sm" />
                <span className="font-rd-display flex-1 truncate font-extrabold tracking-wide">
                  {r.profile.display_name ?? 'Anonymous'}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums">{r.kills_count} kills</span>
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
