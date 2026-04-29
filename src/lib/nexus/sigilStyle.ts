// Nexus Defense — Sigil rarity → consistent visual treatment.
// Used by results panel, leaderboard avatar rings, and contributor chips
// so rarity reads identically everywhere.

export type SigilRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface SigilTone {
  /** Solid border color (hsl). */
  border: string;
  /** Background tint (hsl with alpha). */
  bg: string;
  /** Text/icon color (hsl). */
  fg: string;
  /** Outer glow color (hsl with alpha). */
  glow: string;
  /** Whether to apply an animated pulse/gradient. */
  animated: boolean;
  /** Short label for tooltips/screen-readers. */
  label: string;
}

export function sigilTone(rarity: SigilRarity): SigilTone {
  switch (rarity) {
    case 'rare':
      return {
        border: 'hsl(195 90% 60%)',
        bg: 'hsl(195 90% 60% / 0.12)',
        fg: 'hsl(195 95% 80%)',
        glow: 'hsl(195 90% 60% / 0.45)',
        animated: false,
        label: 'Rare',
      };
    case 'epic':
      return {
        border: 'hsl(280 85% 65%)',
        bg: 'hsl(280 85% 65% / 0.14)',
        fg: 'hsl(280 95% 85%)',
        glow: 'hsl(280 85% 65% / 0.5)',
        animated: true,
        label: 'Epic',
      };
    case 'legendary':
      return {
        border: 'hsl(45 100% 60%)',
        bg: 'hsl(45 100% 60% / 0.16)',
        fg: 'hsl(45 100% 78%)',
        glow: 'hsl(45 100% 60% / 0.6)',
        animated: true,
        label: 'Legendary',
      };
    case 'common':
    default:
      return {
        border: 'hsl(0 0% 100% / 0.25)',
        bg: 'hsl(0 0% 100% / 0.05)',
        fg: 'hsl(0 0% 85%)',
        glow: 'hsl(0 0% 100% / 0.15)',
        animated: false,
        label: 'Common',
      };
  }
}

/** Compute the inline ring-box-shadow for an avatar/chip. */
export function sigilRingShadow(rarity: SigilRarity): string {
  const t = sigilTone(rarity);
  if (rarity === 'legendary') {
    return `0 0 0 2px ${t.border}, 0 0 14px ${t.glow}, 0 0 28px ${t.glow}`;
  }
  if (rarity === 'epic') {
    return `0 0 0 2px ${t.border}, 0 0 10px ${t.glow}`;
  }
  if (rarity === 'rare') {
    return `0 0 0 1.5px ${t.border}, 0 0 6px ${t.glow}`;
  }
  return `0 0 0 1px ${t.border}`;
}

/** CSS animation name for legendary/epic shimmers. Defined in index.css. */
export function sigilAnimation(rarity: SigilRarity): string | undefined {
  if (rarity === 'legendary') return 'nx-sigil-legendary 3.4s ease-in-out infinite';
  if (rarity === 'epic') return 'nx-sigil-epic 4s ease-in-out infinite';
  return undefined;
}
