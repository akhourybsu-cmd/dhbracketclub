import { AbilityDef, AbilityKind } from './types';

export const ABILITIES: Record<AbilityKind, AbilityDef> = {
  orbital: {
    kind: 'orbital',
    name: 'Orbital Strike',
    tagline: 'Massive AoE damage on the leading enemy cluster.',
    cooldownMs: 25_000,
    glyph: '◎',
    color: 'amber',
  },
  emp: {
    kind: 'emp',
    name: 'EMP Pulse',
    tagline: 'Stuns all enemies for 3s and strips shields.',
    cooldownMs: 30_000,
    glyph: 'E',
    color: 'cyan',
  },
};

export const ABILITY_LIST = Object.values(ABILITIES);
