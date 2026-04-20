export type HeroClass = 'warrior' | 'mage' | 'rogue' | 'cleric';

export interface ClassDef {
  id: HeroClass;
  name: string;
  emoji: string;
  color: string; // tailwind class fragment for accents
  passive: string;
  abilityName: string;
  abilityDesc: string;
  abilityCost: number; // mana orbs needed
}

export const CLASS_LIST: ClassDef[] = [
  {
    id: 'warrior',
    name: 'Warrior',
    emoji: '⚔️',
    color: 'destructive',
    passive: 'Red chains deal +25% damage',
    abilityName: 'Cleave',
    abilityDesc: 'Damage all enemies (40 dmg)',
    abilityCost: 3,
  },
  {
    id: 'mage',
    name: 'Mage',
    emoji: '🔮',
    color: 'accent',
    passive: 'Blue chains charge +1 mana orb',
    abilityName: 'Arc Burst',
    abilityDesc: 'Heavy single-target (80 dmg)',
    abilityCost: 3,
  },
  {
    id: 'rogue',
    name: 'Rogue',
    emoji: '🗡️',
    color: 'gold',
    passive: 'Chains of 5+ grant +50% score',
    abilityName: 'Shadowstep',
    abilityDesc: 'Next attack: +100% dmg & score',
    abilityCost: 3,
  },
  {
    id: 'cleric',
    name: 'Cleric',
    emoji: '✨',
    color: 'success',
    passive: 'Green chains heal +50%',
    abilityName: 'Sanctuary',
    abilityDesc: 'Heal 30 + 2-turn shield',
    abilityCost: 3,
  },
];

export function getClass(id: HeroClass): ClassDef {
  return CLASS_LIST.find(c => c.id === id) ?? CLASS_LIST[0];
}

// XP curve — gentle, cosmetic only.
export function xpForLevel(level: number): number {
  return 100 + (level - 1) * 50;
}

export function levelFromXp(totalXp: number): { level: number; intoLevel: number; needed: number } {
  let level = 1;
  let remaining = totalXp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level += 1;
    if (level > 99) break;
  }
  return { level, intoLevel: remaining, needed: xpForLevel(level) };
}

export function titleForLevel(level: number): string | null {
  if (level >= 30) return 'Dungeon Sovereign';
  if (level >= 20) return 'Rune Master';
  if (level >= 10) return 'Delver';
  if (level >= 5) return 'Apprentice';
  return null;
}
