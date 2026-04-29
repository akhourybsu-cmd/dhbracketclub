// Nexus Defense — Effective value resolver
//
// Combines: base mission + calibration overrides + active mission modifiers
// into the final live values an admin/player will actually experience.
//
// Pure functions, fully testable, no React.

import { ABILITIES } from './abilities';
import { MissionCalibration, DEFAULT_CALIBRATION } from './calibration';
import { aggregateModifiers, AggregatedModifierEffects, resolveModifiers, ModifierDef } from './modifiers';
import { TOWERS } from './towers';
import { AbilityKind, EnemyKind, MissionDef, TowerKind } from './types';

const ENEMY_KINDS: EnemyKind[] = ['drone', 'walker', 'shielded', 'stealth', 'boss'];
const TOWER_KINDS: TowerKind[] = ['pulse', 'arc', 'cryo', 'rail'];
const ABILITY_KINDS: AbilityKind[] = ['orbital', 'emp'];

export interface ScalarBreakdown {
  /** "additive" → final = base + cal + mod ; "mult" → final = base × cal × mod */
  mode: 'additive' | 'mult';
  base: number;
  calibration: number; // delta (additive) or multiplier (mult)
  modifier: number;    // delta (additive) or multiplier (mult)
  final: number;
}

export interface EffectiveMission {
  mission: MissionDef;
  modifiers: ModifierDef[];
  agg: AggregatedModifierEffects;
  // Mission-level scalars
  startEnergy: ScalarBreakdown;
  baseHp: ScalarBreakdown;
  rewardCores: ScalarBreakdown;
  // Enemy / boss multiplicative scalars (base = 1.0)
  enemyHp: Record<EnemyKind, ScalarBreakdown>;
  enemyShield: Record<EnemyKind, ScalarBreakdown>;
  enemySpeed: ScalarBreakdown;
  bossHp: ScalarBreakdown;
  bossShield: ScalarBreakdown;
  // Spawn pacing (calibration-only multipliers, included for completeness)
  spawnCount: ScalarBreakdown;
  spawnInterval: ScalarBreakdown;
  spawnDelay: ScalarBreakdown;
  // Wave reward
  waveReward: ScalarBreakdown;
  // Economy
  bountyMult: ScalarBreakdown;
  // Towers
  towerCost: Record<TowerKind, ScalarBreakdown>;
  towerDamage: Record<TowerKind, ScalarBreakdown>;
  // Abilities (cooldown multiplier; final ms shown separately)
  abilityCooldown: Record<AbilityKind, ScalarBreakdown>;
  abilityCooldownMs: Record<AbilityKind, { baseMs: number; finalMs: number }>;
  // Shield regen by kind (modifier-only)
  shieldRegen: Partial<Record<EnemyKind, number>>;
  // Resolved waves with final counts/intervals/delays/rewards
  waves: Array<{
    index: number;
    rewardEnergy: { base: number; final: number };
    totalCount: { base: number; final: number };
    spawns: Array<{
      enemy: EnemyKind;
      count: { base: number; final: number };
      intervalMs: { base: number; final: number };
      delayMs: { base?: number; final?: number };
    }>;
  }>;
  warnings: EffectiveWarning[];
}

export interface EffectiveWarning {
  level: 'info' | 'warn' | 'danger';
  label: string;
  detail: string;
}

function additive(base: number, cal: number, mod: number, floor = 0): ScalarBreakdown {
  return { mode: 'additive', base, calibration: cal, modifier: mod, final: Math.max(floor, base + cal + mod) };
}

function mult(base: number, cal: number, mod: number): ScalarBreakdown {
  return { mode: 'mult', base, calibration: cal, modifier: mod, final: base * cal * mod };
}

