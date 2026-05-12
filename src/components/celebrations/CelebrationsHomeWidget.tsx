// Birthdays & Milestones — Home widget
//
// Three states (in order of priority):
//   1. Today's celebration  → a single Today card with a "Post a toast" CTA
//   2. Upcoming celebrations → next 3 with date + member, "View all" CTA
//   3. Empty                 → "Add a celebration" prompt (member/admin-aware)
//
// Renders nothing if the plugin is not installed AND show_on_home is off —
// the parent (DashboardPage) gates this on `isInstalled('birthdays-milestones')`.

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Cake, Sparkles, PartyPopper, ChevronRight, Plus, CalendarHeart } from 'lucide-react';
import { useState } from 'react';
import {
  useUpcomingCelebrations, useTodayCelebrations, type UpcomingCelebration,
} from '@/hooks/useCelebrations';
import { AddBirthdayModal } from './AddBirthdayModal';

const CELEBRATION_ACCENT = '14 90% 60%'; // warm coral — celebratory but not garish

interface Props {
  /** Whether the widget should render at all (driven by settings.show_on_home). */
  enabled: boolean;
}

export function CelebrationsHomeWidget({ enabled }: Props) {
  const { today, loading: todayLoading } = useTodayCelebrations();
  const { upcoming, loading: upcomingLoading } = useUpcomingCelebrations(4);
  const [addOpen, setAddOpen] = useState(false);

  if (!enabled) return null;
  if (todayLoading || upcomingLoading) return null;

  // Today wins
  if (today.length > 0) {
    return (
      <>
        <TodayCard celebrations={today} />
        <AddBirthdayModal open={addOpen} onClose={() => setAddOpen(false)} accent={CELEBRATION_ACCENT} />
      </>
    );
  }

  // Otherwise upcoming
  // Filter today out of "upcoming" since we promote it above. Cap at 3.
  const upcomingFiltered = upcoming.filter(c => c.daysAway > 0).slice(0, 3);
  if (upcomingFiltered.length > 0) {
    return (
      <>
        <UpcomingCard celebrations={upcomingFiltered} />
        <AddBirthdayModal open={addOpen} onClose={() => setAddOpen(false)} accent={CELEBRATION_ACCENT} />
      </>
    );
  }

  // Empty state
  return (
    <>
      <EmptyCard onAddBirthday={() => setAddOpen(true)} />
      <AddBirthdayModal open={addOpen} onClose={() => setAddOpen(false)} accent={CELEBRATION_ACCENT} />
    </>
  );
}

/* ─── Today card ────────────────────────────────────────────────── */

