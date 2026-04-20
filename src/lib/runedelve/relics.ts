// ─── Rune Delve Relics ────────────────────────────────────────────────────
// Permanent unlocks players spend Rune Shards on. Equip up to 3 in their
// loadout (per class) to apply small but meaningful modifiers to a run.
//
// Balance philosophy: every relic is a *modifier*, not a stat multiplier.
// Class identity (passive + ability) still drives playstyle. Relics solve
// specific problems or favour a build — they never trivialise a chapter.

import type { HeroClass } from './classConfig';

export type RelicCategory = 'offense' | 'mana' | 'survival' | 'board' | 'tempo' | 'objective';
export type RelicTier = 1 | 2 | 3;

export interface RelicDef {
  id: string;
  name: string;
  category: RelicCategory;
  tier: RelicTier;
  cost: number;       // Rune Shards
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
