// ─── Pure helpers that read an active relic loadout and return tweaks ────
// Combat and shard code consume these — relics never reach into engine
// internals directly. Keeps the modifier surface small and auditable.
//
// Rank-aware: every effect now reads its scaled value from RANK_EFFECTS in
// relics.ts. All damage/heal/shield outputs are rounded to whole integers.

import type { CombatState } from './combatEngine';
import { effectValue, clampRank } from './relics';

export interface ActiveRelics {
  /** id -> rank (1..5). Presence implies equipped/owned at that rank. */
  ranks: Map<string, number>;
}

/** Build an ActiveRelics from up to 3 equipped slot ids and an optional
 *  collection lookup that resolves each id to its current rank. Slots
 *  without an entry default to rank 1. */
export function buildActive(
  slots: (string | null | undefined)[],
  rankLookup?: Map<string, number> | Record<string, number>,
): ActiveRelics {
  const map = new Map<string, number>();
  const lookup = (id: string): number => {
    if (!rankLookup) return 1;
    if (rankLookup instanceof Map) return clampRank(rankLookup.get(id) ?? 1);
    return clampRank((rankLookup as Record<string, number>)[id] ?? 1);
  };
  for (const id of slots) {
    if (id) map.set(id, lookup(id));
  }
  return { ranks: map };
}

export const has = (a: ActiveRelics, id: string) => a.ranks.has(id);
export const rankOf = (a: ActiveRelics, id: string): number => a.ranks.get(id) ?? 0;

// ── Pre-run modifiers ────────────────────────────────────────────────────
export function getStartingMana(a: ActiveRelics): number {
  if (!has(a, 'aether_spark')) return 0;
  return Math.round(effectValue('aether_spark', rankOf(a, 'aether_spark')));
}

export function getStartingShieldTurns(a: ActiveRelics): number {
  if (!has(a, 'iron_resolve')) return 0;
  return Math.round(effectValue('iron_resolve', rankOf(a, 'iron_resolve')));
}

export function getTelegraphReadyEarly(a: ActiveRelics): number {
  // Returns turns of early reveal (0 if not equipped).
  if (!has(a, 'foresight')) return 0;
  return Math.round(effectValue('foresight', rankOf(a, 'foresight')));
}

export function getSealedTilesSpeedup(a: ActiveRelics): number {
  if (!has(a, 'keysight')) return 0;
  return Math.round(effectValue('keysight', rankOf(a, 'keysight')));
}

// ── Per-chain modifiers (called from RuneDelvePlayPage handleChain) ─────
export interface ChainContext {
  chainType: 'red' | 'blue' | 'green' | 'gold';
  length: number;
  redChainCountSoFar: number;     // including the current one
  isFirstChainOfRun: boolean;
  hpRatio: number;                // 0..1 hero hp / maxHp
  enemyHpRatioBeforeHit: number;  // 0..1 of the targeted enemy
}

export interface ChainMods {
  bonusDamageMult: number;        // 1 = no change
  bonusManaFlat: number;          // extra mana orbs to add (capped by engine)
  bonusHealFlat: number;          // extra HP to heal
  bonusShieldTurns: number;       // extra shield turns to add (gold)
  effectiveLengthBonus: number;   // adds to length AFTER the chain
}

const noop: ChainMods = {
  bonusDamageMult: 1, bonusManaFlat: 0, bonusHealFlat: 0,
  bonusShieldTurns: 0, effectiveLengthBonus: 0,
};

