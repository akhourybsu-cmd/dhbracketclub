import { TowerKind } from '@/lib/nexus/types';

interface Props {
  kind: TowerKind;
  size?: number;
  className?: string;
}

/**
 * Distinct sci-fi silhouettes for each Nexus Defense tower.
 * Drawn in SVG for crisp rendering at any size and tinted via currentColor
 * so the parent controls color (matches role: cyan/violet/sky/amber).
 *
 * - Pulse Cannon  : compact dual-barrel turret on a hexagonal base
 * - Arc Tower     : forked Tesla coil with crackling caps
 * - Cryo Emitter  : downward frost vent with concentric rings
 * - Rail Battery  : long-barrel rail gun on a tracked mount
 */
export function TowerIcon({ kind, size = 24, className }: Props) {
  const stroke = 1.8;
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 32 32',
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: stroke,
  };

  if (kind === 'pulse') {
    return (
      <svg {...common}>
        {/* hex base */}
        <path d="M8 22 L8 26 L16 30 L24 26 L24 22 L16 18 Z" opacity="0.55" />
        {/* turret body */}
        <circle cx="16" cy="17" r="4.5" />
        {/* twin barrels */}
        <path d="M13.5 16 L13.5 6.5" />
        <path d="M18.5 16 L18.5 6.5" />
        {/* muzzle dots */}
        <circle cx="13.5" cy="6" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="18.5" cy="6" r="0.9" fill="currentColor" stroke="none" />
        {/* core */}
        <circle cx="16" cy="17" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (kind === 'arc') {
    return (
      <svg {...common}>
        {/* base */}
        <path d="M9 26 L9 22 L23 22 L23 26" opacity="0.55" />
        <path d="M7 26 L25 26" opacity="0.55" />
        {/* central coil */}
        <path d="M16 22 L16 12" />
        <path d="M13 19 L19 19" />
        <path d="M13 16 L19 16" />
        {/* fork antennae */}
        <path d="M16 12 L11 6" />
        <path d="M16 12 L21 6" />
        {/* crackle caps */}
        <circle cx="11" cy="5.5" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="21" cy="5.5" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="16" cy="11" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (kind === 'cryo') {
    return (
      <svg {...common}>
        {/* base ring */}
        <ellipse cx="16" cy="26" rx="8" ry="2.4" opacity="0.5" />
        {/* emitter cone (inverted) */}
        <path d="M9 14 L23 14 L19 22 L13 22 Z" />
        {/* core */}
        <circle cx="16" cy="14" r="3.2" />
        <circle cx="16" cy="14" r="1.2" fill="currentColor" stroke="none" />
        {/* radiating rings above */}
        <path d="M12 9 L20 9" opacity="0.7" />
        <path d="M14 6 L18 6" opacity="0.5" />
        {/* frost spokes */}
        <path d="M16 22 L16 27" opacity="0.6" />
        <path d="M13 22 L11 26" opacity="0.5" />
        <path d="M19 22 L21 26" opacity="0.5" />
      </svg>
    );
  }

  // rail
  return (
    <svg {...common}>
      {/* tracked mount */}
      <rect x="6" y="22" width="20" height="4" rx="1.6" opacity="0.55" />
      <circle cx="9" cy="27.5" r="1.1" opacity="0.7" />
      <circle cx="16" cy="27.5" r="1.1" opacity="0.7" />
      <circle cx="23" cy="27.5" r="1.1" opacity="0.7" />
      {/* turret housing */}
      <path d="M11 22 L11 17 L21 17 L21 22" />
      {/* rail guides */}
      <path d="M9 13 L29 6" />
      <path d="M9 17 L29 10" />
      {/* barrel core */}
      <path d="M11 15 L27 8.5" strokeWidth={3} opacity="0.85" />
      {/* muzzle flare anchor */}
      <circle cx="29" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
