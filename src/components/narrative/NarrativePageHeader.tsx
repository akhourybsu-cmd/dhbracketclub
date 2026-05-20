// DH Club — Narrative RPG · Mobile section header
//
// Replaces the per-tab subtitle that used to sit inside FlamingoTabs
// (where it clipped at 360px viewport widths). The label + flavor copy
// now lives at the top of each tab's scrollable content area where it
// has room to breathe.
//
// Used by Story / Cast / City / Evidence / Chronicle tabs. The
// component is theme-aware: a Flamingo campaign renders with the neon
// accent colors, a generic campaign with the calm-shell defaults.

import { FLAMINGO } from '@/lib/narrative/flamingoTheme';

interface Props {
  label: string;
  /** One-line clarifying subtitle. Optional. */
  subtitle?: string;
  /** When true, uses the Flamingo neon tokens. */
  flamingo?: boolean;
  /** Optional trailing slot — e.g. a count chip or action button. */
  trailing?: React.ReactNode;
}

export function NarrativePageHeader({ label, subtitle, flamingo, trailing }: Props) {
  return (
    <div className="px-4 pt-3 pb-2 flex items-end justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h2
          className="font-display text-[18px] sm:text-[20px] font-extrabold tracking-tight leading-tight"
          style={flamingo ? {
            backgroundImage: `linear-gradient(90deg, hsl(${FLAMINGO.paper}), hsl(${FLAMINGO.pink}))`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
          } : undefined}
        >
          {label}
        </h2>
        {subtitle && (
          <p
            className="text-[11px] sm:text-[11.5px] leading-snug mt-0.5"
            style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.7)` : 'hsl(var(--muted-foreground) / 0.8)' }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {trailing && <div className="flex-shrink-0">{trailing}</div>}
    </div>
  );
}
