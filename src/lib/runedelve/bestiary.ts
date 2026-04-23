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
  // ── Expansion drop — Chapter 1 ─────────────────────────────────────────────
  ember_rat:       'Soot-furred and shrill — they pour out of every crack.',
  tunnel_kobold:   'Grins wider than its blade. Loots before the body cools.',
  cave_lizard:     'Tongue like a whip, jaws like a trap.',
  mossback_toad:   'Sits, waits, swallows. Patience is a kind of menace.',
  lantern_moth:    'Drawn to runelight, fragile as paper, twice as loud.',
  goblin_brute:    'Twice the goblin, half the wit. Swings a leg-bone club.',
  cave_crab:       'A walking fortress on eight stubborn legs.',
  ember_pup:       'A scrap-mutt with coal in its lungs.',
  dust_wisp:       'Less ghost than gust. Still bites if it catches you.',
  feral_imp:       'A Shadow Imp gone wilder. Bites first, vanishes second.',
  // ── Expansion drop — Chapter 2 ─────────────────────────────────────────────
  frost_acolyte:   'Robes stiff with rime. Reads the cold like scripture.',
  bone_archer:     'Strings sinew, looses calcified arrows.',
  crystal_construct:'Carved wholesale from the Hollow. Walks because it must.',
  glacial_imp:     'A Shadow Imp dipped in winter. Same grin, sharper edge.',
  cult_seer:       'Sees the next swing — and braces against it.',
  revenant_thrall: 'A leftover soldier with leftover orders.',
  hollow_shrieker: 'Its scream knits torn flesh. Silence it first.',
  quartz_serpent:  'Coils of cold mineral. Strikes faster than you would believe.',
  frost_warden:    'A Cursed Knight in winter livery. Wards harden on a whim.',
  whisper_witch:   'Murmurs to your runes until they listen back.',
  // ── Expansion drop — Chapter 3 ─────────────────────────────────────────────
  void_acolyte:    'A novice of the Vault. Charges spells you almost recognise.',
  wraith_lord:     'A wraith elevated by long, patient hatred.',
  sundered_titan:  'Half-fallen colossus. Still standing. Still angry.',
  void_stalker:    'Two heartbeats and the room rearranges around you.',
  dread_summoner:  'Cracks open the dark and lets it walk in.',
  arcane_warden:   'Threads sigils into armour with each turn.',
  bone_juggernaut: 'A wall of stitched ribs that decided to move.',
  void_seer:       'Reads the wounds of its kin and rewrites them.',
  gloom_wisp:      'A breath of vault-mist with a grudge.',
  vault_revenant:  'It remembers the door you came through.',
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
