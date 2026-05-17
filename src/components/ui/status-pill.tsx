// DH Club — shared StatusPill
//
// One semantic component for every "this thing is X" label across the app:
// "Your Turn", "Live", "Resume", "Picks Open", "Installed", "Disabled", etc.
//
// The codebase previously had ~8 different inline pill recipes — each chose
// its own padding, font size, opacity rules, and color. Visually they all
// looked similar but technically every one was a different snowflake, which
// made the shell feel slightly off across surfaces.
//
// Two axes:
//   1. variant — semantic meaning. Picks token + alpha pair from below.
//   2. accent  — optional app-identity color (HSL parts). If set, overrides
//                the variant's hue but keeps the variant's lightness/alpha
//                rules so the pill still feels like part of the same family.
//
// Design rules baked in:
//   • Variants map to tokens that already adapt in light/dark mode.
//   • App-specific accent stays expressive (e.g. Draft Arena gold), but
//     uses the SAME pill shape as the rest of the system.
//   • A `dot` prop adds a small leading status dot — used for "Live" and
//     "Pending" states to reinforce status with a non-color affordance.
//   • A `pulse` prop animates the dot — reserved for "Live" / "Your Turn".

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export type StatusPillVariant =
  | 'success'   // available, healthy, installed
  | 'warning'   // attention needed, expiring soon
  | 'danger'    // error, blocked
  | 'info'      // informational, neutral status
  | 'neutral'   // passive label, default
  | 'premium'   // gold — premium/draft/achievement
  | 'live'      // actively happening — green pulse
  | 'pending'   // awaiting action — amber pulse
  | 'disabled'; // greyed out

export type StatusPillSize = 'xs' | 'sm';

interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: StatusPillVariant;
  size?: StatusPillSize;
  /** Optional app-identity tint (HSL parts, e.g. "45 95% 55%"). Overrides the
   *  variant's hue but reuses its lightness/alpha rules — so a Draft Arena
   *  gold pill is the same shape and weight as a chat info pill. */
  accent?: string;
  /** Render a 5px leading status dot. */
  dot?: boolean;
  /** Animate the dot (use sparingly — true live/your-turn signals only). */
  pulse?: boolean;
}

/* ── Variant → token mapping.
   Color tokens (--success, --destructive, etc.) already adapt across
   light/dark, so this single table works in both themes. Alpha values were
   tuned to match the existing visual weight in AssetLauncher and chat. */
type VariantTokens = {
  /** Background HSL components (no `hsl()` wrapper). */
  bg: string;
  /** Border HSL components. */
  border: string;
  /** Foreground HSL components. */
  fg: string;
};

const VARIANTS: Record<StatusPillVariant, VariantTokens> = {
  success:  { bg: 'var(--success)',     border: 'var(--success)',     fg: 'var(--success)' },
  warning:  { bg: '38 95% 55%',         border: '38 95% 55%',         fg: '38 95% 65%' },
  danger:   { bg: 'var(--destructive)', border: 'var(--destructive)', fg: 'var(--destructive)' },
  info:     { bg: '195 80% 60%',        border: '195 80% 60%',        fg: '195 80% 70%' },
  neutral:  { bg: 'var(--muted-foreground)', border: 'var(--border)',  fg: 'var(--muted-foreground)' },
  premium:  { bg: 'var(--gold)',        border: 'var(--gold)',        fg: 'var(--gold)' },
  live:     { bg: 'var(--success)',     border: 'var(--success)',     fg: 'var(--success)' },
  pending:  { bg: '45 100% 55%',        border: '45 100% 55%',        fg: '45 100% 65%' },
  disabled: { bg: 'var(--muted)',       border: 'var(--border)',      fg: 'var(--muted-foreground)' },
};

/* Padding + font sizes — small and extra-small. xs is used inside tight
   spaces like the AssetLauncher tile footer; sm for inline chips next to
   titles. */
const SIZE_STYLES: Record<StatusPillSize, string> = {
  xs: 'text-[8px] tracking-[0.12em] px-1.5 py-0.5 leading-none gap-1',
  sm: 'text-[9.5px] tracking-[0.14em] px-2 py-0.5 leading-tight gap-1.5',
};

export const StatusPill = forwardRef<HTMLSpanElement, StatusPillProps>(function StatusPill(
  { variant = 'neutral', size = 'xs', accent, dot, pulse, className, children, style, ...rest },
  ref,
) {
  const tokens = VARIANTS[variant];

  // App-identity accent override: keep the variant's alpha math (so the
  // pill feels like one of the family) but swap the hue to the app's color.
  const bg = accent ? accent : tokens.bg;
  const border = accent ? accent : tokens.border;
  const fg = accent ? accent : tokens.fg;

  return (
    <span
      ref={ref}
      role={variant === 'live' || variant === 'pending' ? 'status' : undefined}
      className={cn(
        'inline-flex items-center font-bold uppercase rounded-md border max-w-full',
        SIZE_STYLES[size],
        // Disabled state strikes through the badge with a muted look
        variant === 'disabled' && 'opacity-65',
        className,
      )}
      style={{
        backgroundColor: `hsl(${bg} / 0.16)`,
        borderColor: `hsl(${border} / 0.32)`,
        color: `hsl(${fg})`,
        ...style,
      }}
      {...rest}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn(
            'inline-block rounded-full flex-shrink-0',
            size === 'xs' ? 'w-1 h-1' : 'w-1.5 h-1.5',
            pulse && 'animate-pulse',
          )}
          style={{
            backgroundColor: `hsl(${fg})`,
            boxShadow: pulse ? `0 0 6px hsl(${fg} / 0.7)` : undefined,
          }}
        />
      )}
      <span className="truncate">{children}</span>
    </span>
  );
});
