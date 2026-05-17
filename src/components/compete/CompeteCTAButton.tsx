// DH Club — Compete banner CTA button
//
// One shared structure for every "Enter" / "Deploy" / "Make Picks" /
// "Resume" / etc. CTA across the CompetePage app banners. Each banner
// passes its own thematic accent so it stays expressive, but the
// height, radius, typography, icon spacing, glow intensity, and
// press feedback are unified.
//
// Why a component instead of a Tailwind plugin:
//   1. The chevron icon + spacing rules are part of the CTA "shape",
//      so encoding them in a component eliminates copy-paste drift.
//   2. The drop shadow + inset highlight are derived from the accent
//      via a single formula, so future palette nudges don't require
//      hunting through 5+ banner files.
//   3. The `pulse` prop standardizes how a banner says "act now" —
//      one keyframe, reused everywhere.
//
// Usage:
//   <CompeteCTAButton accent="45 95% 55%" accentDeep="40 95% 48%" ink="160 30% 6%">
//     Make Picks
//   </CompeteCTAButton>
//
// Renders as a div by default (because banners typically wrap the whole
// card in a <Link>). Pass `as="button"` if you need a real button element.

import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompeteCTAButtonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Primary accent HSL components (e.g. "45 95% 55%"). Drives the
   *  gradient start, shadow, and inset highlight. */
  accent: string;
  /** Optional gradient end-stop HSL components. Defaults to a slightly
   *  deeper version of `accent` so a single accent prop still produces
   *  a rich gradient. */
  accentDeep?: string;
  /** Ink color HSL components for the button label (defaults to a
   *  near-black charcoal tuned to read on a saturated gold/green/cyan). */
  ink?: string;
  /** Render a subtle pulse animation — reserved for true call-to-action
   *  urgency (e.g. "you're on the clock"). Subtle, not flashing. */
  pulse?: boolean;
  /** Chevron icon goes on the right by default — set false to suppress. */
  showChevron?: boolean;
  children: React.ReactNode;
}

export function CompeteCTAButton({
  accent,
  accentDeep,
  ink = '160 30% 6%',
  pulse = false,
  showChevron = true,
  className,
  children,
  style,
  ...rest
}: CompeteCTAButtonProps) {
  // If the caller didn't pass a deep stop, derive one by darkening the
  // lightness slightly. The accent string is "H S% L%" so we parse and
  // tweak the third number.
  const deep = accentDeep ?? deriveDeep(accent);

  return (
    <div
      role="presentation"
      className={cn(
        'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[11px] font-extrabold uppercase tracking-wider min-h-[36px]',
        // Press feedback — parent <Link> handles tap target; this gives
        // the chip itself a subtle scale on press.
        'active:scale-[0.97] transition-transform',
        pulse && 'compete-cta-pulse',
        className,
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${accent}), hsl(${deep}))`,
        color: `hsl(${ink})`,
        boxShadow: `0 4px 14px hsl(${accent} / 0.5), inset 0 1px 0 hsl(${accent} / 0.55)`,
        ...style,
      }}
      {...rest}
    >
      <span className="truncate">{children}</span>
      {showChevron && <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={3} />}
    </div>
  );
}

/** Parse an HSL components string "H S% L%" and return a slightly
 *  darker variant for the gradient end-stop. Robust to spaces and
 *  unusual whitespace — falls back to the input on any parse failure. */
function deriveDeep(accent: string): string {
  const m = accent.trim().match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!m) return accent;
  const h = m[1];
  const s = m[2];
  const l = Math.max(0, Number(m[3]) - 8); // drop ~8 lightness points
  return `${h} ${s}% ${l}%`;
}
