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

/** Build the 20-wave endless gauntlet (mobile-tuned).
 *
 * Pacing target on mobile (10 ticks/sec engine):
 *   - Weak run (waves 1–5):    ~3 minutes
 *   - Normal run (waves 6–10): ~5–7 minutes
 *   - Strong run (waves 11–15):~9–11 minutes
 *   - Excellent (waves 16–20): ~12–14 minutes
 *
 * Bosses appear on waves 5, 10, 15, 20 — every meaningful run produces
 * boss damage so Phase 3 contribution is reachable from average play.
 */
function buildWaves(): Wave[] {
  const waves: Wave[] = [];

  // 1–2: warm-up
  waves.push(wave(0, 50, [{ enemy: 'drone', count: 10, intervalMs: 750 }]));
  waves.push(wave(1, 60, [
    { enemy: 'drone', count: 12, intervalMs: 650 },
    { enemy: 'walker', count: 2, intervalMs: 1400, delayMs: 1500 },
  ]));

  // 3–4: shielded intro
  waves.push(wave(2, 70, [
    { enemy: 'shielded', count: 4, intervalMs: 1000 },
    { enemy: 'drone', count: 12, intervalMs: 500, delayMs: 1500 },
  ]));
  waves.push(wave(3, 85, [
    { enemy: 'shielded', count: 6, intervalMs: 950 },
    { enemy: 'walker', count: 4, intervalMs: 1100, delayMs: 1500 },
  ]));

  // 5: BOSS #1 (early — proves Phase 3 contribution is real)
  waves.push(wave(4, 200, [
    { enemy: 'boss', count: 1, intervalMs: 1000 },
    { enemy: 'shielded', count: 4, intervalMs: 1200, delayMs: 3500 },
  ]));

  // 6–7: stealth intro + swarm
  waves.push(wave(5, 100, [
    { enemy: 'stealth', count: 5, intervalMs: 1000 },
    { enemy: 'walker', count: 3, intervalMs: 1200, delayMs: 1500 },
  ]));
  waves.push(wave(6, 120, [
    { enemy: 'drone', count: 18, intervalMs: 400 },
    { enemy: 'shielded', count: 5, intervalMs: 950, delayMs: 2000 },
  ]));

  // 8–9: mixed pressure
  waves.push(wave(7, 140, [
    { enemy: 'walker', count: 6, intervalMs: 1000 },
    { enemy: 'shielded', count: 6, intervalMs: 950, delayMs: 1500 },
    { enemy: 'stealth', count: 4, intervalMs: 1100, delayMs: 3000 },
  ]));
  waves.push(wave(8, 160, [
    { enemy: 'shielded', count: 10, intervalMs: 800 },
    { enemy: 'walker', count: 6, intervalMs: 1000, delayMs: 1500 },
  ]));

  // 10: BOSS #2
  waves.push(wave(9, 240, [
    { enemy: 'boss', count: 1, intervalMs: 1000 },
    { enemy: 'walker', count: 5, intervalMs: 1100, delayMs: 4000 },
    { enemy: 'shielded', count: 6, intervalMs: 1000, delayMs: 7000 },
  ]));

  // 11–12: ramp
  waves.push(wave(10, 180, [
    { enemy: 'stealth', count: 10, intervalMs: 800 },
    { enemy: 'shielded', count: 6, intervalMs: 950, delayMs: 1500 },
  ]));
  waves.push(wave(11, 200, [
    { enemy: 'walker', count: 10, intervalMs: 850 },
    { enemy: 'drone', count: 22, intervalMs: 320, delayMs: 1500 },
  ]));

  // 13–14: heavy mixed
  waves.push(wave(12, 220, [
    { enemy: 'shielded', count: 12, intervalMs: 750 },
    { enemy: 'stealth', count: 8, intervalMs: 900, delayMs: 1500 },
  ]));
  waves.push(wave(13, 240, [
    { enemy: 'walker', count: 12, intervalMs: 800 },
    { enemy: 'shielded', count: 8, intervalMs: 900, delayMs: 1500 },
    { enemy: 'stealth', count: 6, intervalMs: 1000, delayMs: 4000 },
  ]));

  // 15: BOSS #3
  waves.push(wave(14, 300, [
    { enemy: 'boss', count: 1, intervalMs: 1000 },
    { enemy: 'walker', count: 6, intervalMs: 1000, delayMs: 4000 },
    { enemy: 'shielded', count: 8, intervalMs: 900, delayMs: 7500 },
  ]));

  // 16–19: gauntlet
  waves.push(wave(15, 260, [
    { enemy: 'walker', count: 14, intervalMs: 750 },
    { enemy: 'stealth', count: 10, intervalMs: 850, delayMs: 1500 },
  ]));
  waves.push(wave(16, 280, [
    { enemy: 'drone', count: 30, intervalMs: 280 },
    { enemy: 'shielded', count: 10, intervalMs: 800, delayMs: 1500 },
  ]));
  waves.push(wave(17, 300, [
    { enemy: 'shielded', count: 14, intervalMs: 700 },
    { enemy: 'walker', count: 10, intervalMs: 800, delayMs: 1500 },
  ]));
  waves.push(wave(18, 320, [
    { enemy: 'stealth', count: 14, intervalMs: 750 },
    { enemy: 'shielded', count: 12, intervalMs: 800, delayMs: 1500 },
    { enemy: 'walker', count: 8, intervalMs: 900, delayMs: 4500 },
  ]));

  // 20: FINAL BOSS — single boss + escort (was 2 bosses; that was brutal)
  waves.push(wave(19, 500, [
    { enemy: 'boss', count: 1, intervalMs: 1000 },
    { enemy: 'walker', count: 10, intervalMs: 800, delayMs: 3000 },
    { enemy: 'shielded', count: 12, intervalMs: 800, delayMs: 6000 },
    { enemy: 'stealth', count: 10, intervalMs: 800, delayMs: 9000 },
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
  modifier: { label: 'Endless gauntlet', description: '20 escalating waves with 4 boss encounters (waves 5/10/15/20). Survive as long as you can — kills, score and boss damage all feed the active Operation.' },
  modifierIds: ['mixed_assault', 'bonus_bounty'],
  waves: buildWaves(),
};

export function isEndlessMission(missionId: number): boolean {
  return missionId === ENDLESS_MISSION_ID;
}
