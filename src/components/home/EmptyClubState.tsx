// DH Club Home — Empty / fresh-club state
//
// Shown when a club has nothing meaningful surfaced on Home: no installed
// game-class assets, no active competitions, no events, no recent activity.
// Two flavors: admin gets an actionable "build out your club" prompt;
// member gets a friendly "your club is just getting started" message that
// points to the asset catalog (read-only) or a chat surface.

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ChevronRight, Library, MessageSquareText } from 'lucide-react';
import dhMonogram from '@/assets/dh-monogram.png';

interface Props {
  isAdmin: boolean;
  /** Club accent (HSL parts) for theming. */
  accent: string;
  clubName?: string;
}

export function EmptyClubState({ isAdmin, accent, clubName }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-5"
    >
      {/* Calm shell card — accent earns its place in the primary CTA + a
          top hairline + the eyebrow, instead of painting the whole card
          in the club color like before. */}
      <div className="relative overflow-hidden rounded-2xl p-5 text-center bg-card border border-border/40">
        {/* Whisper of club identity at the top edge. */}
        <span
          aria-hidden
          className="absolute inset-x-6 top-0 h-px pointer-events-none"
          style={{ background: `linear-gradient(90deg, transparent, hsl(${accent} / 0.5), transparent)` }}
        />
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
          style={{
            background: `linear-gradient(135deg, hsl(${accent} / 0.20), hsl(${accent} / 0.06))`,
          }}
        >
          <img src={dhMonogram} alt="" className="w-7 h-7 object-contain" style={{ filter: `drop-shadow(0 1px 3px hsl(${accent} / 0.4))` }} />
        </div>
        {/* Eyebrow uses the same type spec as SectionHeader so it visually
            belongs to the same family. Centered version (the shared
            component is justify-between for row layouts). */}
        <p
          className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] mb-1"
          style={{ color: `hsl(${accent})` }}
        >
          {isAdmin ? 'New Club · Set It Up' : 'New Club · Welcome'}
        </p>
        <h2 className="text-base font-extrabold tracking-tight mt-1">
          {clubName ? `${clubName} is just getting started` : 'Your club is just getting started'}
        </h2>
        <p className="text-[11px] text-muted-foreground/85 leading-snug mt-1.5 max-w-[260px] mx-auto">
          {isAdmin
            ? 'Pick games and activities from the Asset Library to bring this club to life.'
            : 'Your admin hasn\'t enabled any games or activities yet — check back soon.'}
        </p>

        <div className="mt-4 flex flex-col gap-2 max-w-[260px] mx-auto">
          {isAdmin ? (
            <Link
              to="/club/assets"
              className="inline-flex items-center justify-center gap-2 h-10 rounded-xl text-[12px] font-extrabold tracking-wide active:scale-[0.98] transition"
              style={{
                background: `linear-gradient(135deg, hsl(${accent}), hsl(${accent} / 0.85))`,
                color: 'hsl(218 50% 6%)',
                boxShadow: `0 4px 14px -4px hsl(${accent} / 0.5)`,
              }}
            >
              <Library className="w-4 h-4" /> Open Asset Library <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <Link
              to="/club/assets"
              className="inline-flex items-center justify-center gap-2 h-10 rounded-xl text-[12px] font-bold active:scale-[0.98] transition"
              style={{
                background: 'hsl(var(--muted) / 0.4)',
                border: `1px solid hsl(${accent} / 0.28)`,
                color: `hsl(${accent})`,
              }}
            >
              <Sparkles className="w-4 h-4" /> Browse Catalog
            </Link>
          )}
          <Link
            to="/chat"
            className="inline-flex items-center justify-center gap-2 h-9 rounded-xl text-[11px] font-bold active:scale-[0.98] transition text-muted-foreground/85 hover:text-foreground"
            style={{ background: 'hsl(var(--muted) / 0.25)', border: '1px solid hsl(var(--border) / 0.4)' }}
          >
            <MessageSquareText className="w-3.5 h-3.5" /> Open Club Chat
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
