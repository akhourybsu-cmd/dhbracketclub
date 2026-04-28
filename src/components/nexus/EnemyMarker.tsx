import { EnemyKind } from '@/lib/nexus/types';

const PALETTE: Record<EnemyKind, { core: string; edge: string; glow: string }> = {
  drone:    { core: 'hsl(350 95% 70%)',  edge: 'hsl(350 95% 85%)', glow: 'hsl(350 95% 60% / 0.7)' },
  walker:   { core: 'hsl(22 95% 58%)',   edge: 'hsl(40 95% 75%)',  glow: 'hsl(22 95% 55% / 0.65)' },
  shielded: { core: 'hsl(200 95% 62%)',  edge: 'hsl(200 95% 85%)', glow: 'hsl(200 95% 60% / 0.7)' },
  stealth:  { core: 'hsl(265 85% 70%)',  edge: 'hsl(280 95% 88%)', glow: 'hsl(265 85% 60% / 0.55)' },
  boss:     { core: 'hsl(355 90% 50%)',  edge: 'hsl(20 95% 70%)',  glow: 'hsl(355 95% 50% / 0.85)' },
};

interface MarkerProps {
  kind: EnemyKind;
  size: number;
}

/**
 * Distinct silhouette per enemy type rendered as a tiny SVG.
 * Designed to read at 14–28px on mobile.
 */
export function EnemyMarker({ kind, size }: MarkerProps) {
  const p = PALETTE[kind];
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    style: { filter: `drop-shadow(0 0 4px ${p.glow})` },
  } as const;

  switch (kind) {
    case 'drone':
      // Tri-rotor swarm dot
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3.5" fill={p.core} stroke={p.edge} strokeWidth="1" />
          <circle cx="12" cy="4.5" r="1.8" fill={p.core} opacity="0.85" />
          <circle cx="5" cy="16" r="1.8" fill={p.core} opacity="0.85" />
          <circle cx="19" cy="16" r="1.8" fill={p.core} opacity="0.85" />
          <line x1="12" y1="12" x2="12" y2="6" stroke={p.edge} strokeWidth="0.7" />
          <line x1="12" y1="12" x2="6" y2="15.4" stroke={p.edge} strokeWidth="0.7" />
          <line x1="12" y1="12" x2="18" y2="15.4" stroke={p.edge} strokeWidth="0.7" />
        </svg>
      );
    case 'walker':
      // Heavy hex chassis with treads
      return (
        <svg {...common}>
          <polygon points="6,8 12,4 18,8 18,16 12,20 6,16" fill={p.core} stroke={p.edge} strokeWidth="1.1" />
          <rect x="9" y="10" width="6" height="4" rx="0.5" fill="hsl(218 50% 8%)" stroke={p.edge} strokeWidth="0.6" />
          <rect x="4.5" y="10.5" width="1.5" height="3" fill={p.edge} opacity="0.7" />
          <rect x="18" y="10.5" width="1.5" height="3" fill={p.edge} opacity="0.7" />
        </svg>
      );
    case 'shielded':
      // Hexagonal trooper with energy bracket (shield ring drawn separately by parent)
      return (
        <svg {...common}>
          <polygon points="12,3 19,7.5 19,16.5 12,21 5,16.5 5,7.5" fill={p.core} stroke={p.edge} strokeWidth="1.1" />
          <circle cx="12" cy="12" r="2.4" fill="hsl(218 50% 8%)" stroke={p.edge} strokeWidth="0.7" />
          <circle cx="12" cy="12" r="1.1" fill={p.edge} />
        </svg>
      );
    case 'stealth':
      // Diamond cloaked silhouette
      return (
        <svg {...common}>
          <polygon points="12,3 20,12 12,21 4,12" fill={p.core} stroke={p.edge} strokeWidth="1" opacity="0.78" />
          <polygon points="12,7 16,12 12,17 8,12" fill="none" stroke={p.edge} strokeWidth="0.7" strokeDasharray="1.5 1.2" />
          <circle cx="12" cy="12" r="0.9" fill={p.edge} />
        </svg>
      );
    case 'boss':
      // Heavy mech with horns
      return (
        <svg {...common}>
          <polygon points="3,9 7,4 17,4 21,9 21,17 16,21 8,21 3,17" fill={p.core} stroke={p.edge} strokeWidth="1.2" />
          <polygon points="7,4 9,1 11,4" fill={p.edge} />
          <polygon points="13,4 15,1 17,4" fill={p.edge} />
          <rect x="8.5" y="10" width="7" height="4.5" rx="0.6" fill="hsl(0 0% 5%)" stroke={p.edge} strokeWidth="0.7" />
          <circle cx="10.5" cy="12.2" r="0.9" fill={p.edge} />
          <circle cx="13.5" cy="12.2" r="0.9" fill={p.edge} />
          <line x1="9" y1="17" x2="9" y2="20" stroke={p.edge} strokeWidth="0.9" />
          <line x1="15" y1="17" x2="15" y2="20" stroke={p.edge} strokeWidth="0.9" />
        </svg>
      );
  }
}

export function getEnemyAccent(kind: EnemyKind) {
  return PALETTE[kind];
}
