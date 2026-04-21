// ─────────────────────────────────────────────────────────────────────────────
// Rune Delve — Enemy Roster (single source of truth for archetypes).
//
// Goals (mobile-first):
// • Every enemy has a clear ROLE and FAMILY so encounters feel varied.
// • HP/damage/threat differ INTENTIONALLY per role:
//     - striker: low HP, hits hard
//     - tank:    high HP, hits softly
//     - swarm:   tiny HP, low damage, expected in pairs
//     - support: low damage, has a non-damage ability
//     - summoner / corrupter / caster: ability-driven, mid stats
//     - defender: shielded; low base damage
//     - controller / boss: signature mechanic
// • A small `ability` id may attach to the archetype. Abilities are defined in
//   `enemyAbilities.ts` and resolved by the combat engine — they only fire on
//   the enemy's own cooldown so the board never feels spammy.
// • Each archetype owns its own combat-log "voice" so the Battle Chronicle
//   reads as distinct flavour rather than copy-pasted lines.
//
// Adding a new archetype: pick a family + role, set HP/damage in the band
// suggested by the role rubric below, give it a chapter (1/2/3), and — only
// if the role calls for it — assign an ability id from enemyAbilities.ts.
// Most enemies should remain ability-less; abilities are the exception.
// ─────────────────────────────────────────────────────────────────────────────

import type { EnemyAbilityId } from './enemyAbilities';

export type EnemyFamily =
  | 'undead'
  | 'beast'
  | 'corrupted'
  | 'cave'
  | 'magical'
  | 'cultist'
  | 'elite'
  | 'boss';

export type EnemyRole =
  | 'striker'      // glass cannon — low HP, high damage
  | 'tank'         // high HP, low damage
  | 'swarm'        // tiny HP, low damage, pack creature
  | 'support'      // buffs/heals allies (low offence)
  | 'summoner'     // adds enemies mid-fight
  | 'corrupter'    // touches the board (corrupt/seal)
  | 'caster'       // mid HP, charged heavy hits (telegraph-friendly)
  | 'defender'     // shields self/others, hard to burst
  | 'controller'   // boss-tier — bends a rule
  | 'minion';      // spawned by summoner; never seeded directly

export interface RosterEntry {
  /** Stable id used in DB rows and combat-log templates. */
  id: string;
  name: string;
  family: EnemyFamily;
  role: EnemyRole;
  /** Lowest chapter this archetype can appear in. 1 / 2 / 3. */
  chapter: 1 | 2 | 3;
  /** Tier 1-5 — used by the level generator to gate by depth. */
  tier: 1 | 2 | 3 | 4 | 5;
  emoji: string;
  /** Pre-scaling base stats. Generator scales these by level. */
  baseHp: number;
  baseDamage: number;
  /** Optional ability id. Most archetypes leave this undefined. */
  ability?: EnemyAbilityId;
  /** Cooldown for the ability (turns between activations). */
  abilityCooldown?: number;
  /** Optional one-line flavour shown when telegraphing the ability. */
  telegraphLabel?: string;
  /** Designer notes — never rendered. */
  notes?: string;
}

// ── Chapter 1 — Ember Caves (simple, iconic, easy to learn) ──────────────────
const CHAPTER_1: RosterEntry[] = [
  {
    id: 'cave_bat', name: 'Cave Bat', family: 'beast', role: 'swarm',
    chapter: 1, tier: 1, emoji: '🦇', baseHp: 45, baseDamage: 4,
    notes: 'Pack swarmer. Often spawns in twos with other low-HP foes.',
  },
  {
    id: 'goblin_scout', name: 'Goblin Scout', family: 'cultist', role: 'striker',
    chapter: 1, tier: 1, emoji: '👹', baseHp: 60, baseDamage: 5,
    notes: 'Iconic Chapter-1 face. No tricks — just hits.',
  },
  {
    id: 'ember_slime', name: 'Ember Slime', family: 'cave', role: 'tank',
    chapter: 1, tier: 1, emoji: '🟢', baseHp: 100, baseDamage: 3,
    notes: 'Soaks damage, hits like a wet noodle. Teaches "burn the tank".',
  },
  {
    id: 'shadow_imp', name: 'Shadow Imp', family: 'magical', role: 'striker',
    chapter: 1, tier: 2, emoji: '😈', baseHp: 55, baseDamage: 7,
    notes: 'Mid-band striker — pressures the player after Goblin Scout.',
  },
  {
    id: 'crystal_spider', name: 'Crystal Spider', family: 'cave', role: 'swarm',
    chapter: 1, tier: 2, emoji: '🕷️', baseHp: 70, baseDamage: 5,
    notes: 'Deep-Chapter-1 swarm; replaces bats once they get tame.',
  },
];

