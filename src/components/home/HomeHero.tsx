// DH Club Home — Hero strip
//
// Tight, single-line identity strip:  [club logo]  Club name           [you]
// Below it: a compact context line with weekday + a live signal count.
// Replaces the older big-greeting-with-bouncing-emoji block. The accent
// glow is keyed off `club.accent_color` so each club's home looks distinct.

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import dhMonogram from '@/assets/dh-monogram.png';
import type { Club } from '@/contexts/ClubContext';

interface Props {
  club: Club | null;
  displayName: string;
  avatarUrl: string | null;
  /** Number of "Right Now" actions awaiting the user. Drives the inline counter chip. */
  pendingCount: number;
  /** ISO date string used for the contextual weekday line. Defaults to now. */
  now?: Date;
}

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export function HomeHero({ club, displayName, avatarUrl, pendingCount, now = new Date() }: Props) {
  const accent = club?.accent_color ?? '152 72% 46%';
  const weekday = WEEKDAY[now.getDay()];
  const initial = (displayName?.[0] ?? '?').toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative mb-4"
    >
      {/* Soft accent glow keyed to club color */}
      <div
        aria-hidden
        className="absolute -inset-x-6 -top-12 h-32 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 100% at 50% 0%, hsl(${accent} / 0.18), transparent 70%)`,
        }}
      />
      <div className="relative z-10 flex items-center gap-3">
        {/* Club mark */}
        <div
          className="w-10 h-10 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center"
          style={{
            background: club?.logo_url ? 'transparent' : `linear-gradient(135deg, hsl(${accent} / 0.22), hsl(${accent} / 0.06))`,
            border: `1px solid hsl(${accent} / 0.32)`,
            boxShadow: `0 0 14px -4px hsl(${accent} / 0.45)`,
          }}
        >
          {club?.logo_url ? (
            <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover" />
          ) : (
            <img src={dhMonogram} alt={club?.name ?? 'DH'} className="w-7 h-7 object-contain opacity-90" />
          )}
        </div>

        {/* Identity column */}
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] font-extrabold tracking-tight truncate leading-tight">
            {club?.name ?? 'DH Club'}
          </h1>
          <p className="text-[10.5px] font-medium text-muted-foreground/85 truncate leading-snug mt-0.5 flex items-center gap-1.5">
            <span>{weekday}</span>
            <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/40" />
            <span>{displayName ? `Hi, ${displayName.split(' ')[0]}` : 'Welcome'}</span>
            {pendingCount > 0 && (
              <>
                <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/40" />
                <span className="font-bold" style={{ color: `hsl(${accent})` }}>
                  {pendingCount} pending
                </span>
              </>
            )}
          </p>
        </div>

        {/* Profile chip */}
        <Link
          to="/profile"
          className="w-10 h-10 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center text-sm font-extrabold btn-press"
          style={{
            background: avatarUrl ? 'transparent' : `linear-gradient(135deg, hsl(${accent} / 0.18), hsl(${accent} / 0.04))`,
            border: `1px solid hsl(${accent} / 0.25)`,
            color: `hsl(${accent})`,
          }}
          aria-label="Open profile"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            initial
          )}
        </Link>
      </div>
    </motion.div>
  );
}
