// Nexus Defense — Map Layout Preview
//
// Tiny SVG mini-map used in mission cards, briefings, and the mode-select
// hub. Renders a stylised top-down representation of the layout's path so
// each mission feels visually distinct without needing actual map art.
//
// The shape is selected from the MapLayout.preview metadata; spawn points
// (red dots) and core(s) (golden dots) are added for tactical clarity.

import type { MapLayout } from '@/lib/nexus/mapLayouts';

export type MapLayoutPreviewSize = 'sm' | 'md' | 'lg';

interface Props {
  layout: MapLayout;
  size?: MapLayoutPreviewSize;
  /** Pulse the path / spawn dots for active states. */
  pulse?: boolean;
  className?: string;
}

const SIZE_MAP: Record<MapLayoutPreviewSize, { px: number; strokeW: number; dotR: number }> = {
  sm: { px: 56, strokeW: 2.5, dotR: 2.5 },
  md: { px: 96, strokeW: 3, dotR: 3.5 },
  lg: { px: 140, strokeW: 3.5, dotR: 4.5 },
};

export function MapLayoutPreview({ layout, size = 'md', pulse = false, className }: Props) {
  const dim = SIZE_MAP[size];
  const accent = layout.preview.accent;
  const accent2 = layout.preview.accent2 ?? accent;
  const VB = 100; // viewBox in 0..100 units

  // ───────────────────────────────────────────────────────────────
  // Path geometry per shape — single SVG <path d>.
  // Coordinates are in the 0..100 viewBox.
  // ───────────────────────────────────────────────────────────────
  const path = pathForShape(layout.preview.shape);
  const spawns = spawnsForShape(layout.preview.shape);
  const cores = coresForShape(layout.preview.shape);

  const id = `nx-grad-${layout.id}`;

  return (
    <svg
      width={dim.px}
      height={dim.px}
      viewBox={`0 0 ${VB} ${VB}`}
      className={className}
      style={{
        display: 'block',
        background: 'linear-gradient(180deg, hsl(218 35% 7%), hsl(218 38% 5%))',
        borderRadius: '6px',
      }}
      aria-label={`Map preview: ${layout.name}`}
    >
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={accent} stopOpacity={1} />
          <stop offset="100%" stopColor={accent2} stopOpacity={0.7} />
        </linearGradient>
      </defs>

      {/* tactical grid */}
      <g opacity={0.18}>
        {[20, 40, 60, 80].map(v => (
          <line key={`h${v}`} x1={0} y1={v} x2={VB} y2={v} stroke={accent} strokeWidth={0.4} />
        ))}
        {[20, 40, 60, 80].map(v => (
          <line key={`v${v}`} x1={v} y1={0} x2={v} y2={VB} stroke={accent} strokeWidth={0.4} />
        ))}
      </g>

      {/* path glow (back-layer) */}
      <path
        d={path}
        fill="none"
        stroke={accent}
        strokeWidth={dim.strokeW * 2.4}
        strokeOpacity={0.18}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* path */}
      <path
        d={path}
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth={dim.strokeW}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {pulse && (
          <animate
            attributeName="stroke-opacity"
            values="0.6;1;0.6"
            dur="2.4s"
            repeatCount="indefinite"
          />
        )}
      </path>

      {/* spawn points (red, hostile origin) */}
      {spawns.map((p, i) => (
        <g key={`spawn-${i}`}>
          <circle cx={p.x} cy={p.y} r={dim.dotR + 1.6} fill="hsl(0 80% 60%)" opacity={0.22} />
          <circle cx={p.x} cy={p.y} r={dim.dotR} fill="hsl(0 90% 65%)">
            {pulse && (
              <animate attributeName="r" values={`${dim.dotR};${dim.dotR + 1.4};${dim.dotR}`} dur="1.6s" repeatCount="indefinite" />
            )}
          </circle>
        </g>
      ))}

      {/* core(s) — golden defensive nexus marker */}
      {cores.map((p, i) => (
        <g key={`core-${i}`}>
          <circle cx={p.x} cy={p.y} r={dim.dotR + 2.4} fill="hsl(45 100% 65%)" opacity={0.20} />
          <circle cx={p.x} cy={p.y} r={dim.dotR + 0.6} fill="hsl(45 100% 65%)" />
          <circle cx={p.x} cy={p.y} r={dim.dotR - 1} fill="hsl(45 100% 90%)" />
        </g>
      ))}
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Path catalogue — keep these readable; each is a single d= string.
   ────────────────────────────────────────────────────────────────────── */
function pathForShape(shape: MapLayout['preview']['shape']): string {
  switch (shape) {
    case 'lane':       return 'M 8 50 L 92 50';
    case 'split':      return 'M 8 50 L 40 50 L 60 25 M 40 50 L 60 75 M 60 25 L 80 25 M 60 75 L 80 75';
    case 'spiral':     return 'M 10 10 L 90 10 L 90 90 L 18 90 L 18 22 L 78 22 L 78 78 L 30 78 L 30 34 L 64 34 L 64 64 L 50 64';
    case 'cross':      return 'M 50 8 L 50 92 M 8 50 L 92 50';
    case 'rim':        return 'M 8 50 A 42 42 0 0 1 92 50 A 42 42 0 0 1 8 50';
    case 'dual':       return 'M 8 32 L 92 32 M 8 68 L 92 68';
    case 'outpost':    return 'M 8 80 L 50 80 L 50 30 L 78 30';
    case 'corridor':   return 'M 8 30 L 30 30 L 30 55 L 55 55 L 55 30 L 80 30 L 80 70 L 92 70';
    case 'cardinal':   return 'M 50 8 L 50 50 M 50 92 L 50 50 M 8 50 L 50 50 M 92 50 L 50 50';
    case 'twingate':   return 'M 25 8 L 25 35 L 50 50 M 75 8 L 75 35 L 50 50 L 50 92';
    case 'ring':       return 'M 50 12 A 38 38 0 1 1 49.99 12 M 50 50 m -12 0 a 12 12 0 1 0 24 0';
    case 'standoff':   return 'M 12 12 L 50 60 M 88 12 L 50 60 M 50 12 L 50 60 L 50 92';
    case 'fourgate':   return 'M 50 8 L 50 50 M 50 92 L 50 50 M 8 50 L 50 50 M 92 50 L 50 50 M 36 36 L 64 36 L 64 64 L 36 64 Z';
    case 'shared':     return 'M 8 30 L 30 30 L 30 78 L 70 78 L 70 30 L 92 30';
    case 'partner':    return 'M 8 35 L 92 35 M 8 65 L 92 65 M 92 35 L 92 65';
    case 'siege':      return 'M 12 12 L 50 50 M 88 12 L 50 50 M 50 88 L 50 50';
  }
}

function spawnsForShape(shape: MapLayout['preview']['shape']): Array<{ x: number; y: number }> {
  switch (shape) {
    case 'lane':       return [{ x: 8, y: 50 }];
    case 'split':      return [{ x: 8, y: 50 }];
    case 'spiral':     return [{ x: 10, y: 10 }];
    case 'cross':      return [{ x: 50, y: 8 }, { x: 50, y: 92 }, { x: 8, y: 50 }, { x: 92, y: 50 }];
    case 'rim':        return [{ x: 8, y: 50 }, { x: 92, y: 50 }];
    case 'dual':       return [{ x: 8, y: 32 }, { x: 8, y: 68 }];
    case 'outpost':    return [{ x: 8, y: 80 }];
    case 'corridor':   return [{ x: 8, y: 30 }];
    case 'cardinal':   return [{ x: 50, y: 8 }, { x: 50, y: 92 }, { x: 8, y: 50 }, { x: 92, y: 50 }];
    case 'twingate':   return [{ x: 25, y: 8 }, { x: 75, y: 8 }];
    case 'ring':       return [{ x: 50, y: 12 }, { x: 88, y: 50 }, { x: 12, y: 50 }];
    case 'standoff':   return [{ x: 12, y: 12 }, { x: 88, y: 12 }, { x: 50, y: 12 }];
    case 'fourgate':   return [{ x: 50, y: 8 }, { x: 50, y: 92 }, { x: 8, y: 50 }, { x: 92, y: 50 }];
    case 'shared':     return [{ x: 8, y: 30 }];
    case 'partner':    return [{ x: 8, y: 35 }, { x: 8, y: 65 }];
    case 'siege':      return [{ x: 12, y: 12 }, { x: 88, y: 12 }, { x: 50, y: 88 }];
  }
}

function coresForShape(shape: MapLayout['preview']['shape']): Array<{ x: number; y: number }> {
  switch (shape) {
    case 'lane':       return [{ x: 92, y: 50 }];
    case 'split':      return [{ x: 80, y: 25 }, { x: 80, y: 75 }];
    case 'spiral':     return [{ x: 50, y: 64 }];
    case 'cross':      return [{ x: 50, y: 50 }];
    case 'rim':        return [{ x: 50, y: 50 }];
    case 'dual':       return [{ x: 92, y: 32 }, { x: 92, y: 68 }];
    case 'outpost':    return [{ x: 78, y: 30 }];
    case 'corridor':   return [{ x: 92, y: 70 }];
    case 'cardinal':   return [{ x: 50, y: 50 }];
    case 'twingate':   return [{ x: 50, y: 92 }];
    case 'ring':       return [{ x: 50, y: 50 }];
    case 'standoff':   return [{ x: 50, y: 92 }];
    case 'fourgate':   return [{ x: 50, y: 50 }];
    case 'shared':     return [{ x: 92, y: 30 }];
    case 'partner':    return [{ x: 92, y: 50 }];
    case 'siege':      return [{ x: 50, y: 50 }];
  }
}
