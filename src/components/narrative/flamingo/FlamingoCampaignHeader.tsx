// DH Club — Narrative RPG · Flamingo Protocol campaign header
//
// Replaces the calm-shell compact header for Flamingo Protocol campaigns
// with a cinematic neon strip: back chevron + brand badge + title with
// pink/cyan gradient text + status pill + optional GM Console button
// with pending-suggestion badge.
//
// Designed to stay compact enough on mobile that it doesn't push the
// Story Chat too far down — the pinned scene card lives below this in
// the page chrome, not inside the header.

import { ChevronLeft, Settings2, Sparkles } from 'lucide-react';
import { FLAMINGO, FLAMINGO_COPY } from '@/lib/narrative/flamingoTheme';
import { FlamingoBrandBadge } from './FlamingoStatusPill';
import { FlamingoLiveRibbon } from './FlamingoPrimitives';
import type { Campaign } from '@/lib/narrative/types';
import type { ComputedStatus } from '@/lib/narrative/campaignStatus';

interface Props {
  campaign: Campaign;
  computedStatus: ComputedStatus | 'live';
  onBack: () => void;
  pendingAiCount?: number;
  canOpenGmConsole?: boolean;
  onOpenGmConsole?: () => void;
  canManageMembers?: boolean;
  onManageMembers?: () => void;
}

export function FlamingoCampaignHeader({
  campaign,
  computedStatus,
  onBack,
  pendingAiCount = 0,
  canOpenGmConsole,
  onOpenGmConsole,
  canManageMembers,
  onManageMembers,
}: Props) {
  // The "Live Now" status is conveyed by the top-edge shimmer ribbon
  // instead of a pill — saves vertical space on mobile and reads
  // ambiently. Waiting-on states still need a textual cue, so we
  // render them under the title.
  const isLive = computedStatus === 'live' || !!campaign.live_session_id;
  const subtitle =
    computedStatus === 'waiting_on_gm' ? FLAMINGO_COPY.waitingGm
    : computedStatus === 'waiting_on_players' ? FLAMINGO_COPY.waitingPlayers
    : null;
  return (
    <div
      className="relative flex-shrink-0 px-3 py-2.5 border-b flex items-center gap-2"
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0px))',
        background: `linear-gradient(180deg, hsl(${FLAMINGO.midnight} / 0.92), hsl(${FLAMINGO.ink} / 0.85))`,
        borderColor: `hsl(${FLAMINGO.pink} / 0.25)`,
        backdropFilter: 'blur(10px)',
      }}
    >
      {isLive && <FlamingoLiveRibbon />}
      <button
        onClick={onBack}
        aria-label="Back to campaigns"
        className="w-9 h-9 rounded-lg flex items-center justify-center active:scale-95 transition"
        style={{
          background: `hsl(${FLAMINGO.ink})`,
          border: `1px solid hsl(${FLAMINGO.pink} / 0.3)`,
          color: `hsl(${FLAMINGO.paper})`,
        }}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <FlamingoBrandBadge />
        </div>
        <h1
          // Allow two-line wrap so long campaign titles ("The Velvetaine
          // Heist & The Tape That Wouldn't Burn") stay readable on
          // 360px viewports. Drops to one-line on desktop where space
          // permits via the slightly tighter line-height + clamp.
          className="font-display text-[15px] sm:text-[16px] font-extrabold tracking-tight leading-[1.15] line-clamp-2"
          style={{
            backgroundImage: `linear-gradient(90deg, hsl(${FLAMINGO.paper}) 0%, hsl(${FLAMINGO.pink}) 60%, hsl(${FLAMINGO.cyan}) 110%)`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
          }}
        >
          {campaign.title}
        </h1>
        {subtitle && (
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.18em] mt-0.5 truncate"
            style={{ color: `hsl(${FLAMINGO.gold})` }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {canManageMembers && onManageMembers && (
        <button
          type="button"
          onClick={onManageMembers}
          aria-label="Manage members"
          className="h-9 w-9 rounded-lg inline-flex items-center justify-center active:scale-95 transition"
          style={{
            background: `hsl(${FLAMINGO.ink})`,
            border: `1px solid hsl(${FLAMINGO.cyan} / 0.4)`,
            color: `hsl(${FLAMINGO.cyan})`,
          }}
        >
          <Settings2 className="w-3.5 h-3.5" />
        </button>
      )}

      {canOpenGmConsole && onOpenGmConsole && (
        <button
          type="button"
          onClick={onOpenGmConsole}
          aria-label={pendingAiCount > 0 ? `Open GM Console — ${pendingAiCount} pending` : FLAMINGO_COPY.gmConsole}
          title={FLAMINGO_COPY.gmConsole}
          className="relative h-9 px-2.5 rounded-lg inline-flex items-center gap-1 active:scale-95 transition text-[10px] font-extrabold uppercase tracking-wider"
          style={{
            background: `linear-gradient(135deg, hsl(${FLAMINGO.gmAmber} / 0.25), hsl(${FLAMINGO.pink} / 0.15))`,
            border: `1px solid hsl(${FLAMINGO.gmAmber} / 0.6)`,
            color: `hsl(${FLAMINGO.gmAmber})`,
            boxShadow: `0 0 10px -2px hsl(${FLAMINGO.gmAmber} / 0.5)`,
          }}
        >
          <Sparkles className="w-3 h-3" /> {FLAMINGO_COPY.gmShort}
          {pendingAiCount > 0 && (
            <span
              aria-hidden
              className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-extrabold tabular-nums inline-flex items-center justify-center"
              style={{
                background: `hsl(${FLAMINGO.pink})`,
                color: `hsl(${FLAMINGO.midnight})`,
                boxShadow: `0 0 6px hsl(${FLAMINGO.pink} / 0.7)`,
              }}
            >
              {pendingAiCount > 9 ? '9+' : pendingAiCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
