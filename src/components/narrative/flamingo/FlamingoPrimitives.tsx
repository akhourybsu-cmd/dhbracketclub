// DH Club — Narrative RPG · Flamingo expressive primitives
//
// These replace the "pill with text everywhere" pattern with iconic /
// shape-driven indicators that convey the same info more quickly on
// mobile.
//
//   • FlamingoMeter      — segmented 0..max bar for heat/relationship
//                          scores. The label sits ABOVE the segments;
//                          the bar itself reads the magnitude at a glance.
//   • FlamingoClueMarker — left-rule + status icon for the four clue
//                          states. No status text needed — the shape
//                          and color carry the meaning.
//   • FlamingoLiveRibbon — slim animated pink/cyan top-edge rule used
//                          to communicate "live now" without a pill.
//   • FlamingoLockIcon   — single amber padlock chip; replaces the
//                          "GM ONLY" text pill anywhere it appeared.
//   • FlamingoCount      — small glowing numeric chip for counts; no
//                          word, just the count and an icon.

import { Check, X, CircleDashed, HelpCircle, Lock, type LucideIcon } from 'lucide-react';
import { FLAMINGO } from '@/lib/narrative/flamingoTheme';
import type { Clue } from '@/lib/narrative/types';

// ──────────────────────────────────────────────────────────────────────
// FlamingoMeter — segmented bar
// ──────────────────────────────────────────────────────────────────────

interface MeterProps {
  /** Current value. Will be clamped to [0, max]. */
  value: number;
  /** Maximum value (default 10). */
  max?: number;
  /** Short label rendered above the bar in uppercase tracking. */
  label: string;
  /** Optional accent override; defaults to a heat-style pink→cyan ramp. */
  accent?: 'heat' | 'cool' | 'neutral';
  /** Optional inverse hint — when true, label/value reads as "low is bad"
   *  (used for relationship scores, where higher = friendlier). */
  inverse?: boolean;
}