export function computeChainMods(a: ActiveRelics, ctx: ChainContext): ChainMods {
  const m: ChainMods = { ...noop };

  if (ctx.chainType === 'red') {
    if (has(a, 'ember_edge') && ctx.redChainCountSoFar === 1) {
      m.bonusDamageMult *= effectValue('ember_edge', rankOf(a, 'ember_edge'));
    }
    if (has(a, 'crimson_tide') && ctx.redChainCountSoFar > 0 && ctx.redChainCountSoFar % 5 === 0) {
      m.bonusDamageMult *= effectValue('crimson_tide', rankOf(a, 'crimson_tide'));
    }
    if (has(a, 'executioners_mark') && ctx.enemyHpRatioBeforeHit <= 0.25) {
      m.bonusDamageMult *= effectValue('executioners_mark', rankOf(a, 'executioners_mark'));
    }
    if (has(a, 'desperate_surge') && ctx.hpRatio < 0.3) {
      m.bonusDamageMult *= effectValue('desperate_surge', rankOf(a, 'desperate_surge'));
    }
  }
  if (ctx.chainType === 'blue') {
    if (has(a, 'sapphire_flow') && ctx.length >= 4) {
      m.bonusManaFlat += Math.round(effectValue('sapphire_flow', rankOf(a, 'sapphire_flow')));
    }
  }
  if (ctx.chainType === 'green') {
    if (has(a, 'verdant_heart')) {
      // Heal = round(multiplier * length), e.g. R3 (1.2) on len 5 -> 6 HP.
      const mult = effectValue('verdant_heart', rankOf(a, 'verdant_heart'));
      m.bonusHealFlat += Math.round(mult * ctx.length);
    }
  }
  if (ctx.chainType === 'gold') {
    if (has(a, 'bulwark')) {
      m.bonusShieldTurns += Math.round(effectValue('bulwark', rankOf(a, 'bulwark')));
    }
  }
  if (has(a, 'quickstep') && ctx.isFirstChainOfRun) {
    m.effectiveLengthBonus += Math.round(effectValue('quickstep', rankOf(a, 'quickstep')));
  }

  return m;
}

// ── Post-kill (Bloodbond) ────────────────────────────────────────────────
export function onEnemyKilled(a: ActiveRelics, state: CombatState): CombatState {
  if (!has(a, 'bloodbond')) return state;
  const target = Math.round(effectValue('bloodbond', rankOf(a, 'bloodbond')));
  const heal = Math.min(target, state.maxHp - state.hp);
  if (heal <= 0) return state;
  return { ...state, hp: state.hp + heal };
}

// ── Lethal-damage save (Last Stand) — engine should call before zeroing HP
export interface LastStandResult { saved: boolean; hp: number; }
export function tryLastStand(
  a: ActiveRelics,
  incomingFinalHp: number,
  alreadyUsedCount: boolean | number,
): LastStandResult {
  if (!has(a, 'last_stand')) return { saved: false, hp: incomingFinalHp };
  const maxUses = Math.round(effectValue('last_stand', rankOf(a, 'last_stand')));
  const usedCount = typeof alreadyUsedCount === 'boolean' ? (alreadyUsedCount ? 1 : 0) : alreadyUsedCount;
  if (usedCount >= maxUses) return { saved: false, hp: incomingFinalHp };
  if (incomingFinalHp <= 0) return { saved: true, hp: 1 };
  return { saved: false, hp: incomingFinalHp };
}

// ── Ability cost (First Light) ───────────────────────────────────────────
export function abilityFreeFirstUse(a: ActiveRelics, abilityUsedCount: boolean | number): boolean {
  if (!has(a, 'first_light')) return false;
  const freeUses = Math.round(effectValue('first_light', rankOf(a, 'first_light')));
  const used = typeof abilityUsedCount === 'boolean' ? (abilityUsedCount ? 1 : 0) : abilityUsedCount;
  return used < freeUses;
}

// ── Boss-rule incoming damage soften (Cracked Crown) ────────────────────
export function bossRuleSoften(a: ActiveRelics): number {
  if (!has(a, 'cracked_crown')) return 1;
  return effectValue('cracked_crown', rankOf(a, 'cracked_crown'));
}

// ── Shrine Ward (early-game incoming damage on turn 1) ──────────────────
export function shrineWardTurn1Mult(a: ActiveRelics, isTurnOne: boolean): number {
  if (!has(a, 'shrine_ward') || !isTurnOne) return 1;
  return effectValue('shrine_ward', rankOf(a, 'shrine_ward'));
}

// ── Score-end mods ──────────────────────────────────────────────────────
export function compassShardBonus(a: ActiveRelics): number {
  if (!has(a, 'wanderers_compass')) return 1;
  return effectValue('wanderers_compass', rankOf(a, 'wanderers_compass'));
}

export function momentumScoreBonusMult(a: ActiveRelics, longestChain: number): number {
  if (!has(a, 'momentum') || longestChain < 4) return 1;
  return effectValue('momentum', rankOf(a, 'momentum'));
}
