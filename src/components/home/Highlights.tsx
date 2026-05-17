// DH Club Home — Highlights carousel
//
// Surfaces a small set of recent "wins" from across the club's installed
// apps so Home doesn't feel empty when nothing urgent is happening. Each
// highlight is a tappable card with an emblem, a one-liner, and a soft
// glow tint. Cards come from any installed signal source we can read
// cheaply.
//
// Sources (any can be present):
//   • Most recent completed draft + winner (draft-arena)
//   • Latest activity_feed event of high-signal type (any club with feed)
//   • Most recent operation completion (nexus-defense)
//
// The component itself doesn't fetch — the dashboard hands it pre-resolved
// HighlightItem rows. If none, it renders nothing.

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Trophy, Newspaper } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SectionHeader } from './SectionHeader';

export type HighlightKind = 'draft-winner' | 'op-complete' | 'feed-event';

export interface HighlightItem {
  id: string;
  kind: HighlightKind;
  /** Section eyebrow (e.g. "DRAFT WINNER", "CO-OP COMPLETE"). */
  tag: string;
  /** Headline — main bold line. */
  headline: string;
  /** Optional sub-line (e.g. timestamp or topic). */
  sub?: string;
  /** Route to navigate to. */
  to: string;
  /** ISO timestamp used for ordering. */
  at: string;
  /** Tint (HSL parts) for the card glow. */
  tint: string;
}

const ICONS: Record<HighlightKind, LucideIcon> = {
  'draft-winner': Trophy,
  'op-complete':  Sparkles,
  'feed-event':   Newspaper,
};

interface Props {
  items: HighlightItem[];
}

export function Highlights({ items }: Props) {
  if (items.length === 0) return null;
  // Newest first; cap at 6.
  const cards = items
    .slice()
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 6);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="-mx-4 sm:mx-0 mb-5"
    >
      <SectionHeader
        label="Highlights"
        icon={Sparkles}
        count={cards.length}
        className="mb-2 px-4 sm:px-0"
      />
      <div
        className="flex gap-2 overflow-x-auto px-4 sm:px-0 pb-1"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {cards.map(card => <HighlightCard key={card.id} item={card} />)}
      </div>
    </motion.section>
  );
}

function HighlightCard({ item }: { item: HighlightItem }) {
  const Icon = ICONS[item.kind];
  const accent = `hsl(${item.tint})`;
  return (
    <Link
      to={item.to}
      className="flex-shrink-0 w-[200px] active:scale-[0.99] transition-transform"
    >
      <div
        className="relative h-[88px] rounded-2xl p-3 flex items-start gap-2.5 overflow-hidden bg-card border border-border/40"
        style={{
          boxShadow: 'inset 0 1px 0 hsl(var(--foreground) / 0.04)',
        }}
      >
        {/* Whisper of app color at the top-right corner — passive sections
            shouldn't paint the whole tile in accent. */}
        <span
          aria-hidden
          className="absolute -top-px right-3 left-3 h-px pointer-events-none"
          style={{ background: `linear-gradient(90deg, transparent 30%, ${accent.replace(')', ' / 0.45)')}, transparent)` }}
        />
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 relative"
          style={{
            background: `linear-gradient(135deg, ${accent.replace(')', ' / 0.16)')}, ${accent.replace(')', ' / 0.04)')})`,
            color: accent,
          }}
        >
          <Icon className="w-4 h-4" strokeWidth={2.4} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="text-[8.5px] font-extrabold uppercase tracking-[0.22em] truncate"
            style={{ color: accent }}
          >
            {item.tag}
          </p>
          <p className="text-[12px] font-extrabold tracking-tight leading-tight mt-0.5 line-clamp-2">
            {item.headline}
          </p>
          {item.sub && (
            <p className="text-[10px] text-muted-foreground/65 truncate mt-0.5">{item.sub}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
