// ─── Pure helpers that read an active relic loadout and return tweaks ────
// Combat and shard code consume these — relics never reach into engine
// internals directly. Keeps the modifier surface small and auditable.

import type { CombatState } from './combatEngine';

export interface ActiveRelics {
  ids: Set<string>;
}

export function buildActive(slots: (string | null | undefined)[]): ActiveRelics {
  return { ids: new Set(slots.filter((x): x is string => !!x)) };
}

export const has = (a: ActiveRelics, id: string) => a.ids.has(id);

// ── Pre-run modifiers ────────────────────────────────────────────────────
export function getStartingMana(a: ActiveRelics): number {
  return has(a, 'aether_spark') ? 2 : 0;
}

export function getStartingShieldTurns(a: ActiveRelics): number {
  return has(a, 'iron_resolve') ? 1 : 0;
}

export function getTelegraphReadyEarly(a: ActiveRelics): boolean {
  return has(a, 'foresight');
}

export function getSealedTilesSpeedup(a: ActiveRelics): number {
  return has(a, 'keysight') ? 1 : 0;
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
    if (has(a, 'ember_edge') && ctx.redChainCountSoFar === 1) m.bonusDamageMult *= 1.5;
    if (has(a, 'crimson_tide') && ctx.redChainCountSoFar > 0 && ctx.redChainCountSoFar % 5 === 0) m.bonusDamageMult *= 1.75;
    if (has(a, 'executioners_mark') && ctx.enemyHpRatioBeforeHit <= 0.25) m.bonusDamageMult *= 1.3;
    if (has(a, 'desperate_surge') && ctx.hpRatio < 0.3) m.bonusDamageMult *= 1.25;
  }
  if (ctx.chainType === 'blue') {
    if (has(a, 'sapphire_flow') && ctx.length >= 4) m.bonusManaFlat += 1;
  }
  if (ctx.chainType === 'green') {
    if (has(a, 'verdant_heart')) m.bonusHealFlat += ctx.length; // +1 per rune
  }
  if (ctx.chainType === 'gold') {
    if (has(a, 'bulwark')) m.bonusShieldTurns += 1;
  }
  if (has(a, 'quickstep') && ctx.isFirstChainOfRun) m.effectiveLengthBonus += 1;

  return m;
}

// ── Post-kill (Bloodbond) ────────────────────────────────────────────────
export function onEnemyKilled(a: ActiveRelics, state: CombatState): CombatState {
  if (!has(a, 'bloodbond')) return state;
  const heal = Math.min(4, state.maxHp - state.hp);
  if (heal <= 0) return state;
  return { ...state, hp: state.hp + heal };
}

// ── Lethal-damage save (Last Stand) — engine should call before zeroing HP
export interface LastStandResult { saved: boolean; hp: number; }
export function tryLastStand(
  a: ActiveRelics,
  incomingFinalHp: number,
  alreadyUsedThisRun: boolean,
): LastStandResult {
  if (!has(a, 'last_stand') || alreadyUsedThisRun) return { saved: false, hp: incomingFinalHp };
  if (incomingFinalHp <= 0) return { saved: true, hp: 1 };
  return { saved: false, hp: incomingFinalHp };
}

// ── Ability cost (First Light) ───────────────────────────────────────────
export function abilityFreeFirstUse(a: ActiveRelics, abilityUsedThisRun: boolean): boolean {
  return has(a, 'first_light') && !abilityUsedThisRun;
}

// ── Boss-rule incoming damage soften (Cracked Crown) ────────────────────
export function bossRuleSoften(a: ActiveRelics): number {
  return has(a, 'cracked_crown') ? 0.85 : 1;
}

// ── Shrine Ward (early-game incoming damage on turn 1) ──────────────────
export function shrineWardTurn1Mult(a: ActiveRelics, isTurnOne: boolean): number {
  return has(a, 'shrine_ward') && isTurnOne ? 0.9 : 1;
}

// ── Score-end mods ──────────────────────────────────────────────────────
export function compassShardBonus(a: ActiveRelics): number {
  return has(a, 'wanderers_compass') ? 1.15 : 1;
}

export function momentumScoreBonusMult(a: ActiveRelics, longestChain: number): number {
  return has(a, 'momentum') && longestChain >= 4 ? 1.1 : 1;
}