function TodayCard({ celebrations }: { celebrations: UpcomingCelebration[] }) {
  // If multiple celebrations today, pick the first as primary and surface
  // the count in a chip. Tapping into Celebrations shows the rest.
  const primary = celebrations[0];
  const more = celebrations.length - 1;
  const isBirthday = primary.kind === 'birthday';
  const accent = CELEBRATION_ACCENT;

  const subline = isBirthday
    ? `Wish ${primary.title} a happy birthday!`
    : `Toast — ${primary.title}`;

  // Pre-fill a Connect post (Posts composer accepts ?title= and ?body= params).
  const composerHref = (() => {
    const title = isBirthday
      ? `Happy birthday, ${primary.title}!`
      : `Celebrating: ${primary.title}`;
    const body = isBirthday
      ? `Wishing ${primary.title} an amazing day from the whole club. 🎉`
      : primary.subline ?? '';
    const params = new URLSearchParams({ title, body });
    return `/posts/create?${params.toString()}`;
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl mb-4"
      style={{
        background:
          `radial-gradient(ellipse 100% 75% at 100% 0%, hsl(${accent} / 0.22), transparent 70%),` +
          'linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.92))',
        border: `1px solid hsl(${accent} / 0.42)`,
        boxShadow: `0 0 22px -8px hsl(${accent} / 0.5)`,
      }}
    >
      {/* Confetti dots — subtle */}
      <ConfettiOverlay accent={accent} />

      <div className="relative p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <PartyPopper className="w-3.5 h-3.5 flex-shrink-0" style={{ color: `hsl(${accent})` }} />
          <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em]" style={{ color: `hsl(${accent})` }}>
            {isBirthday ? "Today's Birthday" : "Today's Milestone"}
            {more > 0 && ` + ${more} more`}
          </p>
        </div>
        <h3 className="text-[17px] font-extrabold tracking-tight leading-tight">{subline}</h3>
        {primary.subline && !isBirthday && (
          <p className="text-[11.5px] text-muted-foreground/85 leading-snug mt-1">{primary.subline}</p>
        )}

        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <Link
            to={composerHref}
            className="h-10 rounded-xl text-[12px] font-extrabold flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
            style={{
              background: `linear-gradient(135deg, hsl(${accent}), hsl(${accent} / 0.85))`,
              color: 'hsl(218 50% 6%)',
              boxShadow: `0 4px 14px -4px hsl(${accent} / 0.5)`,
            }}
          >
            {isBirthday ? 'Wish them' : 'Post a Toast'} <ChevronRight className="w-3.5 h-3.5" strokeWidth={3} />
          </Link>
          <Link
            to="/celebrations"
            className="h-10 px-3 rounded-xl text-[11px] font-bold flex items-center gap-1 active:scale-[0.98] transition"
            style={{
              background: 'hsl(var(--muted) / 0.4)',
              border: '1px solid hsl(var(--border) / 0.4)',
              color: 'hsl(var(--foreground) / 0.8)',
            }}
            aria-label="Open Celebrations"
          >
            All
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Upcoming card ─────────────────────────────────────────────── */

function UpcomingCard({ celebrations }: { celebrations: UpcomingCelebration[] }) {
  const accent = CELEBRATION_ACCENT;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl mb-4"
      style={{
        background: 'linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.92))',
        border: `1px solid hsl(${accent} / 0.28)`,
      }}
    >
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/15">
        <div className="flex items-center gap-1.5">
          <CalendarHeart className="w-3 h-3 flex-shrink-0" style={{ color: `hsl(${accent})` }} />
          <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em]" style={{ color: `hsl(${accent})` }}>
            Upcoming Celebrations
          </p>
        </div>
        <Link
          to="/celebrations"
          className="text-[9.5px] font-bold inline-flex items-center gap-0.5 text-muted-foreground/65 hover:text-foreground transition-colors"
        >
          View all <ChevronRight className="w-2.5 h-2.5" />
        </Link>
      </div>
      <ul>
        {celebrations.map((c, idx) => (
          <li
            key={`${c.kind}-${c.id}`}
            className="flex items-center gap-2.5 px-3.5 py-2.5"
            style={idx > 0 ? { borderTop: '1px solid hsl(var(--border) / 0.12)' } : undefined}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, hsl(${accent} / 0.20), hsl(${accent} / 0.04))`,
                border: `1px solid hsl(${accent} / 0.28)`,
                color: `hsl(${accent})`,
              }}
            >
              {c.kind === 'birthday' ? <Cake className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-extrabold leading-tight truncate">{c.title}</p>
              <p className="text-[10.5px] text-muted-foreground/70 leading-snug truncate">
                {c.kind === 'birthday' ? 'Birthday · ' : 'Milestone · '}
                {c.subline}
              </p>
            </div>
            <span
              className="text-[10px] font-extrabold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-md flex-shrink-0"
              style={{
                background: c.daysAway <= 7 ? `hsl(${accent} / 0.16)` : 'hsl(var(--muted) / 0.45)',
                color: c.daysAway <= 7 ? `hsl(${accent})` : 'hsl(var(--muted-foreground))',
                border: c.daysAway <= 7 ? `1px solid hsl(${accent} / 0.32)` : '1px solid hsl(var(--border) / 0.3)',
              }}
            >
              {c.daysAway === 1 ? 'Tomorrow' : c.daysAway <= 7 ? `${c.daysAway}d` : c.subline}
            </span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

/* ─── Empty card ────────────────────────────────────────────────── */

function EmptyCard({ onAddBirthday }: { onAddBirthday: () => void }) {
  const accent = CELEBRATION_ACCENT;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl p-3.5 mb-4"
      style={{
        background:
          `radial-gradient(ellipse 80% 60% at 100% 0%, hsl(${accent} / 0.14), transparent 70%),` +
          'linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.92))',
        border: `1px dashed hsl(${accent} / 0.45)`,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, hsl(${accent} / 0.22), hsl(${accent} / 0.06))`,
            border: `1px solid hsl(${accent} / 0.32)`,
            color: `hsl(${accent})`,
          }}
        >
          <PartyPopper className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em]" style={{ color: `hsl(${accent})` }}>
            Celebrations
          </p>
          <p className="text-[13px] font-extrabold tracking-tight leading-tight mt-0.5">No celebrations yet</p>
          <p className="text-[11px] text-muted-foreground/75 leading-snug mt-0.5">
            Add birthdays and milestones so your club never misses a moment.
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onAddBirthday}
          className="h-10 rounded-xl text-[12px] font-extrabold flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
          style={{
            background: `linear-gradient(135deg, hsl(${accent}), hsl(${accent} / 0.85))`,
            color: 'hsl(218 50% 6%)',
            boxShadow: `0 4px 14px -4px hsl(${accent} / 0.5)`,
          }}
        >
          <Cake className="w-3.5 h-3.5" /> Add Birthday
        </button>
        <Link
          to="/celebrations"
          className="h-10 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1 active:scale-[0.98] transition"
          style={{
            background: 'hsl(var(--muted) / 0.4)',
            border: '1px solid hsl(var(--border) / 0.4)',
            color: 'hsl(var(--foreground) / 0.75)',
          }}
        >
          <Plus className="w-3.5 h-3.5" /> More
        </Link>
      </div>
    </motion.div>
  );
}

/* ─── Confetti overlay ───────────────────────────────────────── */

function ConfettiOverlay({ accent }: { accent: string }) {
  // Five soft dots in the upper-right, subtle drift on hover via CSS only.
  // Keeps the celebratory feel without being childish.
  const dots = [
    { x: 78, y: 10, size: 4, hue: accent },
    { x: 88, y: 18, size: 5, hue: '45 95% 60%' },
    { x: 70, y: 22, size: 3, hue: accent },
    { x: 92, y: 32, size: 4, hue: '152 70% 55%' },
    { x: 82, y: 38, size: 3, hue: accent },
  ];
  return (
    <svg
      aria-hidden
      className="absolute inset-0 w-full h-full pointer-events-none opacity-70"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={d.size / 5}
          fill={`hsl(${d.hue})`}
          opacity={0.65}
        >
          <animate attributeName="opacity" values="0.4;0.85;0.4" dur={`${3 + i * 0.4}s`} repeatCount="indefinite" begin={`${i * 0.3}s`} />
        </circle>
      ))}
    </svg>
  );
}
