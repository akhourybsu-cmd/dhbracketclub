import type { Enemy } from './dungeonGenerator';
import type { HeroClass } from './classConfig';
import type { RuneType } from './dungeonGenerator';
import { resolveEnemyAttack, tickIntents } from './telegraph';

export interface CombatState {
  hp: number;
  maxHp: number;
  mana: number; // 0..3
  shieldTurns: number;
  shadowstepActive: boolean;
  enemies: Enemy[];
  turnsRemaining: number;
  totalDamage: number;
  enemiesDefeated: number;
  longestChain: number;
  abilityUsed: boolean;
  rogueBonusTriggered: boolean;
}

export interface ChainResolution {
  type: RuneType;
  length: number;
  damageDealt: number;
  manaGained: number;
  hpHealed: number;
  guardGained: number;
  enemyKills: string[];
}

export const MAX_HP = 100;
export const MAX_MANA = 3;

export function initialCombat(enemies: Enemy[], turns: number): CombatState {
  return {
    hp: MAX_HP,
    maxHp: MAX_HP,
    mana: 0,
    shieldTurns: 0,
    shadowstepActive: false,
    enemies: enemies.map(e => ({ ...e })),
    turnsRemaining: turns,
    totalDamage: 0,
    enemiesDefeated: 0,
    longestChain: 0,
    abilityUsed: false,
    rogueBonusTriggered: false,
  };
}

// Apply chain — return new state + resolution summary.
export function applyChain(
  state: CombatState,
  type: RuneType,
  length: number,
  cls: HeroClass,
): { next: CombatState; resolution: ChainResolution } {
  const next: CombatState = { ...state, enemies: state.enemies.map(e => ({ ...e })) };
  const resolution: ChainResolution = {
    type, length,
    damageDealt: 0, manaGained: 0, hpHealed: 0, guardGained: 0,
    enemyKills: [],
  };
  next.longestChain = Math.max(next.longestChain, length);

  if (type === 'red') {
    let dmg = length * 8;
    if (cls === 'warrior') dmg = Math.round(dmg * 1.25);
    if (next.shadowstepActive) {
      dmg = Math.round(dmg * 2);
      next.shadowstepActive = false;
    }
    // Damage first living enemy.
    const target = next.enemies.find(e => e.hp > 0);
    if (target) {
      const applied = Math.min(dmg, target.hp);
      target.hp -= applied;
      resolution.damageDealt = applied;
      next.totalDamage += applied;
      if (target.hp <= 0) {
        next.enemiesDefeated += 1;
        resolution.enemyKills.push(target.id);
      }
    }
  } else if (type === 'blue') {
    let mana = 1;
    if (cls === 'mage') mana = 2;
    if (length >= 5) mana += 1;
    next.mana = Math.min(MAX_MANA, next.mana + mana);
    resolution.manaGained = mana;
  } else if (type === 'green') {
    let heal = length * 6;
    if (cls === 'cleric') heal = Math.round(heal * 1.5);
    const applied = Math.min(heal, next.maxHp - next.hp);
    next.hp += applied;
    resolution.hpHealed = applied;
  } else if (type === 'gold') {
    next.shieldTurns = Math.max(next.shieldTurns, 1) + Math.floor(length / 3);
    resolution.guardGained = next.shieldTurns;
  }

  if (cls === 'rogue' && length >= 5) {
    next.rogueBonusTriggered = true;
  }

  return { next, resolution };
}

// After player chain, enemies act. Returns next state.
// When `telegraphed` is true, intents tick first, then enemies whose intent
// hit 0 deal a heavy strike (and reset). Otherwise behaves like classic damage.
export function enemiesAttack(state: CombatState, telegraphed = false): CombatState & { heavyFired?: boolean } {
  const ticked = telegraphed ? tickIntents(state.enemies) : state.enemies;
  let next: CombatState = { ...state, enemies: ticked.map(e => ({ ...e })) };
  let heavyFired = false;
  if (telegraphed) {
    const r = resolveEnemyAttack(next.enemies, next.shieldTurns > 0);
    next.enemies = r.enemies;
    heavyFired = r.heavyFired;
    if (next.shieldTurns > 0) next.shieldTurns -= 1;
    next.hp = Math.max(0, next.hp - r.totalDamage);
  } else {
    let totalIncoming = 0;
    for (const e of next.enemies) if (e.hp > 0) totalIncoming += e.damage;
    if (next.shieldTurns > 0) {
      totalIncoming = Math.round(totalIncoming * 0.4);
      next.shieldTurns -= 1;
    }
    next.hp = Math.max(0, next.hp - totalIncoming);
  }
  next.turnsRemaining = Math.max(0, next.turnsRemaining - 1);
  return { ...next, heavyFired };
}

// Always decrement the turn counter at the end of the player's action,
// even if the chain (or ability) killed every enemy and we skip the enemy phase.
// Without this the killing-blow turn doesn't count, inflating "turns remaining" score.
export function endTurn(state: CombatState): CombatState {
  return { ...state, turnsRemaining: Math.max(0, state.turnsRemaining - 1) };
}

export function isRunOver(state: CombatState): { over: boolean; cleared: boolean } {
  const allDead = state.enemies.every(e => e.hp <= 0);
  if (allDead) return { over: true, cleared: true };
  if (state.hp <= 0) return { over: true, cleared: false };
  if (state.turnsRemaining <= 0) return { over: true, cleared: false };
  return { over: false, cleared: false };
}

export function useAbility(state: CombatState, cls: HeroClass): { next: CombatState; ok: boolean } {
  if (state.mana < MAX_MANA) return { next: state, ok: false };
  const next: CombatState = { ...state, mana: 0, abilityUsed: true, enemies: state.enemies.map(e => ({ ...e })) };
  if (cls === 'warrior') {
    // Cleave: 40 dmg to all
    for (const e of next.enemies) {
      if (e.hp > 0) {
        const applied = Math.min(40, e.hp);
        e.hp -= applied;
        next.totalDamage += applied;
        if (e.hp <= 0) next.enemiesDefeated += 1;
      }
    }
  } else if (cls === 'mage') {
    const t = next.enemies.find(e => e.hp > 0);
    if (t) {
      const applied = Math.min(80, t.hp);
      t.hp -= applied;
      next.totalDamage += applied;
      if (t.hp <= 0) next.enemiesDefeated += 1;
    }
  } else if (cls === 'rogue') {
    next.shadowstepActive = true;
  } else if (cls === 'cleric') {
    const heal = Math.min(30, next.maxHp - next.hp);
    next.hp += heal;
    next.shieldTurns = Math.max(next.shieldTurns, 2);
  }
  return { next, ok: true };
}
