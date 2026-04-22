// ─── Rune Delve Relics ────────────────────────────────────────────────────
// Permanent unlocks players spend Rune Shards on. Equip up to 3 in their
// loadout (per class) to apply small but meaningful modifiers to a run.
//
// Balance philosophy: every relic is a *modifier*, not a stat multiplier.
// Class identity (passive + ability) still drives playstyle. Relics solve
// specific problems or favour a build — they never trivialise a chapter.
//
// ── Ranks (R1 base → R5 max) ───────────────────────────────────────────────
// Owned relics can be upgraded with shards. Each rank applies a small bump
// (≤10–15% of base). All damage/heal/shield outputs round to whole integers.

import type { HeroClass } from './classConfig';

export type RelicCategory = 'offense' | 'mana' | 'survival' | 'board' | 'tempo' | 'objective';
export type RelicTier = 1 | 2 | 3;

export interface RelicDef {
  id: string;
  name: string;
  category: RelicCategory;
  tier: RelicTier;
  cost: number;       // Rune Shards (R1 unlock cost)
  icon: string;       // emoji
  description: string;
  flavor?: string;
}

export const RELIC_CATALOG: RelicDef[] = [
  // ── Tier 1 — gentle helpers (chapter 1+) ──────────────────────────────
  { id: 'ember_edge',       name: 'Ember Edge',        category: 'offense',   tier: 1, cost: 100, icon: '🔥', description: 'First red chain each run deals +50% damage.' },
  { id: 'aether_spark',     name: 'Aether Spark',      category: 'mana',      tier: 1, cost: 100, icon: '💠', description: 'Start each run with 2 mana.' },
  { id: 'iron_resolve',     name: 'Iron Resolve',      category: 'survival',  tier: 1, cost: 120, icon: '🛡️', description: 'Start each run with a 1-turn shield.' },
  { id: 'verdant_heart',    name: 'Verdant Heart',     category: 'survival',  tier: 1, cost: 100, icon: '🌿', description: 'Green chains heal +1 HP per rune.' },
  { id: 'keysight',         name: 'Keysight',          category: 'board',     tier: 1, cost: 120, icon: '🗝️', description: 'Sealed tiles unlock 1 turn faster.' },
  { id: 'quickstep',        name: 'Quickstep',         category: 'tempo',     tier: 1, cost: 110, icon: '👣', description: 'First chain each run counts as +1 length.' },
  { id: 'shrine_ward',      name: 'Shrine Ward',       category: 'objective', tier: 1, cost: 130, icon: '🕯️', description: 'Boss & elite damage to you reduced 10% on turn 1.' },
  { id: 'wanderers_compass',name: "Wanderer's Compass",category: 'objective', tier: 1, cost: 150, icon: '🧭', description: '+15% Rune Shards from this run.' },

  // ── Tier 2 — mechanic-aware (chapter 2+) ──────────────────────────────
  { id: 'crimson_tide',     name: 'Crimson Tide',      category: 'offense',   tier: 2, cost: 280, icon: '🩸', description: 'Every 5th red chain deals +75% damage.' },
  { id: 'sapphire_flow',    name: 'Sapphire Flow',     category: 'mana',      tier: 2, cost: 300, icon: '💎', description: 'Blue chains grant +1 mana on chains of 4+.' },
  { id: 'last_stand',       name: 'Last Stand',        category: 'survival',  tier: 2, cost: 380, icon: '💔', description: 'Once per run, survive lethal damage at 1 HP.' },
  { id: 'cleansing_touch',  name: 'Cleansing Touch',   category: 'board',     tier: 2, cost: 320, icon: '✨', description: 'First corrupted source cleared each run is free (no HP cost).' },
  { id: 'momentum',         name: 'Momentum',          category: 'tempo',     tier: 2, cost: 280, icon: '⚡', description: "Rogue's chain bonus threshold becomes 4+ (was 5+). Other classes: chains of 4+ score +10%." },
  { id: 'foresight',        name: 'Foresight',         category: 'objective', tier: 2, cost: 350, icon: '👁️', description: 'Telegraphed enemy intents reveal 1 turn earlier.' },
  { id: 'bulwark',          name: 'Bulwark',           category: 'survival',  tier: 2, cost: 320, icon: '🪨', description: 'Gold chains grant +1 shield turn.' },
  { id: 'spiked_aegis',     name: 'Spiked Aegis',      category: 'survival',  tier: 2, cost: 340, icon: '🌵', description: 'Shield reflects more damage back at attackers (+10% / +20% / +35%).' },

  // ── Tier 3 — specialised synergy (chapter 3+) ─────────────────────────
  { id: 'executioners_mark',name: "Executioner's Mark",category: 'offense',   tier: 3, cost: 600, icon: '🎯', description: '+30% damage vs enemies below 25% HP.' },
  { id: 'first_light',      name: 'First Light',       category: 'mana',      tier: 3, cost: 650, icon: '☀️', description: 'First class ability each run is free (costs 0 mana).' },
  { id: 'bloodbond',        name: 'Bloodbond',         category: 'survival',  tier: 3, cost: 700, icon: '❤️', description: 'Killing an enemy heals 4 HP.' },
  { id: 'desperate_surge',  name: 'Desperate Surge',   category: 'tempo',     tier: 3, cost: 600, icon: '💢', description: 'Below 30% HP: red chains deal +25% damage.' },
  { id: 'cracked_crown',    name: 'Cracked Crown',     category: 'objective', tier: 3, cost: 750, icon: '👑', description: 'Boss-rule damage modifiers softened by 15%.' },
];

