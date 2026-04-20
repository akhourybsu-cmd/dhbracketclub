// Boss Rules — Band 5 (levels 126-150).
//
// Each boss-rule level applies ONE rule that bends a single combat
// expectation. Three rules at launch, deterministically picked from the
// level seed so two players see the exact same boss gimmick.
//
// Mobile-friendly: every rule is one short sentence and only triggers around
// the final enemy or low-HP states, so it composes cleanly with prior bands.
//
// • `last_stand`  — the final enemy is IMMUNE until every other enemy dies.
//                   Teaches target prioritisation.
// • `regenerator` — the final enemy regenerates a small chunk of HP each
//                   player turn (after enemies act). Teaches sustained DPS.
// • `enrager`     — every enemy gains +25% outgoing damage once their own HP
//                   drops below 50%. Teaches "finish them fast".

import type { CombatState } from './combatEngine';
import type { Enemy } from './dungeonGenerator';

export type BossRuleId = 'last_stand' | 'regenerator' | 'enrager';

export interface BossRuleDef {
  id: BossRuleId;
  label: string;
  /** One-liner shown in intro modal + banner. */
  rule: string;
}

export const BOSS_RULES: Record<BossRuleId, BossRuleDef> = {
  last_stand:  { id: 'last_stand',  label: 'Last Stand',  rule: 'The final enemy is immune until every other foe falls.' },
  regenerator: { id: 'regenerator', label: 'Regenerator', rule: 'The final enemy heals 8 HP each turn — burn it down.' },
  enrager:     { id: 'enrager',     label: 'Enraged',     rule: 'Enemies hit 25% harder once below half HP.' },
};

const ORDER: BossRuleId[] = ['last_stand', 'regenerator', 'enrager'];

/**
 * Deterministically pick a boss rule for a milestone level. Returns null if
 * this level isn't a boss-rule level. Boss-rule levels are the milestone
 * beats inside Chapter 3's final band: 130, 140, 150.
 */
export function bossRuleForLevel(level: number): BossRuleId | null {
  if (level < 126 || level > 150) return null;
  // Three boss beats in the band; everything else is a "regular" Band 5 level.
  if (level !== 130 && level !== 140 && level !== 150) return null;
  // 130 → first rule, 140 → second, 150 → third. Predictable & teachable.
  const idx = level === 130 ? 0 : level === 140 ? 1 : 2;
  return ORDER[idx];
}

/** True when the rule blocks damage to a given enemy this instant. */
export function isImmune(rule: BossRuleId | null, enemies: Enemy[], target: Enemy): boolean {
  if (rule !== 'last_stand') return false;
  // Final enemy = last in the array. Immune while any earlier enemy still lives.
  if (enemies.length === 0) return false;
  const last = enemies[enemies.length - 1];
  if (target.id !== last.id) return false;
  return enemies.some(e => e.id !== last.id && e.hp > 0);
}

/** Filter the live-enemy list to only those that are valid damage targets right now. */
export function filterTargetable(rule: BossRuleId | null, enemies: Enemy[]): Enemy[] {
  if (rule !== 'last_stand') return enemies.filter(e => e.hp > 0);
  return enemies.filter(e => e.hp > 0 && !isImmune(rule, enemies, e));
}

/** Apply per-turn boss effects (regen). Returns mutated combat state. */
export function applyBossTurnEffects(state: CombatState, rule: BossRuleId | null): CombatState {
  if (rule !== 'regenerator') return state;
  const enemies = state.enemies.map(e => ({ ...e }));
  const last = enemies[enemies.length - 1];
  if (last && last.hp > 0 && last.hp < last.maxHp) {
    last.hp = Math.min(last.maxHp, last.hp + 8);
  }
  return { ...state, enemies };
}

/** Outgoing damage multiplier for an enemy under enrager when below half HP. */
export function enemyDamageMultiplier(rule: BossRuleId | null, enemy: Enemy): number {
  if (rule !== 'enrager') return 1;
  return enemy.hp > 0 && enemy.hp <= enemy.maxHp / 2 ? 1.25 : 1;
}

export function getBossRule(id: BossRuleId): BossRuleDef {
  return BOSS_RULES[id];
}
