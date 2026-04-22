/**
 * Pure SVG primitives for the Rune Delve FX layer. Each component is a small,
 * self-contained <svg> with no animation logic — the consuming FX file wraps
 * them in <motion.*> for transforms. Props are intentionally minimal so they
 * compose cleanly with Framer Motion.
 *
 * All shapes are stroked/filled with `currentColor` so the parent decides hue.
 */

interface IconProps {
  size?: number;
  className?: string;
  color?: string;
}

export function KatanaBlade({ size = 90, className, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size * 0.18} viewBox="0 0 100 18" className={className} fill="none">
      <defs>
        <linearGradient id="kb" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={color} stopOpacity="0" />
          <stop offset="0.15" stopColor={color} stopOpacity="0.95" />
          <stop offset="0.85" stopColor="white" stopOpacity="0.95" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Blade */}
      <path d="M2 9 L78 4 L96 9 L78 14 Z" fill="url(#kb)" />
      {/* Edge highlight */}
      <path d="M6 9 L92 9" stroke="white" strokeOpacity="0.7" strokeWidth="0.6" />
      {/* Tang */}
      <rect x="0" y="7.5" width="6" height="3" fill={color} opacity="0.6" />
    </svg>
  );
}

export function ImpactStar({ size = 60, className, color = 'currentColor' }: IconProps) {
  // 8-point star burst
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? 50 : 18;
    const a = (Math.PI * 2 * i) / 16 - Math.PI / 2;
    pts.push(`${50 + Math.cos(a) * r},${50 + Math.sin(a) * r}`);
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className}>
      <polygon points={pts.join(' ')} fill={color} opacity="0.95" />
      <circle cx="50" cy="50" r="14" fill="white" opacity="0.85" />
    </svg>
  );
}

export function HeaterShield({ size = 70, className, color = 'currentColor', mirror = false, doubleRim = false }: IconProps & { mirror?: boolean; doubleRim?: boolean }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 80 92" className={className} style={mirror ? { transform: 'scaleX(-1)' } : undefined}>
      <defs>
        <linearGradient id="hs" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="1" />
          <stop offset="1" stopColor={color} stopOpacity="0.55" />
        </linearGradient>
      </defs>
      {/* Half-shield: left half of a heater shape, divided down center */}
      <path d="M40 4 L40 88 L10 70 Q4 50 6 22 Q22 8 40 4 Z" fill="url(#hs)" stroke={color} strokeWidth="1.5" />
      {doubleRim && (
        <path d="M40 9 L40 84 L14 67 Q9 50 11 24 Q24 12 40 9 Z" fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="0.8" />
      )}
      {/* Rivets */}
      <circle cx="14" cy="22" r="1.6" fill="white" opacity="0.9" />
      <circle cx="14" cy="62" r="1.6" fill="white" opacity="0.9" />
      <circle cx="34" cy="14" r="1.6" fill="white" opacity="0.9" />
      <circle cx="34" cy="78" r="1.6" fill="white" opacity="0.9" />
      {/* Center highlight stripe */}
      <path d="M40 8 L40 84" stroke="white" strokeOpacity="0.35" strokeWidth="1" />
    </svg>
  );
}

export function HexNode({ size = 18, className, color = 'currentColor' }: IconProps) {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    pts.push(`${50 + Math.cos(a) * 44},${50 + Math.sin(a) * 44}`);
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className}>
      <polygon points={pts.join(' ')} fill={color} fillOpacity="0.85" stroke="white" strokeOpacity="0.7" strokeWidth="3" />
      <circle cx="50" cy="50" r="16" fill="white" opacity="0.9" />
    </svg>
  );
}

export function VineLeaf({ size = 16, className, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path d="M12 2 Q22 8 18 16 Q12 22 4 18 Q2 10 12 2 Z" fill={color} fillOpacity="0.9" />
      <path d="M12 2 Q11 12 4 18" stroke="white" strokeOpacity="0.55" strokeWidth="0.8" fill="none" />
    </svg>
  );
}

export function Meteor({ size = 80, className, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size * 0.35} viewBox="0 0 100 35" className={className} fill="none">
      <defs>
        <linearGradient id="mt" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={color} stopOpacity="0" />
          <stop offset="0.7" stopColor={color} stopOpacity="0.85" />
          <stop offset="1" stopColor="white" stopOpacity="1" />
        </linearGradient>
      </defs>
      {/* Comet tail */}
      <path d="M0 17 L82 12 L82 22 Z" fill="url(#mt)" />
      {/* Head */}
      <circle cx="86" cy="17" r="8" fill="white" />
      <circle cx="86" cy="17" r="12" fill={color} fillOpacity="0.5" />
    </svg>
  );
}

export function RuneCircle({ size = 80, className, color = 'currentColor' }: IconProps) {
  // Notched circle with 4 rune ticks
  const ticks = [0, 90, 180, 270].map(deg => {
    const a = (deg * Math.PI) / 180;
    return { x1: 50 + Math.cos(a) * 38, y1: 50 + Math.sin(a) * 38, x2: 50 + Math.cos(a) * 48, y2: 50 + Math.sin(a) * 48 };
  });
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} fill="none">
      <circle cx="50" cy="50" r="42" stroke={color} strokeWidth="1.5" strokeOpacity="0.9" />
      <circle cx="50" cy="50" r="32" stroke={color} strokeWidth="0.8" strokeOpacity="0.6" strokeDasharray="3 3" />
      {ticks.map((t, i) => (
        <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={color} strokeWidth="2" />
      ))}
    </svg>
  );
}

export function SacredStar({ size = 120, className, color = 'currentColor' }: IconProps) {
  // Two overlapping triangles — 6-point star
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} fill="none">
      <polygon points="50,8 88,72 12,72" stroke={color} strokeWidth="2" strokeOpacity="0.95" />
      <polygon points="50,92 12,28 88,28" stroke={color} strokeWidth="2" strokeOpacity="0.95" />
      <circle cx="50" cy="50" r="36" stroke={color} strokeWidth="0.8" strokeOpacity="0.5" strokeDasharray="2 4" />
    </svg>
  );
}

export function CrossGlyph({ size = 14, className, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size * 1.4} viewBox="0 0 10 14" className={className}>
      <path d="M4 0 H6 V4 H10 V6 H6 V14 H4 V6 H0 V4 H4 Z" fill={color} />
    </svg>
  );
}

export function Kanji({ size = 48, className, color = 'currentColor' }: IconProps) {
  // Stylized "斬" (cut) — abstract brush strokes, not actual glyph for perf
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} fill="none">
      <path d="M8 12 L40 12" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <path d="M14 22 L34 22" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <path d="M24 6 L24 42" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M10 36 L20 28" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M28 28 L42 40" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function RockChunk({ size = 12, className, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" className={className}>
      <polygon points="2,9 6,2 11,6 9,11 4,11" fill={color} stroke="black" strokeOpacity="0.4" strokeWidth="0.6" />
    </svg>
  );
}
