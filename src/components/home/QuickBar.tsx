// DH Club Home — QuickBar
//
// Compact "dock" of user-pinned apps at the very top of Home. Distinct from
// the full AssetLauncher: this is the user's personal favorites, smaller
// and icon-focused, for muscle-memory tap targets. The trailing slot is
// always an Edit button that opens the customization sheet.
//
// Layout: 4–6 circle/rounded-square icon tiles in a flex row. Each tile is
// 56px tall, comfortably tappable. Edit button matches tile size for
// alignment.

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bookmark, TrendingUp, Lock, Trophy,
  MessageSquareText, CalendarDays, ScrollText, Newspaper, MessageCircle,
  BarChart3, FileText, Link2, Pencil,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { InstalledAsset } from '@/types/assets';
import draftEmblem from '@/assets/draft-emblem.png';
import runedelveEmblem from '@/assets/runedelve-emblem.png';
import nexusEmblem from '@/assets/nexus-emblem.png';
import pickemEmblem from '@/assets/pickem-emblem.png';

interface TileMeta {
  to: string;
  emblem?: string;
  icon?: LucideIcon;
  tint: string;
}

const META: Record<string, TileMeta> = {
  'draft-arena':    { to: '/drafts',         emblem: draftEmblem,    tint: '45 95% 55%' },
  'rune-delve':     { to: '/rune-delve',     emblem: runedelveEmblem, tint: '152 70% 55%' },
  'nexus-defense':  { to: '/nexus',          emblem: nexusEmblem,    tint: '195 90% 60%' },
  'nfl-pickem':     { to: '/pickem',         emblem: pickemEmblem,   tint: '0 80% 60%' },
  'portfolio-wars': { to: '/portfolio-wars', icon: TrendingUp,       tint: '152 80% 55%' },
  'brackets':       { to: '/brackets',       icon: Trophy,           tint: '210 80% 60%' },
  'lockbox':        { to: '/lockbox',        icon: Lock,             tint: '0 80% 60%' },
  'chat':           { to: '/chat',           icon: MessageSquareText, tint: '195 80% 65%' },
  'events':         { to: '/events',         icon: CalendarDays,     tint: '38 100% 60%' },
  'lore':           { to: '/lore',           icon: ScrollText,       tint: '270 70% 65%' },
  'feed':           { to: '/feed',           icon: Newspaper,        tint: '195 80% 65%' },
  'polls':          { to: '/polls',          icon: MessageCircle,    tint: '38 95% 60%' },
  'rankings':       { to: '/rankings',       icon: BarChart3,        tint: '195 80% 60%' },
  'posts':          { to: '/posts',          icon: FileText,         tint: '195 80% 65%' },
  'shared-media':   { to: '/shared',         icon: Link2,            tint: '195 80% 65%' },
};

interface Props {
  pinned: InstalledAsset[];
  /** Club accent (HSL parts) — used as a fallback tint and for the edit chip. */
  accent: string;
  onEditClick: () => void;
}

export function QuickBar({ pinned, accent, onEditClick }: Props) {
  // Hide entirely when there are no installed assets to pin from. The
  // AssetLauncher's empty case handles the welcome flow.
  if (pinned.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="mb-4"
      aria-label="Pinned apps"
    >
      <div className="flex items-center gap-2">
        {pinned.map(ia => (
          <QuickTile key={ia.id} slug={ia.asset.slug} name={ia.asset.name} fallbackAccent={accent} />
        ))}
        <button
          type="button"
          onClick={onEditClick}
          aria-label="Customize quick bar"
          className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center active:scale-95 transition text-muted-foreground/65 hover:text-foreground/85 bg-muted/20 border border-dashed border-border/45"
        >
          <Pencil className="w-3.5 h-3.5" strokeWidth={2.2} />
        </button>
      </div>
    </motion.div>
  );
}

/**
 * Calm-shell tile: neutral glass surface that matches every other quick-action
 * tile, with the app's accent color reserved for the emblem/icon ONLY. This is
 * the design rule for the DH Club shell — the shell should feel like one
 * platform, with app personality lighting up only the brand mark on the tile.
 */
function QuickTile({ slug, name, fallbackAccent }: { slug: string; name: string; fallbackAccent: string }) {
  const meta = META[slug];
  const tint = meta?.tint ?? fallbackAccent;
  const Icon = meta?.icon;

  return (
    <Link
      to={meta?.to ?? '/'}
      className="flex-1 min-w-0 active:scale-95 transition"
      title={name}
      aria-label={name}
    >
      <div
        className="relative h-12 rounded-2xl flex items-center justify-center overflow-hidden bg-card border border-border/40"
        style={{
          /* Subtle inner highlight at the top — no app color in the surface itself. */
          boxShadow: 'inset 0 1px 0 hsl(var(--foreground) / 0.04)',
        }}
      >
        {/* Whisper-faint accent glow at the bottom edge so the tile still
            hints at its app identity without painting the whole surface. */}
        <span
          aria-hidden
          className="absolute inset-x-3 bottom-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, hsl(${tint} / 0.45), transparent)` }}
        />
        {meta?.emblem ? (
          <img
            src={meta.emblem}
            alt=""
            aria-hidden="true"
            className="w-7 h-7 object-contain relative"
            style={{ filter: `drop-shadow(0 1px 3px hsl(${tint} / 0.45))` }}
          />
        ) : Icon ? (
          <Icon
            className="w-5 h-5 relative"
            style={{ color: `hsl(${tint})` }}
            strokeWidth={2.2}
          />
        ) : (
          <Bookmark className="w-5 h-5 text-muted-foreground" />
        )}
      </div>
    </Link>
  );
}
