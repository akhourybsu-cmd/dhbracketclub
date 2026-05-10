// DH Club Home — Installed Assets launcher
//
// Horizontal swipe carousel of the assets the club has actually installed.
// Each tile shows the asset's emblem (or fallback icon), name, and a live
// one-line status chip ("Your turn", "5 picks", "Wave 24"). The carousel
// only shows what the club has installed — so two clubs with different
// loadouts get visibly different home screens.
//
// Mobile-first: swipeable, large tap targets, no horizontal scrollbar
// chrome, tile width sized for thumb reach. Desktop falls back to a
// flex-wrap grid via the same JSX (the carousel container becomes a row of
// tiles on wider viewports).

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bookmark, Sparkles, Shield, Target, TrendingUp, Lock, Trophy, MessageSquareText,
  CalendarDays, ScrollText, Newspaper, MessageCircle, BarChart3, FileText, Link2,
  Plus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { InstalledAsset } from '@/types/assets';
import { useAssetStatuses, type AssetStatus, type AssetStatusTone } from './useAssetStatuses';
import draftEmblem from '@/assets/draft-emblem.png';
import runedelveEmblem from '@/assets/runedelve-emblem.png';
import nexusEmblem from '@/assets/nexus-emblem.png';
import pickemEmblem from '@/assets/pickem-emblem.png';

interface Props {
  installedAssets: InstalledAsset[];
  /** Whether the current user can install/manage assets — drives the trailing "+ Add" tile. */
  canManage: boolean;
  /** Club accent (HSL parts, e.g. "152 72% 46%") for tile theming fallback. */
  accent: string;
}

interface TileMeta {
  to: string;
  emblem?: string;
  icon?: LucideIcon;
  /** Per-tile glow tint; falls back to the club accent if not set. */
  tint?: string;
}

const ASSET_META: Record<string, TileMeta> = {
  'draft-arena':    { to: '/drafts',          emblem: draftEmblem,    tint: '45 95% 55%' },
  'rune-delve':     { to: '/rune-delve',      emblem: runedelveEmblem, tint: '152 70% 55%' },
  'nexus-defense':  { to: '/nexus',           emblem: nexusEmblem,    tint: '195 90% 60%' },
  'nfl-pickem':     { to: '/pickem',          emblem: pickemEmblem,   tint: '0 80% 60%' },
  'portfolio-wars': { to: '/portfolio-wars',  icon: TrendingUp,       tint: '152 80% 55%' },
  'brackets':       { to: '/brackets',        icon: Trophy,           tint: '210 80% 60%' },
  'lockbox':        { to: '/lockbox',         icon: Lock,             tint: '0 80% 60%' },
  'chat':           { to: '/chat',            icon: MessageSquareText, tint: '195 80% 65%' },
  'events':         { to: '/events',          icon: CalendarDays,     tint: '38 100% 60%' },
  'lore':           { to: '/lore',            icon: ScrollText,       tint: '270 70% 65%' },
  'feed':           { to: '/feed',            icon: Newspaper,        tint: '195 80% 65%' },
  'polls':          { to: '/polls',           icon: MessageCircle,    tint: '38 95% 60%' },
  'rankings':       { to: '/rankings',        icon: BarChart3,        tint: '195 80% 60%' },
  'posts':          { to: '/posts',           icon: FileText,         tint: '195 80% 65%' },
  'shared-media':   { to: '/shared',          icon: Link2,            tint: '195 80% 65%' },
};

const TONE_HSL: Record<AssetStatusTone, string> = {
  urgent: '45 100% 60%',  // gold — needs your attention
  live:   '150 80% 60%',  // green pulse — something is happening
  info:   '195 80% 65%',  // soft blue — informational
  idle:   '0 0% 100% / 0.45',
};