export function resolveEffective(
  baseMission: MissionDef,
  cal: MissionCalibration,
): EffectiveMission {
  const defs = resolveModifiers(baseMission.modifierIds);
  const agg = aggregateModifiers(defs);

  // Engine applies calibration first (clamped ≥0), then adds modifier delta. Match exactly.
  const startEnergyAfterCal = Math.max(0, baseMission.startEnergy + cal.start_energy_delta);
  const startEnergy: ScalarBreakdown = {
    mode: 'additive',
    base: baseMission.startEnergy,
    calibration: cal.start_energy_delta,
    modifier: agg.startEnergyDelta,
    final: Math.max(0, startEnergyAfterCal + agg.startEnergyDelta),
  };
  const baseHp = additive(baseMission.baseHp, cal.base_hp_delta, 0, 1);
  const rewardCores = additive(baseMission.rewardCores, cal.reward_cores_delta, 0, 0);

  // Per-kind enemy HP / shield
  const enemyHp = {} as Record<EnemyKind, ScalarBreakdown>;
  const enemyShield = {} as Record<EnemyKind, ScalarBreakdown>;
  for (const k of ENEMY_KINDS) {
    const calHp = k === 'boss' ? cal.boss_hp_mult : cal.enemy_hp_mult;
    const calSh = k === 'boss' ? cal.boss_shield_mult : cal.enemy_shield_mult;
    enemyHp[k] = mult(1, calHp, agg.enemyHpMult[k]);
    enemyShield[k] = mult(1, calSh, agg.enemyShieldMult[k]);
  }
  const enemySpeed = mult(1, cal.enemy_speed_mult, agg.enemySpeedMult);
  const bossHp = mult(1, cal.boss_hp_mult, agg.enemyHpMult.boss * agg.bossHpMult);
  const bossShield = mult(1, cal.boss_shield_mult, agg.enemyShieldMult.boss);

  const spawnCount = mult(1, cal.spawn_count_mult, 1);
  const spawnInterval = mult(1, cal.spawn_interval_mult, 1);
  const spawnDelay = mult(1, cal.spawn_delay_mult, 1);
  const waveReward = mult(1, cal.wave_reward_mult, 1);
  const bountyMult = mult(1, 1, agg.bountyMult);

  const towerCost = {} as Record<TowerKind, ScalarBreakdown>;
  const towerDamage = {} as Record<TowerKind, ScalarBreakdown>;
  for (const k of TOWER_KINDS) {
    // Engine: Math.max(1, Math.round(cost * mod)) — match exactly so admin sees true charged price.
    const c = mult(TOWERS[k].cost, 1, agg.towerCostMult[k]);
    c.final = Math.max(1, Math.round(c.final));
    towerCost[k] = c;
    // Engine: Math.max(1, Math.round(baseDamage * dmgMod)) at fire-time.
    const d = mult(TOWERS[k].damage, 1, agg.towerDamageMult[k]);
    d.final = Math.max(1, Math.round(d.final));
    towerDamage[k] = d;
  }
  const abilityCooldown = {} as Record<AbilityKind, ScalarBreakdown>;
  const abilityCooldownMs = {} as Record<AbilityKind, { baseMs: number; finalMs: number }>;
  for (const k of ABILITY_KINDS) {
    const baseMs = ABILITIES[k].cooldownMs;
    abilityCooldown[k] = mult(1, 1, agg.abilityCooldownMult[k]);
    // Engine: Math.max(1000, Math.round(def.cooldownMs * mult)) — apply same floor.
    const finalMs = Math.max(1000, Math.round(baseMs * agg.abilityCooldownMult[k]));
    abilityCooldownMs[k] = { baseMs, finalMs };
  }

  // Resolved waves
  const waves = baseMission.waves.map(w => {
    const finalReward = Math.max(0, Math.round(w.rewardEnergy * cal.wave_reward_mult));
    const spawns = w.spawns.map(sp => ({
      enemy: sp.enemy,
      count: {
        base: sp.count,
        final: Math.max(1, Math.round(sp.count * cal.spawn_count_mult)),
      },
      intervalMs: {
        base: sp.intervalMs,
        final: Math.max(100, Math.round(sp.intervalMs * cal.spawn_interval_mult)),
      },
      delayMs: {
        base: sp.delayMs,
        final: sp.delayMs == null ? undefined : Math.max(0, Math.round(sp.delayMs * cal.spawn_delay_mult)),
      },
    }));
    return {
      index: w.index,
      rewardEnergy: { base: w.rewardEnergy, final: finalReward },
      totalCount: {
        base: w.spawns.reduce((a, s) => a + s.count, 0),
        final: spawns.reduce((a, s) => a + s.count.final, 0),
      },
      spawns,
    };
  });

  const warnings = computeWarnings({
    baseMission, cal, agg, enemyHp, enemyShield, enemySpeed, bossHp,
    abilityCooldown, towerCost, towerDamage, startEnergy, waveReward, bountyMult,
  });

  return {
    mission: baseMission,
    modifiers: defs,
    agg,
    startEnergy, baseHp, rewardCores,
    enemyHp, enemyShield, enemySpeed,
    bossHp, bossShield,
    spawnCount, spawnInterval, spawnDelay,
    waveReward, bountyMult,
    towerCost, towerDamage,
    abilityCooldown, abilityCooldownMs,
    shieldRegen: agg.shieldRegen,
    waves,
    warnings,
  };
}

