// Boss Rules — Bands 3-5 + new mid-cadence boss/mini-boss tiers.
//
// Six rules total (rotated deterministically by level so each beat feels
// distinct). Three legacy rules remain unchanged on milestones 130/140/150;
// the new three (`splitter`, `phaselock`, `aura`) round out the registry so
// every chapter/mid-chapter boss in the new cadence has its own gimmick.
//
// Mobile-friendly: every rule is a single short sentence and only triggers
// around the final enemy or low-HP states, so it composes cleanly with prior
// bands.

import type { CombatState } from './combatEngine';
import type { Enemy } from './dungeonGenerator';

export type BossRuleId =
  | 'last_stand'
  | 'regenerator'
  | 'enrager'
  | 'splitter'
  | 'phaselock'
  | 'aura';

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
  splitter:    { id: 'splitter',    label: 'Splitter',    rule: 'At half HP the boss splits into two half-strength echoes.' },
  phaselock:   { id: 'phaselock',   label: 'Phase Lock',  rule: 'Every 25% HP lost, the boss phases out for one turn.' },
  aura:        { id: 'aura',        label: 'Dread Aura',  rule: 'Allies of the boss strike 15% harder while it lives.' },
};

// Rotation order used by `bossRuleForChapterLevel`.
const ROTATION: BossRuleId[] = [
  'last_stand', 'regenerator', 'enrager',
  'splitter',   'phaselock',   'aura',
];

// Legacy milestones (Chapter 3 final band): keep their hand-picked rules.
const LEGACY_MILESTONES: Record<number, BossRuleId> = {
  130: 'last_stand',
  140: 'regenerator',
  150: 'enrager',
};

// ─────────────────────────────────────────────────────────────────────────────
// New: tier classification for the boss/mini-boss cadence.
//
//  • mini    → every 10 levels (10, 20, 30…) — promote one enemy: +60% HP,
//              +10% damage, gold ring portrait. No boss rule.
//  • mid     → mid-chapter (25, 75, 125) — heavier promotion (+90% HP),
//              boss rule attached, intro sheet on first visit.
//  • chapter → end of chapter (50, 100, 150) — flagship boss (+120% HP +20%
//              damage), boss rule attached, spawned as wave 2 by the level
//              generator so wave 1 acts as a warm-up gauntlet.
//
// Levels 130 and 140 are preserved as `chapter` so their hand-picked legacy
// rules continue to apply.
// ─────────────────────────────────────────────────────────────────────────────
export type BossKind = 'mini' | 'mid' | 'chapter' | null;

export function bossKindForLevel(level: number): BossKind {
  if (level <= 0) return null;
  if (LEGACY_MILESTONES[level]) return 'chapter';
  if (level === 50 || level === 100 || level === 150) return 'chapter';
  if (level === 25 || level === 75 || level === 125) return 'mid';
  // Mini-boss every 10 levels — but never on a chapter/mid-chapter beat.
  if (level % 10 === 0) return 'mini';
  return null;
}

/**
 * Stat scalars applied by `levelGenerator.ts` to the FINAL enemy slot when a
 * level is a boss tier. Mini-bosses get a lighter bump than mid/chapter.
 */
export function bossStatBoost(kind: BossKind): { hpMul: number; dmgMul: number } {
  switch (kind) {
    case 'mini':    return { hpMul: 1.6, dmgMul: 1.10 };
    case 'mid':     return { hpMul: 1.9, dmgMul: 1.15 };
    case 'chapter': return { hpMul: 2.2, dmgMul: 1.20 };
    default:        return { hpMul: 1,   dmgMul: 1 };
  }
}

/**
 * Display prefix used by `EnemyDisplay` (gold ring + crown chip) and the
 * generator (`Mini-Boss <Name>` / `Boss <Name>`). Returned as the empty
 * string when no tier applies.
 */
export function bossNamePrefix(kind: BossKind): string {
  if (kind === 'mini') return 'Mini-Boss ';
  if (kind === 'mid' || kind === 'chapter') return 'Boss ';
  return '';
}

/**
 * Resolve the boss rule for a given level. Mini-boss tiers never carry a
 * rule (just a stat bump). Legacy milestones stick to their hand-picked
 * rules. Other mid/chapter bosses rotate deterministically through the full
 * 6-rule registry so every flagship feels distinct.
 */
