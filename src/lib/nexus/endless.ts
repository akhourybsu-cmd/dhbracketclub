// Nexus Defense — Endless / Co-op mission generator
//
// Builds a long, escalating mission used by the cooperative Operation
// mode. Each "endless" mission shares the same engine, grid, towers,
// and abilities as solo play — only the wave list changes.
//
// Design rules:
//   • 30 waves of progressively harder spawns.
//   • A boss appears every 8 waves so every meaningful run produces
//     boss damage that contributes to Operation Phase 3.
//   • Scaling is gentle enough that a small friend group can produce
//     useful contribution from short runs (10–15 minutes), but the
//     final waves remain genuinely difficult.
//
// The generator is pure & deterministic so admin balancing & telemetry
// see the same wave list a player runs.

import { MissionDef, Wave, EnemyKind } from './types';

export const ENDLESS_MISSION_ID = 100;

interface SpawnTemplate {
  enemy: EnemyKind;
  count: number;
  intervalMs: number;
  delayMs?: number;
}

function wave(index: number, rewardEnergy: number, spawns: SpawnTemplate[]): Wave {
  return { index, rewardEnergy, spawns };
}

/** Build the 30-wave endless gauntlet. */
function buildWaves(): Wave[] {
  const waves: Wave[] = [];
  // 1–4: warm-up swarms
  waves.push(wave(0, 40, [{ enemy: 'drone', count: 10, intervalMs: 800 }]));
  waves.push(wave(1, 50, [{ enemy: 'drone', count: 14, intervalMs: 700 }]));
  waves.push(wave(2, 60, [
    { enemy: 'drone', count: 12, intervalMs: 600 },
    { enemy: 'walker', count: 2, intervalMs: 1500, delayMs: 1500 },
  ]));
  waves.push(wave(3, 70, [
    { enemy: 'walker', count: 4, intervalMs: 1200 },
    { enemy: 'drone', count: 10, intervalMs: 500, delayMs: 1000 },
  ]));

  // 5–7: shielded introduction
  waves.push(wave(4, 80, [
    { enemy: 'shielded', count: 4, intervalMs: 1100 },
    { enemy: 'drone', count: 12, intervalMs: 500, delayMs: 1500 },
  ]));
  waves.push(wave(5, 90, [
    { enemy: 'shielded', count: 6, intervalMs: 1000 },
    { enemy: 'walker', count: 4, intervalMs: 1200, delayMs: 1500 },
  ]));
  waves.push(wave(6, 100, [
    { enemy: 'shielded', count: 8, intervalMs: 900 },
    { enemy: 'drone', count: 14, intervalMs: 500, delayMs: 2000 },
  ]));

  // 8: BOSS #1
  waves.push(wave(7, 220, [
    { enemy: 'boss', count: 1, intervalMs: 1000 },
    { enemy: 'shielded', count: 4, intervalMs: 1200, delayMs: 4000 },
  ]));

  // 9–12: stealth + mixed
  waves.push(wave(8, 110, [
    { enemy: 'stealth', count: 5, intervalMs: 1100 },
    { enemy: 'walker', count: 3, intervalMs: 1300, delayMs: 1500 },
  ]));
  waves.push(wave(9, 120, [
    { enemy: 'stealth', count: 7, intervalMs: 1000 },
    { enemy: 'drone', count: 16, intervalMs: 450, delayMs: 1500 },
  ]));
  waves.push(wave(10, 130, [
    { enemy: 'walker', count: 6, intervalMs: 1100 },
    { enemy: 'shielded', count: 6, intervalMs: 1000, delayMs: 1500 },
    { enemy: 'stealth', count: 4, intervalMs: 1100, delayMs: 3000 },
  ]));
  waves.push(wave(11, 140, [
    { enemy: 'drone', count: 20, intervalMs: 400 },
    { enemy: 'walker', count: 6, intervalMs: 1000, delayMs: 1500 },
    { enemy: 'shielded', count: 4, intervalMs: 1100, delayMs: 3500 },
  ]));

  // 13–15: pressure ramp
  waves.push(wave(12, 150, [
    { enemy: 'shielded', count: 10, intervalMs: 850 },
    { enemy: 'walker', count: 6, intervalMs: 1000, delayMs: 1500 },
  ]));
  waves.push(wave(13, 160, [
    { enemy: 'stealth', count: 10, intervalMs: 800 },
    { enemy: 'shielded', count: 6, intervalMs: 950, delayMs: 1500 },
  ]));
  waves.push(wave(14, 170, [
    { enemy: 'walker', count: 10, intervalMs: 900 },
    { enemy: 'drone', count: 22, intervalMs: 350, delayMs: 1500 },
    { enemy: 'shielded', count: 6, intervalMs: 950, delayMs: 4000 },
  ]));

  // 16: BOSS #2
  waves.push(wave(15, 260, [
    { enemy: 'boss', count: 1, intervalMs: 1000 },
    { enemy: 'shielded', count: 6, intervalMs: 1100, delayMs: 4000 },
    { enemy: 'walker', count: 5, intervalMs: 1100, delayMs: 7000 },
  ]));

  // 17–22: heavy mixed
  waves.push(wave(16, 180, [
    { enemy: 'walker', count: 12, intervalMs: 850 },
    { enemy: 'stealth', count: 6, intervalMs: 1000, delayMs: 1500 },
  ]));
  waves.push(wave(17, 190, [
    { enemy: 'shielded', count: 12, intervalMs: 800 },
    { enemy: 'stealth', count: 8, intervalMs: 950, delayMs: 1500 },
  ]));
  waves.push(wave(18, 200, [
    { enemy: 'drone', count: 28, intervalMs: 320 },
    { enemy: 'walker', count: 8, intervalMs: 950, delayMs: 1500 },
    { enemy: 'shielded', count: 6, intervalMs: 950, delayMs: 4000 },
  ]));
  waves.push(wave(19, 210, [
    { enemy: 'walker', count: 12, intervalMs: 800 },
    { enemy: 'stealth', count: 10, intervalMs: 900, delayMs: 1500 },
  ]));
  waves.push(wave(20, 220, [
    { enemy: 'shielded', count: 14, intervalMs: 750 },
    { enemy: 'walker', count: 10, intervalMs: 850, delayMs: 1500 },
  ]));
  waves.push(wave(21, 230, [
    { enemy: 'stealth', count: 12, intervalMs: 850 },
    { enemy: 'shielded', count: 10, intervalMs: 900, delayMs: 2000 },
    { enemy: 'walker', count: 8, intervalMs: 900, delayMs: 4500 },
  ]));

  // 23–24: BOSS #3 + escort
  waves.push(wave(22, 310, [
    { enemy: 'boss', count: 1, intervalMs: 1000 },
    { enemy: 'walker', count: 6, intervalMs: 1000, delayMs: 4000 },
    { enemy: 'shielded', count: 8, intervalMs: 950, delayMs: 7500 },
  ]));
  waves.push(wave(23, 240, [
    { enemy: 'walker', count: 14, intervalMs: 750 },
    { enemy: 'stealth', count: 10, intervalMs: 850, delayMs: 1500 },
    { enemy: 'shielded', count: 8, intervalMs: 900, delayMs: 4000 },
  ]));

  // 25–29: gauntlet
  waves.push(wave(24, 250, [
    { enemy: 'drone', count: 36, intervalMs: 280 },
    { enemy: 'walker', count: 10, intervalMs: 850, delayMs: 1500 },
  ]));
  waves.push(wave(25, 260, [
    { enemy: 'shielded', count: 16, intervalMs: 700 },
    { enemy: 'walker', count: 12, intervalMs: 800, delayMs: 1500 },
  ]));
  waves.push(wave(26, 270, [
    { enemy: 'stealth', count: 16, intervalMs: 750 },
    { enemy: 'shielded', count: 12, intervalMs: 800, delayMs: 1500 },
  ]));
  waves.push(wave(27, 280, [
    { enemy: 'walker', count: 16, intervalMs: 750 },
    { enemy: 'shielded', count: 14, intervalMs: 750, delayMs: 1500 },
    { enemy: 'stealth', count: 12, intervalMs: 800, delayMs: 4000 },
  ]));
  waves.push(wave(28, 290, [
    { enemy: 'drone', count: 48, intervalMs: 230 },
    { enemy: 'walker', count: 14, intervalMs: 800, delayMs: 1500 },
    { enemy: 'shielded', count: 12, intervalMs: 800, delayMs: 4500 },
  ]));

  // 30: FINAL BOSS WAVE
  waves.push(wave(29, 500, [
    { enemy: 'boss', count: 2, intervalMs: 5000 },
    { enemy: 'walker', count: 10, intervalMs: 800, delayMs: 3000 },
    { enemy: 'shielded', count: 12, intervalMs: 800, delayMs: 6000 },
    { enemy: 'stealth', count: 12, intervalMs: 800, delayMs: 9000 },
  ]));

  return waves;
}

/** The Endless / Co-op mission definition. Same engine, longer gauntlet. */
export const ENDLESS_MISSION: MissionDef = {
  id: ENDLESS_MISSION_ID,
  name: 'Sector Defense',
  sector: 'Co-op Operation',
  startEnergy: 260,
  baseHp: 28,
  rewardCores: 0, // co-op runs don't grant solo cores; they fuel the operation
  modifier: { label: 'Endless gauntlet', description: '30 escalating waves with 4 boss encounters. Survive as long as you can — every kill, point of score, and damage to a boss feeds the active Operation.' },
  modifierIds: ['mixed_assault', 'bonus_bounty'],
  waves: buildWaves(),
};

export function isEndlessMission(missionId: number): boolean {
  return missionId === ENDLESS_MISSION_ID;
}