// ── Chapter 2 — Crystal Hollow (more disruptive, tactical) ───────────────────
const CHAPTER_2: RosterEntry[] = [
  {
    id: 'skeleton_warrior', name: 'Skeleton Warrior', family: 'undead', role: 'striker',
    chapter: 2, tier: 2, emoji: '💀', baseHp: 75, baseDamage: 7,
  },
  {
    id: 'rune_wraith', name: 'Rune Wraith', family: 'undead', role: 'corrupter',
    chapter: 2, tier: 3, emoji: '👻', baseHp: 80, baseDamage: 6,
    ability: 'corrupt_tile', abilityCooldown: 3,
    telegraphLabel: 'Corrupting…',
    notes: 'Drops a corrupted rune on a 3-turn cycle. Composes with the Band-3 mechanic.',
  },
  {
    id: 'frost_revenant', name: 'Frost Revenant', family: 'undead', role: 'caster',
    chapter: 2, tier: 3, emoji: '🧊', baseHp: 110, baseDamage: 7,
  },
  {
    id: 'cult_warden', name: 'Cult Warden', family: 'cultist', role: 'support',
    chapter: 2, tier: 3, emoji: '🛡️', baseHp: 90, baseDamage: 4,
    ability: 'shield_self', abilityCooldown: 4,
    telegraphLabel: 'Raising wards…',
    notes: 'Hardens itself every 4 turns. Forces target prioritisation.',
  },
  {
    id: 'cult_chanter', name: 'Cult Chanter', family: 'cultist', role: 'support',
    chapter: 2, tier: 3, emoji: '🕯️', baseHp: 85, baseDamage: 4,
    ability: 'heal_ally', abilityCooldown: 4,
    telegraphLabel: 'Chanting a mend…',
    notes: 'Heals the most-wounded ally. Kill it first or the fight drags.',
  },
  {
    id: 'stone_golem', name: 'Stone Golem', family: 'cave', role: 'tank',
    chapter: 2, tier: 4, emoji: '🗿', baseHp: 150, baseDamage: 8,
  },
];

// ── Chapter 3 — Shattered Vault (layered, dangerous, mechanically rich) ──────
const CHAPTER_3: RosterEntry[] = [
  {
    id: 'cursed_knight', name: 'Cursed Knight', family: 'undead', role: 'defender',
    chapter: 3, tier: 4, emoji: '⚔️', baseHp: 140, baseDamage: 9,
    ability: 'shield_self', abilityCooldown: 3,
    telegraphLabel: 'Bracing…',
  },
  {
    id: 'voidspawn', name: 'Voidspawn', family: 'corrupted', role: 'corrupter',
    chapter: 3, tier: 4, emoji: '🌑', baseHp: 130, baseDamage: 8,
    ability: 'seal_tile', abilityCooldown: 3,
    telegraphLabel: 'Sealing runes…',
    notes: 'Locks runes — composes with Band-1 sealed-tiles play.',
  },
  {
    id: 'bone_summoner', name: 'Bone Summoner', family: 'undead', role: 'summoner',
    chapter: 3, tier: 4, emoji: '🧙', baseHp: 100, baseDamage: 5,
    ability: 'summon_minion', abilityCooldown: 5,
    telegraphLabel: 'Summoning bones…',
    notes: 'Adds a low-HP Bone Husk every 5 turns. Cap on minions handled in code.',
  },
  {
    id: 'shadow_assassin', name: 'Shadow Assassin', family: 'magical', role: 'striker',
    chapter: 3, tier: 4, emoji: '🗡️', baseHp: 95, baseDamage: 12,
    notes: 'Glass cannon — kill fast or take a beating.',
  },
  {
    id: 'arcane_caster', name: 'Arcane Caster', family: 'magical', role: 'caster',
    chapter: 3, tier: 5, emoji: '🔮', baseHp: 130, baseDamage: 9,
    ability: 'heavy_strike', abilityCooldown: 4,
    telegraphLabel: 'Charging Bone Volley…',
    notes: 'Telegraphs a heavy strike on its own cycle (independent of Band 2).',
  },
  {
    id: 'ancient_drake', name: 'Ancient Drake', family: 'boss', role: 'controller',
    chapter: 3, tier: 5, emoji: '🐉', baseHp: 240, baseDamage: 12,
    notes: 'Hard mini-boss profile. Used at boss-rule milestones.',
  },
];

export const ENEMY_ROSTER: RosterEntry[] = [...CHAPTER_1, ...CHAPTER_2, ...CHAPTER_3];

// Spawned by `summon_minion` — never seeded directly. Kept here so the data
// model has a single home, even though no roster picker references it.
export const MINION_BONE_HUSK: RosterEntry = {
  id: 'bone_husk', name: 'Bone Husk', family: 'undead', role: 'minion',
  chapter: 3, tier: 1, emoji: '🦴', baseHp: 35, baseDamage: 3,
  notes: 'Summoned by Bone Summoner. Fragile filler.',
};

export function rosterById(id: string | undefined): RosterEntry | undefined {
  if (!id) return undefined;
  if (id === MINION_BONE_HUSK.id) return MINION_BONE_HUSK;
  return ENEMY_ROSTER.find(e => e.id === id);
}

/**
 * Pool of archetypes legal at a given level. The chapter ramp matches the
 * existing `chapterFor()` thresholds (1: 1-50, 2: 51-100, 3: 101+).
 * `tier` cap mirrors the prior generator so early levels stay friendly.
 */
export function rosterPoolForLevel(level: number): RosterEntry[] {
  const chapter = level <= 50 ? 1 : level <= 100 ? 2 : 3;
  const maxTier = Math.min(5, 1 + Math.floor(level / 8));
  return ENEMY_ROSTER.filter(e => e.chapter <= chapter && e.tier <= maxTier);
}
