// ─────────────────────────────────────────────────────────────────────────────
// Rune Delve — Bestiary helpers.
// Pure data + small label mappers. No React, no DB. The Bestiary page and the
// useBestiary hook compose these with the canonical roster in `enemyRoster.ts`.
// ─────────────────────────────────────────────────────────────────────────────

import type { EnemyFamily, EnemyRole } from './enemyRoster';
import type { EnemyAbilityId } from './enemyAbilities';

/** Short, mobile-friendly flavour text shown on the Bestiary detail card. */
export const ARCHETYPE_FLAVOR: Record<string, string> = {
  cave_bat:        'Leathery wings beat in the dark — they hunt in noisy packs.',
  goblin_scout:    'A wretched tunnel-stalker with a chipped blade and bad breath.',
  ember_slime:     'Slow, soft, and stubborn. Burns more than it bites.',
  shadow_imp:      'A flicker of malice. Strikes fast then giggles into the gloom.',
  crystal_spider:  'Eight legs of jagged quartz, each step a tiny chime.',
  skeleton_warrior:'A revenant of a forgotten guard, still loyal to its rust.',
  rune_wraith:     'It hums the runes you carved — then taints them.',
  frost_revenant:  'Cold as the vault floor. Its silence is the warning.',
  cult_warden:     'Shielded zealot. Hardens its own wards in moments of doubt.',
  cult_chanter:    'Whispers prayers that knit its kin back together.',
  stone_golem:     'A chunk of the Hollow given a slow, patient grudge.',
  cursed_knight:   'An oath unbroken by death — only by your blade.',
  voidspawn:       'A child of the Vault. Where it touches, runes refuse to wake.',
  bone_summoner:   'It cracks ribs into soldiers. Cut it down before the chorus.',
  shadow_assassin: 'Quiet, quick, lethal. Two heartbeats to fell it.',
  arcane_caster:   'It charges spells you can almost read aloud.',
  ancient_drake:   'Older than chapters. Older than maps. Hungry still.',
  bone_husk:       'Borrowed bones, brittle but brave. Easily put down.',
};

/** Human-readable family label used across the Bestiary UI. */
export const FAMILY_LABEL: Record<EnemyFamily, string> = {
  undead:    'Undead',
  beast:     'Beast',
  corrupted: 'Corrupted',
  cave:      'Cave',
  magical:   'Magical',
  cultist:   'Cultist',
  elite:     'Elite',
  boss:      'Boss',
};

/** Family color tokens — tied to existing semantic tokens. */
export const FAMILY_COLOR: Record<EnemyFamily, string> = {
  undead:    'hsl(280 70% 65%)',
  beast:     'hsl(28 96% 60%)',
  corrupted: 'hsl(310 60% 55%)',
  cave:      'hsl(160 30% 55%)',
  magical:   'hsl(210 90% 65%)',
  cultist:   'hsl(0 70% 60%)',
  elite:     'hsl(var(--gold))',
  boss:      'hsl(var(--destructive))',
};

/** Role label — keeps the language consistent with the design memo. */
export const ROLE_LABEL: Record<EnemyRole, string> = {
  striker:    'Striker',
  tank:       'Tank',
  swarm:      'Swarm',
  support:    'Support',
  summoner:   'Summoner',
  corrupter:  'Corrupter',
  caster:     'Caster',
  defender:   'Defender',
  controller: 'Controller',
  minion:     'Minion',
};

/** One-line summary of what an ability does — used on the detail card. */
export const ABILITY_BLURB: Record<EnemyAbilityId, string> = {
  heavy_strike:  'Charges, then unleashes a heavy hit. Watch the ✦ telegraph.',
  shield_self:   'Hardens its wards — softens incoming damage for a few turns.',
  heal_ally:     'Mends its most-wounded ally. Burn it down first.',
  summon_minion: 'Summons fragile minions to flood the field.',
  corrupt_tile:  'Drops a corrupted rune onto the board.',
  seal_tile:     'Seals a rune so you cannot match through it.',
};
