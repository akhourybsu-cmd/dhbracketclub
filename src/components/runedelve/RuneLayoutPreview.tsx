// Rune Delve — Chamber Layout Preview
//
// Inline SVG mini-map used on briefing surfaces, the Continue banner, and
// the level map. Designed to feel *distinct from Nexus Defense*: warm
// torchlit stone, cross-hatch rune-rubbing texture (not tactical grid),
// double-stroke glowing rune-sigil paths (halo + inner core, not gradient
// stroke), warm rune-ember entries (amber bloom, not red laser dots), and
// gold rune-star treasures (concentric, not geometric diamonds).
//
// Sizes: sm (40), md (64), lg (112). Optional pulse breathes the sigil.

import type { RuneLayout } from '@/lib/runedelve/runeLayouts';

export type RuneLayoutPreviewSize = 'sm' | 'md' | 'lg';

interface Props {
  layout: RuneLayout;
  size?: RuneLayoutPreviewSize;
  pulse?: boolean;
  className?: string;
}

const SIZE: Record<RuneLayoutPreviewSize, { px: number; stroke: number; dot: number }> = {
  sm: { px: 40, stroke: 2.4, dot: 2.2 },
  md: { px: 64, stroke: 2.8, dot: 2.8 },
  lg: { px: 112, stroke: 3.4, dot: 4 },
};

