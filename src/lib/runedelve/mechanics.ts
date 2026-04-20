// Mechanic registry — single source of truth for every mechanic family in the
// Rune Delve campaign. Each mechanic has a stable id, a compact icon, a short
// label, and a one-line rule that's safe to render on a small phone screen.
//
// Mechanics are introduced in 25-level bands and become part of the
// deterministic level definition (see levelGenerator.ts).

export type MechanicId =
  | 'sealed_tiles'
  | 'telegraphed_attacks'
  | 'corrupted_tiles'
  | 'multi_objective'
  | 'boss_modifier';

export interface MechanicDef {
  id: MechanicId;
  name: string;
  /** Short, single-word group label shown on chips. */
  family: string;
  /** Single emoji works well at any size and avoids extra icon assets. */
  icon: string;
  /** One-line rule. Keep it under ~80 chars so it never wraps awkwardly. */
  oneLiner: string;
  /** First level (inclusive) where this mechanic is taught. */
  introLevel: number;
  /** Last level (inclusive) of the band that introduces it. */
  bandEnd: number;
}

export const MECHANICS: Record<MechanicId, MechanicDef> = {
  sealed_tiles: {
    id: 'sealed_tiles',
    name: 'Sealed Runes',
    family: 'Board',
    icon: '🔒',
    oneLiner: 'Sealed runes can\'t be chained. Match a rune next to a seal to break it.',
    introLevel: 26,
    bandEnd: 50,
  },
  telegraphed_attacks: {
    id: 'telegraphed_attacks',
    name: 'Telegraphed Attacks',
    family: 'Threat',
    icon: '⚠️',
    oneLiner: 'Enemies show their next move. Stop them before it lands.',
    introLevel: 51,
    bandEnd: 75,
  },
  corrupted_tiles: {
    id: 'corrupted_tiles',
    name: 'Corrupted Tiles',
    family: 'Hazard',
    icon: '☠️',
    oneLiner: 'Corruption spreads each turn. Clear the source or be overrun.',
    introLevel: 76,
    bandEnd: 100,
  },
  multi_objective: {
    id: 'multi_objective',
    name: 'Layered Goals',
    family: 'Quest',
    icon: '🎯',
    oneLiner: 'Two goals at once. Read the banner — both must be met.',
    introLevel: 101,
    bandEnd: 125,
  },
  boss_modifier: {
    id: 'boss_modifier',
    name: 'Boss Rule',
    family: 'Boss',
    icon: '👑',
    oneLiner: 'Each boss bends one rule. Beat the gimmick to win.',
    introLevel: 126,
    bandEnd: 150,
  },
};

export const MECHANIC_LIST: MechanicDef[] = [
  MECHANICS.sealed_tiles,
  MECHANICS.telegraphed_attacks,
  MECHANICS.corrupted_tiles,
  MECHANICS.multi_objective,
  MECHANICS.boss_modifier,
];

export function getMechanic(id: MechanicId): MechanicDef {
  return MECHANICS[id];
}

// Which mechanic, if any, is being introduced AT this exact level number.
// Returns the mechanic only on the very first level of the band — used to
// decide when to show the one-time intro modal.
export function introMechanicForLevel(level: number): MechanicId | null {
  const m = MECHANIC_LIST.find(m => m.introLevel === level);
  return m?.id ?? null;
}

// Every mechanic that should be active on a given level number.
// Mechanics turn on at their band start and remain available afterwards so
// later levels can combine previously-taught mechanics (one new mechanic at
// any time, plus at most one previously-learned mechanic — enforced in the
// level generator).
export function mechanicsForLevel(level: number): MechanicId[] {
  return MECHANIC_LIST.filter(m => level >= m.introLevel).map(m => m.id);
}

// localStorage key for "this user has already seen the intro for mechanic X".
export const seenMechanicKey = (id: MechanicId) => `rd_seen_mechanic_${id}`;
