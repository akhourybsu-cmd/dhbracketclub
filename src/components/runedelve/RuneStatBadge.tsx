// Rune Delve — small chamber-stat readout
//
// Tiny badge used inside DelveBriefingCard and other surfaces to surface
// chamber metadata in a compact form (entries / runes / hazards / treasure).
// Tone variants tweak the color without changing the structure.

import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  label: string;
  value: number | string;
  /** HSL string used for the chip border + label color. */
  accent: string;
  /** Optional semantic tone — overrides accent for danger / treasure. */
  tone?: 'default' | 'danger' | 'treasure';
}

const TONE_HSL: Record<NonNullable<Props['tone']>, { fg: string; bg: string; border: string }> = {
  default:  { fg: 'inherit',           bg: 'transparent',                   border: 'inherit' },
  danger:   { fg: 'hsl(0 80% 65%)',    bg: 'hsl(0 80% 60% / 0.14)',         border: 'hsl(0 80% 60% / 0.32)' },
  treasure: { fg: 'hsl(45 100% 65%)',  bg: 'hsl(45 100% 60% / 0.14)',       border: 'hsl(45 100% 60% / 0.32)' },
};

export function RuneStatBadge({ icon: Icon, label, value, accent, tone = 'default' }: Props) {
  const t = TONE_HSL[tone];
  const fg = tone === 'default' ? accent : t.fg;
  const bg = tone === 'default' ? `${accent.replace(')', ' / 0.10)')}` : t.bg;
  const border = tone === 'default' ? `${accent.replace(')', ' / 0.28)')}` : t.border;

  return (
    <div
      className="px-2 py-1 rounded-lg flex items-center gap-1.5 min-w-0"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <Icon className="w-3 h-3 flex-shrink-0" style={{ color: fg }} />
      <span
        className="font-rd-display text-[8px] uppercase tracking-[0.18em] truncate"
        style={{ color: fg }}
      >
        {label}
      </span>
      <span
        className="ml-auto text-[11px] font-extrabold tabular-nums leading-none"
        style={{ color: fg }}
      >
        {value}
      </span>
    </div>
  );
}
