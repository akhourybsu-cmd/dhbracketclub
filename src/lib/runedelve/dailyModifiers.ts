// Daily Challenge modifiers — these effects ONLY appear in Daily mode and
// never in the regular campaign. Each modifier is a small data record that
// drives both the codex/UI presentation AND the engine multipliers/flags
// applied during a daily run.

export type DailyModifierId =
  | 'inferno'
  | 'ironclad'
  | 'overcharge'
  | 'fogged'
  | 'glass_cannon'
  | 'hourglass'
  | 'greed'
  | 'reflective';

export interface DailyModifierDef {
  id: DailyModifierId;
  name: string;
  icon: string;
  /** Single-line rule for the codex / pre-run banner. */
  rule: string;
  /** Slightly longer flavor for the daily landing page. */
  detail: string;
  /** Difficulty weight 1-3 used to balance the daily roll. */
  weight: 1 | 2 | 3;
}

export const DAILY_MODIFIERS: Record<DailyModifierId, DailyModifierDef> = {
  inferno: {
    id: 'inferno', name: 'Inferno', icon: '🔥', weight: 2,
    rule: 'All red chains +30% damage. You lose 2 HP per turn.',
    detail: 'The dungeon burns. Lean into red attack chains, but every turn shaves your health.',
  },
  ironclad: {
    id: 'ironclad', name: 'Ironclad', icon: '🛡️', weight: 2,
    rule: 'Enemies have armor: chains under 4 deal half damage.',
    detail: 'Short chains barely scratch them. Aim for 4+ to break the armor.',
  },
  overcharge: {
    id: 'overcharge', name: 'Overcharge', icon: '⚡', weight: 1,
    rule: 'Mana costs 2 (down from 3). Chains can\'t exceed length 5.',
    detail: 'Cast freely — but no monster combos.',
  },
  fogged: {
    id: 'fogged', name: 'Fogged', icon: '🌫️', weight: 2,
    rule: 'No foresight. Spawn previews are hidden.',
    detail: 'Plan turn-by-turn — no peeking at what comes next.',
  },
  glass_cannon: {
    id: 'glass_cannon', name: 'Glass Cannon', icon: '🩸', weight: 3,
    rule: 'Damage you deal +50%. Max HP halved.',
    detail: 'You hit hard. You die fast. Choose every chain wisely.',
  },
  hourglass: {
    id: 'hourglass', name: 'Hourglass', icon: '⏳', weight: 2,
    rule: '−2 turn limit. Each chain refunds 1 mana.',
    detail: 'Fewer turns, but the casts come quick.',
  },
  greed: {
    id: 'greed', name: 'Greed', icon: '🪙', weight: 1,
    rule: '+50% shards earned. Enemies +25% HP.',
    detail: 'Tankier foes, but the loot is fat.',
  },
  reflective: {
    id: 'reflective', name: 'Reflective', icon: '🪞', weight: 2,
    rule: 'Enemies reflect 20% of damage you deal.',
    detail: 'Big chains hurt them — and you. Manage your HP.',
  },
};

export const DAILY_MODIFIER_LIST: DailyModifierDef[] = Object.values(DAILY_MODIFIERS);

export function getDailyModifier(id: DailyModifierId): DailyModifierDef {
  return DAILY_MODIFIERS[id];
}