export function AssetLauncher({ installedAssets, canManage, accent }: Props) {
  const slugs = installedAssets.map(ia => ia.asset.slug);
  const { statuses } = useAssetStatuses(slugs);

  // Sort tiles by status urgency, then sort_order — ones that need attention float left.
  const ordered = [...installedAssets].sort((a, b) => {
    const sa = statuses[a.asset.slug];
    const sb = statuses[b.asset.slug];
    const w = (s?: AssetStatus | null) => s?.tone === 'urgent' ? 0 : s?.tone === 'live' ? 1 : 2;
    const dw = w(sa) - w(sb);
    if (dw !== 0) return dw;
    return a.sort_order - b.sort_order;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="-mx-4 sm:mx-0 mb-5"
    >
      <div className="flex items-center justify-between mb-2 px-4 sm:px-0">
        <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/65">
          ◆ Your Apps
        </p>
        <p className="text-[9.5px] font-medium text-muted-foreground/55 tabular-nums">
          {ordered.length}
        </p>
      </div>
      <div
        className="flex gap-2 overflow-x-auto px-4 sm:px-0 sm:flex-wrap pb-1"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {ordered.map(ia => (
          <AssetTile
            key={ia.id}
            slug={ia.asset.slug}
            name={ia.asset.name}
            status={statuses[ia.asset.slug] ?? null}
            fallbackAccent={accent}
          />
        ))}
        {canManage && <AddAssetTile />}
      </div>
    </motion.div>
  );
}

function AssetTile({
  slug,
  name,
  status,
  fallbackAccent,
}: {
  slug: string;
  name: string;
  status: AssetStatus | null;
  fallbackAccent: string;
}) {
  const meta = ASSET_META[slug];
  const tint = meta?.tint ?? fallbackAccent;
  const Icon = meta?.icon;

  return (
    <Link
      to={meta?.to ?? '/'}
      className="flex-shrink-0 w-[78px] sm:w-[88px] active:scale-95 transition-transform"
    >
      <div
        className="relative h-[88px] sm:h-[96px] rounded-2xl overflow-hidden flex flex-col items-center justify-center gap-1.5 px-1"
        style={{
          background: `radial-gradient(ellipse 70% 80% at 50% 0%, hsl(${tint} / 0.16), transparent 70%), linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.92))`,
          border: `1px solid hsl(${tint} / 0.28)`,
          boxShadow: `0 0 14px -8px hsl(${tint} / 0.4)`,
        }}
      >
        {/* Urgent ring — pulsing accent for attention-grabbing tiles */}
        {status?.tone === 'urgent' && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              boxShadow: `inset 0 0 0 1.5px hsl(45 100% 60% / 0.55)`,
              animation: 'home-pulse 2.4s ease-in-out infinite',
            }}
          />
        )}
        <style>{`@keyframes home-pulse { 0%,100% { opacity: 0.65; } 50% { opacity: 1; } }`}</style>

        {/* Emblem / icon */}
        {meta?.emblem ? (
          <img
            src={meta.emblem}
            alt=""
            aria-hidden="true"
            className="w-9 h-9 sm:w-10 sm:h-10 object-contain"
            style={{ filter: `drop-shadow(0 2px 6px hsl(${tint} / 0.55))` }}
          />
        ) : Icon ? (
          <div
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, hsl(${tint} / 0.18), hsl(${tint} / 0.04))`,
              border: `1px solid hsl(${tint} / 0.28)`,
              color: `hsl(${tint})`,
            }}
          >
            <Icon className="w-4 h-4" />
          </div>
        ) : (
          <div className="w-9 h-9 rounded-xl bg-muted/30 flex items-center justify-center">
            <Bookmark className="w-4 h-4 text-muted-foreground" />
          </div>
        )}

        {/* Name (1 line) */}
        <p className="text-[9.5px] font-bold leading-tight text-center px-0.5 line-clamp-1 max-w-full">
          {name}
        </p>

        {/* Status chip */}
        {status ? (
          <span
            className="text-[8px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-md leading-none truncate max-w-full"
            style={{
              background: `hsl(${TONE_HSL[status.tone]} / 0.16)`,
              color: `hsl(${TONE_HSL[status.tone]})`,
              border: `1px solid hsl(${TONE_HSL[status.tone]} / 0.32)`,
            }}
          >
            {status.text}
          </span>
        ) : (
          <span className="text-[8px] font-medium text-muted-foreground/40 uppercase tracking-[0.18em]">
            Open
          </span>
        )}
      </div>
    </Link>
  );
}

function AddAssetTile() {
  return (
    <Link
      to="/club/assets"
      className="flex-shrink-0 w-[78px] sm:w-[88px] active:scale-95 transition-transform"
      aria-label="Add club assets"
    >
      <div
        className="relative h-[88px] sm:h-[96px] rounded-2xl flex flex-col items-center justify-center gap-1.5"
        style={{
          background: 'linear-gradient(180deg, hsl(var(--card) / 0.5), hsl(var(--card) / 0.3))',
          border: '1.5px dashed hsl(var(--border) / 0.5)',
        }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground/70">
          <Plus className="w-4 h-4" />
        </div>
        <p className="text-[9.5px] font-bold text-muted-foreground/60 leading-tight text-center">Add</p>
        <span className="text-[8px] uppercase tracking-[0.18em] text-muted-foreground/40">More</span>
      </div>
    </Link>
  );
}
