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
  Bookmark, Sparkles, Shield, Target, TrendingUp, Lock, Trophy,
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
          className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center active:scale-95 transition"
          style={{
            background: `hsl(${accent} / 0.10)`,
            border: `1.5px dashed hsl(${accent} / 0.4)`,
            color: `hsl(${accent})`,
          }}
        >
          <Pencil className="w-3.5 h-3.5" strokeWidth={2.4} />
        </button>
      </div>
    </motion.div>
  );
}

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
        className="relative h-12 rounded-2xl flex items-center justify-center overflow-hidden"
        style={{
          background: `radial-gradient(ellipse 70% 80% at 50% 0%, hsl(${tint} / 0.18), transparent 70%), linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.92))`,
          border: `1px solid hsl(${tint} / 0.32)`,
          boxShadow: `0 0 12px -8px hsl(${tint} / 0.5)`,
        }}
      >
        {meta?.emblem ? (
          <img
            src={meta.emblem}
            alt=""
            aria-hidden="true"
            className="w-7 h-7 object-contain"
            style={{ filter: `drop-shadow(0 1.5px 4px hsl(${tint} / 0.55))` }}
          />
        ) : Icon ? (
          <Icon className="w-5 h-5" style={{ color: `hsl(${tint})` }} strokeWidth={2.2} />
        ) : (
          <Bookmark className="w-5 h-5 text-muted-foreground" />
        )}
      </div>
    </Link>
  );
}