function computeWarnings(args: {
  baseMission: MissionDef;
  cal: MissionCalibration;
  agg: AggregatedModifierEffects;
  enemyHp: Record<EnemyKind, ScalarBreakdown>;
  enemyShield: Record<EnemyKind, ScalarBreakdown>;
  enemySpeed: ScalarBreakdown;
  bossHp: ScalarBreakdown;
  abilityCooldown: Record<AbilityKind, ScalarBreakdown>;
  towerCost: Record<TowerKind, ScalarBreakdown>;
  towerDamage: Record<TowerKind, ScalarBreakdown>;
  startEnergy: ScalarBreakdown;
  waveReward: ScalarBreakdown;
  bountyMult: ScalarBreakdown;
}): EffectiveWarning[] {
  const out: EffectiveWarning[] = [];
  const { cal, agg, enemyHp, enemySpeed, bossHp, abilityCooldown, towerCost, startEnergy, waveReward, bountyMult, baseMission } = args;

  // Enemy durability pressure (worst non-boss kind)
  const worstHp = Math.max(enemyHp.drone.final, enemyHp.walker.final, enemyHp.shielded.final, enemyHp.stealth.final);
  if (worstHp >= 1.5) {
    out.push({
      level: worstHp >= 2 ? 'danger' : 'warn',
      label: 'Enemy durability ↑',
      detail: `Effective enemy HP up to ×${worstHp.toFixed(2)} (calibration × modifier).`,
    });
  } else if (worstHp <= 0.7) {
    out.push({ level: 'info', label: 'Enemies fragile', detail: `Effective enemy HP as low as ×${worstHp.toFixed(2)}.` });
  }

  if (bossHp.final >= 1.5 && baseMission.isBoss) {
    out.push({
      level: bossHp.final >= 2 ? 'danger' : 'warn',
      label: 'Boss scaling high',
      detail: `Boss HP ×${bossHp.final.toFixed(2)} after calibration + modifiers.`,
    });
  }

  if (enemySpeed.final >= 1.25) {
    out.push({ level: 'warn', label: 'Enemies fast', detail: `Enemy speed ×${enemySpeed.final.toFixed(2)}.` });
  }

  // Economy pressure
  const economyDown = (waveReward.final < 0.85) || (cal.start_energy_delta + agg.startEnergyDelta <= -60) || (Object.values(towerCost).some(c => c.final / TOWERS_DEFAULT_COST(c) >= 1.2));
  if (economyDown) {
    out.push({ level: 'warn', label: 'Economy reduced', detail: 'Lower rewards or higher tower costs leave less margin.' });
  }
  const economyUp = (bountyMult.final >= 1.2) && (startEnergy.final >= startEnergy.base + 60);
  if (economyUp) {
    out.push({ level: 'info', label: 'Economy generous', detail: 'Bonus salvage + extra start energy stacked.' });
  }

  // Ability access
  const worstCd = Math.max(abilityCooldown.orbital.final, abilityCooldown.emp.final);
  if (worstCd >= 1.25) {
    out.push({ level: 'warn', label: 'Abilities slowed', detail: `Commander cooldown ×${worstCd.toFixed(2)}.` });
  } else if (worstCd <= 0.8) {
    out.push({ level: 'info', label: 'Abilities accelerated', detail: `Commander cooldown ×${worstCd.toFixed(2)}.` });
  }

  // Combined pressure heuristic
  const pressure =
    (worstHp - 1) * 1.0 +
    (enemySpeed.final - 1) * 1.0 +
    (bossHp.final - 1) * 0.5 +
    (worstCd - 1) * 0.6 +
    (1 - waveReward.final) * 0.6;
  if (pressure >= 0.7) {
    out.push({ level: 'danger', label: 'High combined pressure', detail: 'Several threat layers stack — verify win-rate stays healthy.' });
  } else if (pressure <= -0.4) {
    out.push({ level: 'info', label: 'Mission may be soft', detail: 'Combined boons may make this trivial.' });
  }

  return out;
}

function TOWERS_DEFAULT_COST(b: ScalarBreakdown): number {
  // base value lives on the breakdown
  return b.base;
}

/** UI helper: format a multiplier like "1.25×" or "—" for 1.0. */
export function fmtMult(n: number): string {
  if (Math.abs(n - 1) < 1e-6) return '—';
  return `${n.toFixed(2)}×`;
}

/** UI helper: format a signed delta like "+40" / "−10" / "—". */
export function fmtDelta(n: number): string {
  if (n === 0) return '—';
  return n > 0 ? `+${n}` : `${n}`;
}