export const RELIC_BY_ID: Record<string, RelicDef> = Object.fromEntries(RELIC_CATALOG.map(r => [r.id, r]));

export function getRelic(id: string | null | undefined): RelicDef | null {
  if (!id) return null;
  return RELIC_BY_ID[id] ?? null;
}

export function relicsByTier(tier: RelicTier): RelicDef[] {
  return RELIC_CATALOG.filter(r => r.tier === tier);
}

export function relicsByCategory(cat: RelicCategory): RelicDef[] {
  return RELIC_CATALOG.filter(r => r.category === cat);
}

// Tier unlock — gated by chapter (every 50 levels = 1 chapter).
export function tierUnlockedForChapter(tier: RelicTier, chapter: number): boolean {
  if (tier === 1) return true;
  if (tier === 2) return chapter >= 2;
  return chapter >= 3;
}

export const CATEGORY_META: Record<RelicCategory, { label: string; emoji: string; hint: string }> = {
  offense:   { label: 'Offense',   emoji: '⚔️', hint: 'Damage & elite hunting' },
  mana:      { label: 'Mana',      emoji: '💠', hint: 'Ability charge & casts' },
  survival:  { label: 'Survival',  emoji: '🛡️', hint: 'Health, shields & life-saves' },
  board:     { label: 'Board',     emoji: '🧩', hint: 'Hazards & tile control' },
  tempo:     { label: 'Tempo',     emoji: '⚡', hint: 'Chain bonuses & efficiency' },
  objective: { label: 'Utility',   emoji: '🎯', hint: 'Objectives & boss aid' },
};

// All relics are class-agnostic in MVP. A future pass can gate certain
// relics to a specific class via this helper.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function relicAllowedForClass(_relic: RelicDef, _cls: HeroClass): boolean {
  return true;
}

// ─── Ranks ────────────────────────────────────────────────────────────────

export const MAX_RANK = 5;

/** Cost in shards to upgrade FROM (rank-1) TO `rank`. R1 is the unlock cost,
 *  not a rank-up. Returns 0 if rank <= 1 or rank > MAX_RANK. */
export function rankCost(baseCost: number, rank: number): number {
  if (rank <= 1 || rank > MAX_RANK) return 0;
  // rankCost(rank) = round(baseCost * 0.6 * 2^(rank-2))
  return Math.round(baseCost * 0.6 * Math.pow(2, rank - 2));
}

export function totalRankCost(baseCost: number, throughRank: number): number {
  let sum = 0;
  for (let r = 2; r <= Math.min(MAX_RANK, throughRank); r++) sum += rankCost(baseCost, r);
  return sum;
}

/** Per-rank effect values. Index 0 = R1 (base), index 4 = R5 (max).
 *  Multipliers are decimals; flat values are integers. */
export type RankTable = readonly [number, number, number, number, number];

export const RANK_EFFECTS: Record<string, RankTable> = {
  // Offense (multipliers — small +0.05 bumps)
  ember_edge:        [1.50, 1.55, 1.60, 1.65, 1.70],
  crimson_tide:      [1.75, 1.80, 1.85, 1.90, 1.95],
  executioners_mark: [1.30, 1.34, 1.38, 1.42, 1.46],
  desperate_surge:   [1.25, 1.29, 1.33, 1.37, 1.41],

  // Mana (flat — integer breakpoints)
  aether_spark:      [2,    2,    2,    3,    3   ],
  sapphire_flow:     [1,    1,    1,    2,    2   ],
  first_light:       [1,    1,    1,    1,    2   ], // free uses

  // Survival
  iron_resolve:      [1,    1,    2,    2,    2   ], // shield turns
  verdant_heart:     [1.0,  1.1,  1.2,  1.3,  1.4 ], // heal multiplier on length
  bloodbond:         [4,    5,    5,    6,    6   ], // HP heal on kill
  last_stand:        [1,    1,    1,    1,    2   ], // uses per run
  bulwark:           [1,    1,    1,    2,    2   ], // shield turns added on gold
  spiked_aegis:      [1.10, 1.15, 1.20, 1.28, 1.35], // thorns multiplier (composes with class base)

  // Board / tempo / utility
  keysight:          [1,    1,    1,    2,    2   ], // sealed speedup turns
  cleansing_touch:   [1,    1,    1,    1,    2   ], // free clears
  quickstep:         [1,    1,    1,    2,    2   ], // length bonus on first chain
  momentum:          [1.10, 1.12, 1.14, 1.16, 1.18],
  foresight:         [1,    1,    1,    2,    2   ], // turns of early reveal
  shrine_ward:       [0.90, 0.88, 0.86, 0.84, 0.82], // damage multiplier (lower = better)
  wanderers_compass: [1.15, 1.18, 1.21, 1.24, 1.27],
  cracked_crown:     [0.85, 0.83, 0.81, 0.79, 0.77], // boss soften (lower = better)
};

export function clampRank(rank: number | null | undefined): number {
  if (!rank || rank < 1) return 1;
  if (rank > MAX_RANK) return MAX_RANK;
  return Math.floor(rank);
}

/** Resolve an effect value for a relic + rank. Falls back to R1 if missing. */
export function effectValue(relicId: string, rank: number): number {
  const table = RANK_EFFECTS[relicId];
  if (!table) return 1;
  return table[clampRank(rank) - 1];
}
