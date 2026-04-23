// Pure helpers that compute combat-time effects from the active set of
// Daily Challenge modifiers. The play page calls these once per chain / per
// turn so the modifier system stays declarative and easy to balance.
//
// Pairs with `dailyModifiers.ts` (data) and is consumed only when the play
// page detects daily mode via the `?daily=1` URL flag.

import type { DailyModifierId } from './dailyModifiers';

export interface DailyModifierContext {
  active: DailyModifierId[];
}

/** Damage multiplier applied to red chains only (Inferno + Glass Cannon). */
export function dailyDamageMultiplier(active: DailyModifierId[], runeType: string): number {
  let mult = 1;
  if (active.includes('glass_cannon')) mult *= 1.5;
  if (active.includes('inferno') && runeType === 'red') mult *= 1.3;
  return mult;
}

/** Max HP multiplier (Glass Cannon halves HP). */
export function dailyMaxHpMultiplier(active: DailyModifierId[]): number {
  return active.includes('glass_cannon') ? 0.5 : 1;
}

/** Per-turn HP loss (Inferno burns). */
export function dailyHpDrainPerTurn(active: DailyModifierId[]): number {
  return active.includes('inferno') ? 2 : 0;
}

/** Hard cap on chain length (Overcharge: 5). 0 = no cap. */
export function dailyChainCap(active: DailyModifierId[]): number {
  return active.includes('overcharge') ? 5 : 0;
}

/** Mana cost reduction (Overcharge: ability fires at mana 2). Returns required mana. */
export function dailyAbilityManaCost(active: DailyModifierId[], baseCap: number): number {
  return active.includes('overcharge') ? 2 : baseCap;
}

/** Mana refunded per chain (Hourglass). */
export function dailyManaRefundPerChain(active: DailyModifierId[]): number {
  return active.includes('hourglass') ? 1 : 0;
}

/** Turn limit delta (Hourglass: -2). */
export function dailyTurnLimitDelta(active: DailyModifierId[]): number {
  return active.includes('hourglass') ? -2 : 0;
}

/** Shard reward multiplier (Greed). */
export function dailyShardMultiplier(active: DailyModifierId[]): number {
  return active.includes('greed') ? 1.5 : 1;
}

/** Enemy HP multiplier (Greed: 1.25, Ironclad has no extra HP). */
export function dailyEnemyHpMultiplier(active: DailyModifierId[]): number {
  return active.includes('greed') ? 1.25 : 1;
}

/** Ironclad: chains under 4 deal half damage. Returns multiplier. */
export function dailyIroncladDamageMult(active: DailyModifierId[], chainLength: number): number {
  if (!active.includes('ironclad')) return 1;
  return chainLength < 4 ? 0.5 : 1;
}

/** Reflective: % of damage dealt is reflected back at hero. */
export function dailyReflectivePct(active: DailyModifierId[]): number {
  return active.includes('reflective') ? 0.20 : 0;
}

/** True if foresight (telegraphed early reveal, spawn previews) is suppressed. */
export function dailyHidesForesight(active: DailyModifierId[]): boolean {
  return active.includes('fogged');
}