export function RuneLayoutPreview({ layout, size = 'md', pulse = false, className }: Props) {
  const dim = SIZE[size];
  const accent = `hsl(${layout.preview.accent})`;
  const accent2 = `hsl(${layout.preview.accent2 ?? layout.preview.accent})`;
  const VB = 100;
  const path = pathForShape(layout.preview.shape);
  const entries = entryDots(layout.preview.shape);
  const slots = slotDots(layout.preview.shape);
  const treasures = treasureDots(layout.preview.shape).slice(0, layout.preview.treasureZones);
  const hazards = hazardDots(layout.preview.shape).slice(0, layout.preview.hazardZones);
  const exits = exitDots(layout.preview.shape).slice(0, layout.preview.exitPoints);
  const idHatch = `rd-hatch-${layout.id}`;
  const idEmber = `rd-ember-${layout.id}`;
  const idGold = `rd-gold-${layout.id}`;

  return (
    <svg
      width={dim.px}
      height={dim.px}
      viewBox={`0 0 ${VB} ${VB}`}
      className={className}
      style={{
        display: 'block',
        // Warm torchlit stone gradient — distinct from Nexus's cold card.
        background:
          'radial-gradient(ellipse 110% 90% at 50% 100%, hsl(28 45% 11%) 0%, hsl(20 50% 6%) 60%, hsl(20 55% 4%) 100%)',
        borderRadius: '6px',
      }}
      aria-label={`Chamber preview: ${layout.name}`}
    >
      <defs>
        {/* Cross-hatch "rune rubbing" texture — replaces tactical grid */}
        <pattern id={idHatch} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(35)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="hsl(35 60% 35%)" strokeWidth="0.35" opacity="0.55" />
        </pattern>
        {/* Warm ember radial — used for entry rune-stones */}
        <radialGradient id={idEmber} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(28 100% 75%)" stopOpacity="1" />
          <stop offset="50%" stopColor="hsl(20 90% 55%)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="hsl(15 80% 35%)" stopOpacity="0" />
        </radialGradient>
        {/* Gold wardstone gradient — used for exit + treasure sigils */}
        <radialGradient id={idGold} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(48 100% 88%)" stopOpacity="1" />
          <stop offset="50%" stopColor="hsl(45 100% 60%)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="hsl(38 80% 35%)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Stone rune-rubbing texture */}
      <rect x="0" y="0" width={VB} height={VB} fill={`url(#${idHatch})`} opacity="0.35" />

      {/* Inner stone darkening (vignette) so paths read against the rubbing */}
      <rect
        x="0" y="0" width={VB} height={VB}
        fill="hsl(20 60% 5%)"
        opacity="0.35"
      />

      {/* Path — double-stroke glowing rune sigil. Outer halo + inner core. */}
      <path
        d={path}
        fill="none"
        stroke={accent}
        strokeWidth={dim.stroke * 3.2}
        strokeOpacity={0.14}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={path}
        fill="none"
        stroke={accent2}
        strokeWidth={dim.stroke * 1.9}
        strokeOpacity={0.35}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={path}
        fill="none"
        stroke="hsl(40 100% 88%)"
        strokeWidth={dim.stroke * 0.65}
        strokeOpacity={0.92}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {pulse && (
          <animate attributeName="stroke-opacity" values="0.55;1;0.55" dur="2.6s" repeatCount="indefinite" />
        )}
      </path>

      {/* Hazard wards — warm orange-red dashed circles, not cold tactical */}
      {hazards.map((p, i) => (
        <g key={`hz-${i}`}>
          <circle
            cx={p.x} cy={p.y} r={dim.dot + 2.4}
            fill="none"
            stroke="hsl(15 85% 60%)"
            strokeWidth={0.8}
            strokeDasharray="1.6 1.2"
            opacity={0.65}
          />
          <circle cx={p.x} cy={p.y} r={dim.dot - 0.6} fill="hsl(15 90% 55%)" opacity={0.55} />
        </g>
      ))}

      {/* Rune slots — small warm embers along the path */}
      {slots.slice(0, layout.preview.runeSlots).map((p, i) => (
        <g key={`rn-${i}`}>
          <circle cx={p.x} cy={p.y} r={dim.dot * 1.4} fill={`url(#${idEmber})`} opacity={0.55} />
          <circle cx={p.x} cy={p.y} r={dim.dot * 0.55} fill="hsl(40 100% 80%)" opacity={0.95}>
            {pulse && (
              <animate
                attributeName="opacity"
                values="0.55;1;0.55"
                dur="2.2s"
                begin={`${i * 0.18}s`}
                repeatCount="indefinite"
              />
            )}
          </circle>
        </g>
      ))}

      {/* Treasure — concentric gold rune-stars (not Nexus's geometric diamond) */}
      {treasures.map((p, i) => (
        <g key={`tr-${i}`}>
          {/* Soft halo */}
          <circle cx={p.x} cy={p.y} r={dim.dot * 2.2} fill={`url(#${idGold})`} opacity={0.55} />
          {/* Four-point rune-star */}
          <path
            d={`M ${p.x} ${p.y - dim.dot * 1.3} L ${p.x + dim.dot * 0.45} ${p.y - dim.dot * 0.45} L ${p.x + dim.dot * 1.3} ${p.y} L ${p.x + dim.dot * 0.45} ${p.y + dim.dot * 0.45} L ${p.x} ${p.y + dim.dot * 1.3} L ${p.x - dim.dot * 0.45} ${p.y + dim.dot * 0.45} L ${p.x - dim.dot * 1.3} ${p.y} L ${p.x - dim.dot * 0.45} ${p.y - dim.dot * 0.45} Z`}
            fill="hsl(48 100% 70%)"
            opacity={0.95}
          />
          {/* Center bloom */}
          <circle cx={p.x} cy={p.y} r={dim.dot * 0.45} fill="hsl(54 100% 92%)" />
        </g>
      ))}

      {/* Entry rune-stones — warm amber bloom (not red laser dots) */}
      {entries.map((p, i) => (
        <g key={`en-${i}`}>
          <circle cx={p.x} cy={p.y} r={dim.dot * 2.4} fill={`url(#${idEmber})`} opacity={0.7} />
          <circle cx={p.x} cy={p.y} r={dim.dot * 1.1} fill="hsl(20 95% 60%)" />
          <circle cx={p.x} cy={p.y} r={dim.dot * 0.4} fill="hsl(45 100% 88%)">
            {pulse && (
              <animate attributeName="r" values={`${dim.dot * 0.4};${dim.dot * 0.7};${dim.dot * 0.4}`} dur="1.6s" repeatCount="indefinite" />
            )}
          </circle>
        </g>
      ))}

      {/* Exit wardstone — bright torchlit gold ring with inner glyph */}
      {exits.map((p, i) => (
        <g key={`ex-${i}`}>
          <circle cx={p.x} cy={p.y} r={dim.dot * 2.8} fill={`url(#${idGold})`} opacity={0.8} />
          <circle cx={p.x} cy={p.y} r={dim.dot * 1.3} fill="none" stroke="hsl(48 100% 75%)" strokeWidth={1} />
          <circle cx={p.x} cy={p.y} r={dim.dot * 0.55} fill="hsl(54 100% 95%)" />
        </g>
      ))}
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Path catalogue — every shape is a single d= string, designed in 0..100.
   ────────────────────────────────────────────────────────────────────── */
function pathForShape(shape: RuneLayout['preview']['shape']): string {
  switch (shape) {
    case 'gate':       return 'M 12 86 L 50 86 L 50 26 L 88 26';
    case 'split':      return 'M 10 50 L 38 50 L 56 26 M 38 50 L 56 74 M 56 26 L 88 26 M 56 74 L 88 74';
    case 'spiral':     return 'M 10 10 L 90 10 L 90 90 L 18 90 L 18 22 L 78 22 L 78 78 L 30 78 L 30 34 L 64 34 L 64 64 L 50 64';
    case 'crossroads': return 'M 50 8 L 50 92 M 8 50 L 92 50';
    case 'vault':      return 'M 12 50 L 36 50 L 36 28 L 64 28 L 64 72 L 36 72 L 36 50 M 64 50 L 88 50';
    case 'hollow':     return 'M 14 50 L 36 50 L 36 22 L 64 22 L 64 78 L 36 78 L 36 50 M 64 50 L 86 50';
    case 'archive':    return 'M 12 22 L 88 22 M 12 50 L 88 50 M 12 78 L 88 78 M 28 22 L 28 78 M 72 22 L 72 78';
    case 'catacomb':   return 'M 10 16 L 50 16 L 50 50 L 90 50 L 90 84 L 50 84 L 50 50 L 10 50 L 10 84 M 50 16 L 50 50';
    case 'reliquary':  return 'M 50 14 A 36 36 0 1 1 49.99 14 M 50 50 m -10 0 a 10 10 0 1 0 20 0';
    case 'seal':       return 'M 12 12 L 50 50 M 88 12 L 50 50 M 50 88 L 50 50';
  }
}

function entryDots(shape: RuneLayout['preview']['shape']): Array<{ x: number; y: number }> {
  switch (shape) {
    case 'gate':       return [{ x: 12, y: 86 }];
    case 'split':      return [{ x: 10, y: 50 }];
    case 'spiral':     return [{ x: 10, y: 10 }];
    case 'crossroads': return [{ x: 50, y: 8 }, { x: 50, y: 92 }, { x: 8, y: 50 }, { x: 92, y: 50 }];
    case 'vault':      return [{ x: 12, y: 50 }, { x: 88, y: 50 }];
    case 'hollow':     return [{ x: 14, y: 50 }, { x: 86, y: 50 }];
    case 'archive':    return [{ x: 12, y: 22 }, { x: 12, y: 78 }];
    case 'catacomb':   return [{ x: 10, y: 16 }, { x: 90, y: 84 }];
    case 'reliquary':  return [{ x: 14, y: 50 }, { x: 50, y: 14 }, { x: 86, y: 50 }];
    case 'seal':       return [{ x: 12, y: 12 }, { x: 88, y: 12 }, { x: 50, y: 88 }];
  }
}

function exitDots(shape: RuneLayout['preview']['shape']): Array<{ x: number; y: number }> {
  switch (shape) {
    case 'gate':       return [{ x: 88, y: 26 }];
    case 'split':      return [{ x: 88, y: 26 }, { x: 88, y: 74 }];
    case 'spiral':     return [{ x: 50, y: 64 }];
    case 'crossroads': return [{ x: 50, y: 50 }];
    case 'vault':      return [{ x: 50, y: 50 }];
    case 'hollow':     return [{ x: 50, y: 50 }];
    case 'archive':    return [{ x: 88, y: 50 }];
    case 'catacomb':   return [{ x: 50, y: 50 }];
    case 'reliquary':  return [{ x: 50, y: 50 }];
    case 'seal':       return [{ x: 50, y: 50 }];
  }
}

function slotDots(shape: RuneLayout['preview']['shape']): Array<{ x: number; y: number }> {
  switch (shape) {
    case 'gate':       return [{ x: 28, y: 86 }, { x: 50, y: 60 }, { x: 70, y: 26 }];
    case 'split':      return [{ x: 24, y: 50 }, { x: 70, y: 26 }, { x: 70, y: 74 }, { x: 50, y: 38 }, { x: 50, y: 62 }];
    case 'spiral':     return [{ x: 30, y: 10 }, { x: 90, y: 30 }, { x: 60, y: 90 }, { x: 18, y: 60 }, { x: 50, y: 22 }, { x: 78, y: 60 }, { x: 30, y: 78 }, { x: 64, y: 50 }];
    case 'crossroads': return [{ x: 50, y: 26 }, { x: 50, y: 74 }, { x: 26, y: 50 }, { x: 74, y: 50 }, { x: 38, y: 38 }, { x: 62, y: 62 }];
    case 'vault':      return [{ x: 24, y: 50 }, { x: 50, y: 28 }, { x: 50, y: 72 }, { x: 76, y: 50 }];
    case 'hollow':     return [{ x: 28, y: 36 }, { x: 28, y: 64 }, { x: 72, y: 36 }, { x: 72, y: 64 }];
    case 'archive':    return [{ x: 28, y: 22 }, { x: 50, y: 22 }, { x: 72, y: 22 }, { x: 28, y: 50 }, { x: 72, y: 50 }, { x: 28, y: 78 }, { x: 50, y: 78 }, { x: 72, y: 78 }];
    case 'catacomb':   return [{ x: 30, y: 16 }, { x: 50, y: 32 }, { x: 70, y: 50 }, { x: 90, y: 66 }, { x: 30, y: 50 }, { x: 70, y: 84 }];
    case 'reliquary':  return [{ x: 50, y: 14 }, { x: 78, y: 22 }, { x: 86, y: 50 }, { x: 78, y: 78 }, { x: 50, y: 86 }, { x: 22, y: 78 }, { x: 14, y: 50 }, { x: 22, y: 22 }, { x: 50, y: 32 }, { x: 68, y: 50 }, { x: 50, y: 68 }, { x: 32, y: 50 }];
    case 'seal':       return [{ x: 30, y: 30 }, { x: 70, y: 30 }, { x: 50, y: 70 }];
  }
}

function treasureDots(shape: RuneLayout['preview']['shape']): Array<{ x: number; y: number }> {
  switch (shape) {
    case 'gate':       return [{ x: 88, y: 26 }];
    case 'split':      return [{ x: 88, y: 26 }];
    case 'spiral':     return [{ x: 50, y: 64 }, { x: 78, y: 78 }];
    case 'crossroads': return [{ x: 50, y: 50 }];
    case 'vault':      return [{ x: 50, y: 50 }, { x: 36, y: 28 }, { x: 64, y: 72 }];
    case 'hollow':     return [{ x: 50, y: 50 }];
    case 'archive':    return [{ x: 14, y: 36 }, { x: 86, y: 64 }];
    case 'catacomb':   return [{ x: 30, y: 84 }, { x: 90, y: 84 }];
    case 'reliquary':  return [{ x: 50, y: 14 }, { x: 86, y: 50 }, { x: 50, y: 86 }, { x: 14, y: 50 }];
    case 'seal':       return [{ x: 50, y: 50 }];
  }
}

function hazardDots(shape: RuneLayout['preview']['shape']): Array<{ x: number; y: number }> {
  switch (shape) {
    case 'gate':       return [];
    case 'split':      return [{ x: 50, y: 50 }];
    case 'spiral':     return [{ x: 50, y: 22 }];
    case 'crossroads': return [{ x: 30, y: 30 }, { x: 70, y: 70 }];
    case 'vault':      return [{ x: 24, y: 30 }, { x: 76, y: 70 }, { x: 50, y: 50 }];
    case 'hollow':     return [{ x: 50, y: 22 }, { x: 50, y: 78 }];
    case 'archive':    return [{ x: 50, y: 50 }];
    case 'catacomb':   return [{ x: 90, y: 50 }, { x: 30, y: 50 }];
    case 'reliquary':  return [{ x: 32, y: 32 }, { x: 68, y: 68 }];
    case 'seal':       return [{ x: 32, y: 22 }, { x: 68, y: 22 }, { x: 50, y: 60 }];
  }
}