export function bossRuleForLevel(level: number): BossRuleId | null {
  const legacy = LEGACY_MILESTONES[level];
  if (legacy) return legacy;
  const kind = bossKindForLevel(level);
  if (kind === null || kind === 'mini') return null;
  // Rotate by (level / 25) so 25/50/75/100/125 each pick a different rule.
  const idx = Math.floor(level / 25) % ROTATION.length;
  return ROTATION[idx];
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule effect hooks
// ─────────────────────────────────────────────────────────────────────────────

/** True when the rule blocks damage to a given enemy this instant. */
export function isImmune(rule: BossRuleId | null, enemies: Enemy[], target: Enemy): boolean {
  if (rule === 'phaselock' && target.phaseLockTurns && target.phaseLockTurns > 0) return true;
  if (rule !== 'last_stand') return false;
  // Final enemy = last in the array. Immune while any earlier enemy still lives.
  if (enemies.length === 0) return false;
  const last = enemies[enemies.length - 1];
  if (target.id !== last.id) return false;
  return enemies.some(e => e.id !== last.id && e.hp > 0);
}

/** Filter the live-enemy list to only those that are valid damage targets right now. */
export function filterTargetable(rule: BossRuleId | null, enemies: Enemy[]): Enemy[] {
  const alive = enemies.filter(e => e.hp > 0);
  if (rule === 'last_stand' || rule === 'phaselock') {
    return alive.filter(e => !isImmune(rule, enemies, e));
  }
  return alive;
}

/** Apply per-turn boss effects (regen, splitter trigger, phaselock decay). */
export function applyBossTurnEffects(state: CombatState, rule: BossRuleId | null): CombatState {
  if (rule == null) return state;
  let enemies = state.enemies.map(e => ({ ...e }));

  if (rule === 'regenerator') {
    const last = enemies[enemies.length - 1];
    if (last && last.hp > 0 && last.hp < last.maxHp) {
      last.hp = Math.min(last.maxHp, last.hp + 8);
    }
  }

  if (rule === 'phaselock') {
    // Decay any active phase-lock counters.
    enemies = enemies.map(e => (
      e.phaseLockTurns && e.phaseLockTurns > 0
        ? { ...e, phaseLockTurns: Math.max(0, e.phaseLockTurns - 1) }
        : e
    ));
  }

  if (rule === 'splitter') {
    const last = enemies[enemies.length - 1];
    if (last && last.hp > 0 && !last.hasSplit && last.hp <= last.maxHp / 2) {
      last.hasSplit = true;
      const halfHp = Math.max(8, Math.round(last.hp / 2));
      const halfDmg = Math.max(2, Math.round(last.damage * 0.7));
      last.hp = halfHp;
      last.maxHp = halfHp;
      last.damage = halfDmg;
      // Spawn a twin echo right next to the original.
      const twin: Enemy = {
        ...last,
        id: `${last.id}-echo`,
        name: last.name.replace(/^Boss /, 'Echo of '),
        hasSplit: true,
      };
      enemies.splice(enemies.length, 0, twin);
    }
  }

  return { ...state, enemies };
}

/** Outgoing damage multiplier for an enemy under enrager / aura. */
export function enemyDamageMultiplier(rule: BossRuleId | null, enemy: Enemy, allEnemies?: Enemy[]): number {
  if (rule === 'enrager') {
    return enemy.hp > 0 && enemy.hp <= enemy.maxHp / 2 ? 1.25 : 1;
  }
  if (rule === 'aura' && allEnemies) {
    // Boss = last enemy in the array. Allies (everyone except the boss) hit
    // 15% harder while the boss is alive.
    const boss = allEnemies[allEnemies.length - 1];
    if (boss && boss.hp > 0 && enemy.id !== boss.id) return 1.15;
  }
  return 1;
}

/**
 * Hook called after the player chain resolves. Used by `phaselock` to start
 * a one-turn immunity whenever the boss has lost a fresh 25% HP slice since
 * the last activation. Returns the (possibly mutated) enemy list.
 */
export function applyPhaseLockOnDamage(rule: BossRuleId | null, enemies: Enemy[]): Enemy[] {
  if (rule !== 'phaselock' || enemies.length === 0) return enemies;
  const next = enemies.map(e => ({ ...e }));
  const boss = next[next.length - 1];
  if (!boss || boss.hp <= 0) return next;
  // Each 25%-HP threshold triggers exactly once.
  const threshold = boss.maxHp * 0.25;
  const lossSinceLast = (boss.maxHp - boss.hp) - (boss.phaseLockNextAt ?? 0);
  if (lossSinceLast >= threshold && (!boss.phaseLockTurns || boss.phaseLockTurns <= 0)) {
    boss.phaseLockTurns = 1;
    boss.phaseLockNextAt = (boss.phaseLockNextAt ?? 0) + threshold;
  }
  return next;
}

export function getBossRule(id: BossRuleId): BossRuleDef {
  return BOSS_RULES[id];
}
