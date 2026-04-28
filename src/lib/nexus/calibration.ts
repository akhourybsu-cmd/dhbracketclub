// Nexus Defense — mission calibration layer
// Canonical mission definitions remain the baseline. A calibration row may
// override values; final live mission = applyCalibration(base, calibration).

import { MissionDef, EnemyKind } from './types';

export interface MissionCalibration {
  mission_id: number;
  start_energy_delta: number;
  base_hp_delta: number;
  reward_cores_delta: number;
  wave_reward_mult: number;
  enemy_hp_mult: number;
  enemy_shield_mult: number;
  enemy_speed_mult: number;
  boss_hp_mult: number;
  boss_shield_mult: number;
  spawn_count_mult: number;
  spawn_interval_mult: number;
  spawn_delay_mult: number;
  notes?: string | null;
}

export const DEFAULT_CALIBRATION: Omit<MissionCalibration, 'mission_id'> = {
  start_energy_delta: 0,
  base_hp_delta: 0,
  reward_cores_delta: 0,
  wave_reward_mult: 1,
  enemy_hp_mult: 1,
  enemy_shield_mult: 1,
  enemy_speed_mult: 1,
  boss_hp_mult: 1,
  boss_shield_mult: 1,
  spawn_count_mult: 1,
  spawn_interval_mult: 1,
  spawn_delay_mult: 1,
  notes: null,
};

// Tunable bounds shown to admins (also enforced by DB CHECK constraints).
export const CALIBRATION_BOUNDS = {
  start_energy_delta: { min: -300, max: 300, step: 10 },
  base_hp_delta: { min: -25, max: 50, step: 1 },
  reward_cores_delta: { min: -100, max: 200, step: 5 },
  wave_reward_mult: { min: 0.25, max: 3, step: 0.05 },
  enemy_hp_mult: { min: 0.25, max: 3, step: 0.05 },
  enemy_shield_mult: { min: 0, max: 3, step: 0.05 },
  enemy_speed_mult: { min: 0.5, max: 2, step: 0.05 },
  boss_hp_mult: { min: 0.25, max: 3, step: 0.05 },
  boss_shield_mult: { min: 0, max: 3, step: 0.05 },
  spawn_count_mult: { min: 0.25, max: 3, step: 0.05 },
  spawn_interval_mult: { min: 0.25, max: 3, step: 0.05 },
  spawn_delay_mult: { min: 0, max: 3, step: 0.05 },
} as const;

export type CalibrationField = keyof typeof CALIBRATION_BOUNDS;

export function clampCalibrationValue(field: CalibrationField, raw: number): number {
  const b = CALIBRATION_BOUNDS[field];
  if (!Number.isFinite(raw)) return DEFAULT_CALIBRATION[field as keyof typeof DEFAULT_CALIBRATION] as number;
  return Math.min(b.max, Math.max(b.min, raw));
}

export function isOverridden(cal: MissionCalibration | null | undefined, field: CalibrationField): boolean {
  if (!cal) return false;
  const def = DEFAULT_CALIBRATION[field as keyof typeof DEFAULT_CALIBRATION] as number;
  return Math.abs((cal[field] as number) - def) > 1e-6;
}

export function withDefaults(missionId: number, partial?: Partial<MissionCalibration>): MissionCalibration {
  return { mission_id: missionId, ...DEFAULT_CALIBRATION, ...(partial ?? {}) };
}

/**
 * Resolve the final live mission given a base + calibration.
 * Applies wave-level multipliers safely (rounding, min counts of 1, min interval 100ms).
 * Enemy HP/shield/speed multipliers are NOT applied here — the engine receives them
 * separately so spawn-time enemy stat scaling stays explicit and testable.
 */
export function applyCalibration(base: MissionDef, cal?: MissionCalibration | null): MissionDef {
  if (!cal) return base;
  const startEnergy = Math.max(0, base.startEnergy + cal.start_energy_delta);
  const baseHp = Math.max(1, base.baseHp + cal.base_hp_delta);
  const rewardCores = Math.max(0, base.rewardCores + cal.reward_cores_delta);

  const waves = base.waves.map(w => ({
    ...w,
    rewardEnergy: Math.max(0, Math.round(w.rewardEnergy * cal.wave_reward_mult)),
    spawns: w.spawns.map(sp => ({
      ...sp,
      // Never drop a spawn group to zero accidentally.
      count: Math.max(1, Math.round(sp.count * cal.spawn_count_mult)),
      // Floor interval at 100ms to keep simulator stable.
      intervalMs: Math.max(100, Math.round(sp.intervalMs * cal.spawn_interval_mult)),
      delayMs: sp.delayMs == null ? sp.delayMs : Math.max(0, Math.round(sp.delayMs * cal.spawn_delay_mult)),
    })),
  }));

  return { ...base, startEnergy, baseHp, rewardCores, waves };
}

/** Per-enemy multipliers that the battle engine applies at spawn-time. */
export interface EnemyMods {
  hpMult: Record<EnemyKind, number>;
  shieldMult: Record<EnemyKind, number>;
  speedMult: number;
}

export function buildEnemyMods(cal?: MissionCalibration | null): EnemyMods {
  const c = cal ?? withDefaults(0);
  const allEnemies: EnemyKind[] = ['drone', 'walker', 'shielded', 'stealth', 'boss'];
  const hpMult = {} as Record<EnemyKind, number>;
  const shieldMult = {} as Record<EnemyKind, number>;
  for (const k of allEnemies) {
    if (k === 'boss') {
      hpMult[k] = c.boss_hp_mult;
      shieldMult[k] = c.boss_shield_mult;
    } else {
      hpMult[k] = c.enemy_hp_mult;
      shieldMult[k] = c.enemy_shield_mult;
    }
  }
  return { hpMult, shieldMult, speedMult: c.enemy_speed_mult };
}