export function FlamingoMeter({ value, max = 10, label, accent = 'heat', inverse }: MeterProps) {
  const segs = Math.max(5, Math.min(max, 10)); // never fewer than 5 segments
  const clamped = Math.max(0, Math.min(max, value));
  const filled = Math.round((clamped / max) * segs);
  // Heat: cyan → pink as value rises. Cool: cyan only. Neutral: paper.
  const segColor = (i: number, on: boolean) => {
    if (!on) return `hsl(${FLAMINGO.paper} / 0.12)`;
    if (accent === 'cool') return `hsl(${FLAMINGO.cyan})`;
    if (accent === 'neutral') return `hsl(${FLAMINGO.paper} / 0.8)`;
    // heat ramp
    const t = i / (segs - 1);
    return t < 0.4
      ? `hsl(${FLAMINGO.cyan})`
      : t < 0.7
        ? `hsl(${FLAMINGO.gold})`
        : `hsl(${FLAMINGO.pink})`;
  };
  // Final-segment color is also the label/value tint.
  const dominantColor = filled === 0
    ? `hsl(${FLAMINGO.paper} / 0.5)`
    : segColor(filled - 1, true);

  return (
    <div className="flex items-center gap-2">
      <p
        className="text-[9px] font-extrabold uppercase tracking-[0.22em] flex-shrink-0"
        style={{ color: dominantColor }}
      >
        {label}
      </p>
      <div className="flex gap-[2px] flex-1 min-w-0">
        {Array.from({ length: segs }).map((_, i) => {
          const on = inverse ? i >= segs - filled : i < filled;
          return (
            <span
              key={i}
              className="h-2 flex-1 rounded-[2px]"
              style={{
                background: segColor(i, on),
                boxShadow: on ? `0 0 4px ${segColor(i, true)}` : 'none',
              }}
            />
          );
        })}
      </div>
      <p
        className="text-[10px] font-extrabold tabular-nums flex-shrink-0"
        style={{ color: dominantColor }}
      >
        {clamped}<span style={{ color: `hsl(${FLAMINGO.paper} / 0.35)` }}>/{max}</span>
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// FlamingoClueMarker — accent rule + iconic status
// ──────────────────────────────────────────────────────────────────────

const CLUE_STATUS_META: Record<Clue['status'], { Icon: LucideIcon; accent: string; tooltip: string }> = {
  discovered: { Icon: HelpCircle,   accent: FLAMINGO.clue,    tooltip: 'Discovered — chasing it down' },
  partial:    { Icon: CircleDashed, accent: FLAMINGO.gold,    tooltip: 'Partial lead — needs more digging' },
  solved:     { Icon: Check,        accent: FLAMINGO.cyan,    tooltip: 'Solved' },
  false_lead: { Icon: X,            accent: FLAMINGO.danger,  tooltip: 'False lead' },
};

interface ClueMarkerProps {
  status: Clue['status'];
  size?: 'sm' | 'md';
}

/** Round icon-only chip — usable inline alongside a clue title. */
export function FlamingoClueMarker({ status, size = 'sm' }: ClueMarkerProps) {
  const meta = CLUE_STATUS_META[status];
  const Icon = meta.Icon;
  const dim = size === 'sm' ? 18 : 22;
  return (
    <span
      role="img"
      aria-label={meta.tooltip}
      title={meta.tooltip}
      className="inline-flex items-center justify-center rounded-full flex-shrink-0"
      style={{
        width: dim,
        height: dim,
        background: `hsl(${meta.accent} / 0.18)`,
        border: `1px solid hsl(${meta.accent} / 0.55)`,
        boxShadow: `0 0 8px -2px hsl(${meta.accent} / 0.6)`,
        color: `hsl(${meta.accent})`,
      }}
    >
      <Icon className="w-3 h-3" strokeWidth={3} />
    </span>
  );
}

/** Returns the accent color for a clue status — useful for callers that
 *  want to drive a left-rule or border independently of the marker. */
export function clueAccent(status: Clue['status']): string {
  return CLUE_STATUS_META[status].accent;
}

// ──────────────────────────────────────────────────────────────────────
// FlamingoLiveRibbon — top-edge shimmer for live sessions
// ──────────────────────────────────────────────────────────────────────

/** A 2px pink/cyan glowing top-edge rule. Mount this absolutely
 *  positioned inside a relative container. Replaces the textual
 *  "Live Now" pill with ambient signal. Respects prefers-reduced-motion. */
export function FlamingoLiveRibbon() {
  return (
    <div
      aria-hidden
      className="absolute inset-x-0 top-0 h-[2px] pointer-events-none motion-safe:animate-pulse"
      style={{
        background: `linear-gradient(90deg, transparent, hsl(${FLAMINGO.pink}), hsl(${FLAMINGO.cyan}), hsl(${FLAMINGO.pink}), transparent)`,
        boxShadow: `0 0 8px hsl(${FLAMINGO.pink} / 0.7)`,
      }}
    />
  );
}

// ──────────────────────────────────────────────────────────────────────
// FlamingoLockIcon — replaces "GM ONLY" text pill
// ──────────────────────────────────────────────────────────────────────

export function FlamingoLockIcon({ size = 14 }: { size?: number }) {
  return (
    <span
      role="img"
      aria-label="GM only"
      title="GM only"
      className="inline-flex items-center justify-center rounded-full flex-shrink-0"
      style={{
        width: size + 6,
        height: size + 6,
        background: `hsl(${FLAMINGO.gmAmber} / 0.18)`,
        border: `1px solid hsl(${FLAMINGO.gmAmber} / 0.55)`,
        color: `hsl(${FLAMINGO.gmAmber})`,
      }}
    >
      <Lock style={{ width: size - 4, height: size - 4 }} strokeWidth={3} />
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────
// FlamingoCount — small glowing numeric chip
// ──────────────────────────────────────────────────────────────────────

interface CountProps {
  count: number;
  icon?: LucideIcon;
  accent?: string;
}

export function FlamingoCount({ count, icon: Icon, accent = FLAMINGO.pink }: CountProps) {
  if (count <= 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 h-5 text-[10px] font-extrabold tabular-nums"
      style={{
        background: `hsl(${accent} / 0.18)`,
        color: `hsl(${accent})`,
        border: `1px solid hsl(${accent} / 0.55)`,
        boxShadow: `0 0 6px -2px hsl(${accent} / 0.6)`,
      }}
    >
      {Icon && <Icon className="w-2.5 h-2.5" />}
      {count > 99 ? '99+' : count}
    </span>
  );
}
