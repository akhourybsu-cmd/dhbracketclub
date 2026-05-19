// DH Club — Narrative RPG · Flamingo-themed status pill
//
// A neon variant of the campaign status pill used by FlamingoCampaignHeader
// and the Flamingo-themed list card. Renders an optional pulsing dot for
// live/pending statuses and falls back to a neutral chip for unknown
// states.

import type { CampaignStatus } from '@/lib/narrative/types';
import type { ComputedStatus } from '@/lib/narrative/campaignStatus';
import { FLAMINGO, FLAMINGO_PILL_PALETTE, FLAMINGO_COPY } from '@/lib/narrative/flamingoTheme';

type StatusInput = CampaignStatus | 'live' | ComputedStatus;

interface Props {
  status: StatusInput;
  size?: 'xs' | 'sm';
  withPulse?: boolean;
}

const MAP: Record<string, { label: string; palette: keyof typeof FLAMINGO_PILL_PALETTE; dot: boolean }> = {
  live:               { label: FLAMINGO_COPY.liveLabel,       palette: 'live',    dot: true },
  active:             { label: 'Active',                       palette: 'success', dot: true },
  paused:             { label: 'Paused',                       palette: 'neutral', dot: false },
  pending_approval:   { label: 'Pending Approval',             palette: 'pending', dot: true },
  needs_changes:      { label: 'Needs Changes',                palette: 'waiting', dot: false },
  rejected:           { label: 'Rejected',                     palette: 'danger',  dot: false },
  completed:          { label: 'Completed',                    palette: 'neutral', dot: false },
  archived:           { label: 'Archived',                     palette: 'neutral', dot: false },
  draft:              { label: 'Draft',                        palette: 'neutral', dot: false },
  waiting_on_gm:      { label: FLAMINGO_COPY.waitingGm,        palette: 'waiting', dot: true },
  waiting_on_players: { label: FLAMINGO_COPY.waitingPlayers,   palette: 'waiting', dot: true },
};

export function FlamingoStatusPill({ status, size = 'xs', withPulse }: Props) {
  const meta = MAP[status];
  if (!meta) return null;
  const p = FLAMINGO_PILL_PALETTE[meta.palette];
  const px = size === 'xs' ? 6 : 8;
  const fontSize = size === 'xs' ? 9 : 10;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full font-extrabold uppercase tracking-[0.18em]"
      style={{
        padding: `2px ${px}px`,
        fontSize,
        background: `hsl(${p.bg} / 0.22)`,
        color: `hsl(${p.fg})`,
        border: `1px solid hsl(${p.bg} / 0.55)`,
        boxShadow: `0 0 10px -2px hsl(${p.bg} / 0.5)`,
        // pill text needs the brighter pill color, not the foreground from the chip bg.
        // For darker fg (live/waiting/success/danger) we lift it to the dot color so
        // the label still reads neon-ish on the alpha-mixed background.
      }}
    >
      {meta.dot && (
        <span
          aria-hidden
          className={`w-1.5 h-1.5 rounded-full ${withPulse ? 'motion-safe:animate-pulse' : ''}`}
          style={{
            background: `hsl(${p.dot})`,
            boxShadow: `0 0 8px hsl(${p.dot})`,
          }}
        />
      )}
      <span style={{ color: `hsl(${p.dot})` }}>{meta.label}</span>
    </span>
  );
}

/** Tiny brand badge that always reads "Flamingo Protocol" in pink neon. */
export function FlamingoBrandBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-[2px] text-[9px] font-extrabold uppercase tracking-[0.22em]"
      style={{
        background: `linear-gradient(135deg, hsl(${FLAMINGO.pink} / 0.18), hsl(${FLAMINGO.cyan} / 0.12))`,
        color: `hsl(${FLAMINGO.pink})`,
        border: `1px solid hsl(${FLAMINGO.pink} / 0.5)`,
        boxShadow: `0 0 8px hsl(${FLAMINGO.pink} / 0.4)`,
      }}
    >
      <span
        aria-hidden
        className="w-1 h-1 rounded-full"
        style={{ background: `hsl(${FLAMINGO.pink})`, boxShadow: `0 0 4px hsl(${FLAMINGO.pink})` }}
      />
      {FLAMINGO_COPY.brandBadge}
    </span>
  );
}
