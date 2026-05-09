import { useEffect, useState } from 'react';
import { Clock, Lock, Unlock, Activity, Trophy, Archive } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { PwChallenge } from '@/hooks/usePortfolioWars';

const PHASE = {
  upcoming:   { label: 'Picks Open',       Icon: Unlock,   color: 'hsl(152 80% 55%)' },
  locked:     { label: 'Picks Locked',     Icon: Lock,     color: 'hsl(38 100% 60%)' },
  active:     { label: 'Market Active',    Icon: Activity, color: 'hsl(152 80% 55%)' },
  completed:  { label: 'Week Complete',    Icon: Trophy,   color: 'hsl(45 95% 60%)' },
  archived:   { label: 'Archived',         Icon: Archive,  color: 'hsl(220 10% 55%)' },
} as const;

function fmtCountdown(ms: number) {
  if (ms <= 0) return '0s';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function MarketClock({ challenge }: { challenge: PwChallenge }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const phase = PHASE[challenge.status as keyof typeof PHASE] ?? PHASE.archived;
  const lockMs = new Date(challenge.lock_at).getTime() - now;
  const endMs = new Date(challenge.end_at).getTime() - now;
  const startMs = new Date(challenge.week_start).getTime();
  const totalMs = new Date(challenge.week_end).getTime() - startMs;
  const elapsed = Math.max(0, Math.min(1, (now - startMs) / Math.max(totalMs, 1)));
  const progressPct = Math.round(elapsed * 100);

  const targetLabel =
    challenge.status === 'upcoming' ? `Locks ${format(new Date(challenge.lock_at), 'EEE h:mm a')} ET` :
    challenge.status === 'locked' ? 'Awaiting market open' :
    challenge.status === 'active' ? `Closes ${format(new Date(challenge.end_at), 'EEE h:mm a')} ET` :
    `Closed ${format(new Date(challenge.end_at), 'MMM d')}`;

  const countdownMs =
    challenge.status === 'upcoming' ? lockMs :
    challenge.status === 'active' ? endMs : 0;

  const Icon = phase.Icon;

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-4"
      style={{
        background:
          'radial-gradient(ellipse 120% 80% at 50% -10%, hsl(220 60% 14% / 0.85), transparent 65%),' +
          'linear-gradient(180deg, hsl(220 50% 7%), hsl(220 55% 4%))',
        border: `1px solid ${phase.color.replace(')', ' / 0.32)')}`,
        boxShadow: `inset 0 1px 0 ${phase.color.replace(')', ' / 0.18)')}, 0 10px 30px -12px ${phase.color.replace(')', ' / 0.30)')}`,
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: `${phase.color.replace(')', ' / 0.14)')}`,
              border: `1px solid ${phase.color.replace(')', ' / 0.34)')}`,
              boxShadow: `0 0 16px ${phase.color.replace(')', ' / 0.30)')}`,
            }}
          >
            <Icon className="w-4 h-4" style={{ color: phase.color }} />
          </span>
          <div className="min-w-0">
            <div
              className="text-[9px] font-black uppercase tracking-[0.22em] truncate"
              style={{ color: phase.color }}
            >
              Week {challenge.week_number} · {phase.label}
            </div>
            <div className="text-[14px] font-extrabold leading-tight truncate">
              {format(new Date(challenge.week_start), 'MMM d')} — {format(new Date(challenge.week_end), 'MMM d')}
            </div>
          </div>
        </div>
        {challenge.status === 'active' && (
          <span
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider"
            style={{ background: 'hsl(152 80% 50% / 0.16)', color: 'hsl(152 80% 65%)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'hsl(152 80% 60%)' }} />
            LIVE
          </span>
        )}
      </div>

      {/* Countdown / target */}
      <div className="flex items-baseline justify-between mb-2.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/55 flex items-center gap-1">
          <Clock className="w-3 h-3" /> {targetLabel}
        </span>
        {countdownMs > 0 && (
          <span
            className="text-[15px] font-black tabular-nums font-mono"
            style={{ color: phase.color, textShadow: `0 0 14px ${phase.color.replace(')', ' / 0.5)')}` }}
          >
            {fmtCountdown(countdownMs)}
          </span>
        )}
      </div>

      {/* Mon → Fri progress */}
      <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(220 30% 12%)' }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
          style={{
            width: `${progressPct}%`,
            background: `linear-gradient(90deg, ${phase.color.replace(')', ' / 0.55)')}, ${phase.color})`,
            boxShadow: `0 0 10px ${phase.color.replace(')', ' / 0.65)')}`,
          }}
        />
      </div>
      <div className="flex justify-between text-[8.5px] font-bold uppercase tracking-wider text-white/40 mt-1">
        <span>Mon Open</span>
        <span className={cn(elapsed >= 0.5 && 'text-white/55')}>Wed</span>
        <span>Fri Close</span>
      </div>
    </div>
  );
}
