// Nexus Defense — Modifier Telemetry Analytics
//
// Pure analysis layer over `nexus_runs`. Inputs are the rows the admin balance
// page already loads; outputs are aggregated metrics per modifier and per
// modifier stack, plus heuristic "insight flags" that account for sample size.
//
// No new persistence — this just transforms what telemetry already records
// in `loadout.modifierIds`.

import { MISSIONS } from './missions';
import { ModifierDef, MODIFIERS } from './modifiers';

export type TowerKind = 'pulse' | 'arc' | 'cryo' | 'rail';
export const TOWER_KINDS: TowerKind[] = ['pulse', 'arc', 'cryo', 'rail'];

export interface RunRow {
  mission_id: number;
  victory: boolean;
  score: number;
  waves_cleared: number;
  base_hp_remaining: number;
  duration_seconds: number;
  failed_wave: number | null;
  tower_usage: Record<string, number> | null;
  tower_upgrades: Record<string, number> | null;
  ability_usage: Record<string, number> | null;
  energy_starved_ms: number;
  leaks: number;
  user_id: string;
  created_at: string;
  loadout: any;
}

export interface ModifierMetrics {
  id: string;
  def?: ModifierDef;
  attempts: number;
  wins: number;
  losses: number;
  winRate: number;             // 0..1
  players: number;
  avgRetries: number;
  avgLeaks: number;
  avgDurationSec: number;
  avgBaseHpOnWin: number;
  avgEnergyStarvedSec: number;
  towerShare: Record<TowerKind, number>;     // 0..1 (build share)
  dominantTower: TowerKind | null;
  dominantTowerPct: number;                  // 0..100
  topMissionId: number | null;
  topMissionPct: number;                     // 0..100
  flags: InsightFlag[];
}

export interface StackMetrics {
  key: string;                 // e.g. "hardened_boss+comms_jammed"
  ids: string[];               // sorted
  defs: ModifierDef[];         // resolved
  missionIds: number[];        // missions that use this exact stack
  attempts: number;
  wins: number;
  losses: number;
  winRate: number;
  players: number;
  avgRetries: number;
  avgLeaks: number;
  avgEnergyStarvedSec: number;
  avgDurationSec: number;
  dominantTower: TowerKind | null;
  dominantTowerPct: number;
  commonFailWave: number | null;
  flags: InsightFlag[];
}

export type InsightSeverity = 'info' | 'warn' | 'good' | 'bad';
export interface InsightFlag {
  id: string;
  label: string;
  severity: InsightSeverity;
}

/* ───────── helpers ───────── */

function readModifierIds(row: RunRow): string[] {
  const raw = row?.loadout?.modifierIds;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string' && !!MODIFIERS[x]);
}

function emptyTowerShare(): Record<TowerKind, number> {
  return { pulse: 0, arc: 0, cryo: 0, rail: 0 };
}

function dominantOf(share: Record<TowerKind, number>): { kind: TowerKind | null; pct: number } {
  const total = TOWER_KINDS.reduce((a, k) => a + share[k], 0);
  if (total <= 0) return { kind: null, pct: 0 };
  let best: TowerKind = TOWER_KINDS[0];
  for (const k of TOWER_KINDS) if (share[k] > share[best]) best = k;
  return { kind: best, pct: Math.round((share[best] / total) * 100) };
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  let s = 0;
  for (const n of nums) s += n;
  return s / nums.length;
}

/* ───────── per-modifier metrics ───────── */

export function computeModifierMetrics(rows: RunRow[]): ModifierMetrics[] {
  const byMod = new Map<string, RunRow[]>();
  for (const r of rows) {
    const ids = readModifierIds(r);
    for (const id of ids) {
      const arr = byMod.get(id) || [];
      arr.push(r);
      byMod.set(id, arr);
    }
  }

  // Make sure registered modifiers always appear (even with 0 attempts).
  for (const id of Object.keys(MODIFIERS)) if (!byMod.has(id)) byMod.set(id, []);

  const out: ModifierMetrics[] = [];
  for (const [id, rs] of byMod.entries()) {
    const def = MODIFIERS[id];
    const attempts = rs.length;
    const wins = rs.filter(r => r.victory).length;
    const losses = attempts - wins;
    const players = new Set(rs.map(r => r.user_id)).size;
    const winRate = attempts ? wins / attempts : 0;
    const avgRetries = players ? attempts / players : 0;
    const avgLeaks = avg(rs.map(r => r.leaks || 0));
    const avgDurationSec = avg(rs.map(r => r.duration_seconds || 0));
    const winRows = rs.filter(r => r.victory);
    const avgBaseHpOnWin = winRows.length ? avg(winRows.map(r => r.base_hp_remaining || 0)) : 0;
    const avgEnergyStarvedSec = avg(rs.map(r => (r.energy_starved_ms || 0) / 1000));

    const share = emptyTowerShare();
    for (const r of rs) for (const k of TOWER_KINDS) share[k] += r.tower_usage?.[k] || 0;
    const dom = dominantOf(share);

    // Top mission for this modifier (where it appears most).
    const missionCounts = new Map<number, number>();
    for (const r of rs) missionCounts.set(r.mission_id, (missionCounts.get(r.mission_id) || 0) + 1);
    const topMission = [...missionCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const topMissionId = topMission?.[0] ?? null;
    const topMissionPct = topMission && attempts
      ? Math.round((topMission[1] / attempts) * 100)
      : 0;

    out.push({
      id,
      def,
      attempts,
      wins,
      losses,
      winRate,
      players,
      avgRetries,
      avgLeaks,
      avgDurationSec,
      avgBaseHpOnWin,
      avgEnergyStarvedSec,
      towerShare: share,
      dominantTower: dom.kind,
      dominantTowerPct: dom.pct,
      topMissionId,
      topMissionPct,
      flags: scoreModifierFlags({
        attempts, players, winRate, avgRetries, avgLeaks,
        avgEnergyStarvedSec, dominantPct: dom.pct,
      }),
    });
  }

  // Sort: most-played first, then by lowest winRate (highlights pain points).
  return out.sort((a, b) => {
    if (b.attempts !== a.attempts) return b.attempts - a.attempts;
    return a.winRate - b.winRate;
  });
}

/* ───────── per-stack metrics ───────── */

function stackKey(ids: string[]): string {
  return [...ids].sort().join('+');
}

export function computeStackMetrics(rows: RunRow[], minAttempts = 1): StackMetrics[] {
  const byStack = new Map<string, RunRow[]>();
  for (const r of rows) {
    const ids = readModifierIds(r);
    if (!ids.length) continue;
    const key = stackKey(ids);
    const arr = byStack.get(key) || [];
    arr.push(r);
    byStack.set(key, arr);
  }

  const out: StackMetrics[] = [];
  for (const [key, rs] of byStack.entries()) {
    if (rs.length < minAttempts) continue;
    const ids = key.split('+').filter(Boolean);
    const defs = ids.map(id => MODIFIERS[id]).filter(Boolean) as ModifierDef[];
    const attempts = rs.length;
    const wins = rs.filter(r => r.victory).length;
    const losses = attempts - wins;
    const players = new Set(rs.map(r => r.user_id)).size;
    const winRate = attempts ? wins / attempts : 0;
    const avgRetries = players ? attempts / players : 0;

    const share = emptyTowerShare();
    for (const r of rs) for (const k of TOWER_KINDS) share[k] += r.tower_usage?.[k] || 0;
    const dom = dominantOf(share);

    const failWaves = new Map<number, number>();
    for (const r of rs.filter(r => !r.victory)) {
      const w = r.failed_wave ?? r.waves_cleared + 1;
      failWaves.set(w, (failWaves.get(w) || 0) + 1);
    }
    const commonFailWave = [...failWaves.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // Missions whose curated stack matches this stack exactly.
    const missionIds = MISSIONS
      .filter(m => stackKey(m.modifierIds || []) === key)
      .map(m => m.id);

    out.push({
      key,
      ids,
      defs,
      missionIds,
      attempts,
      wins,
      losses,
      winRate,
      players,
      avgRetries,
      avgLeaks: avg(rs.map(r => r.leaks || 0)),
      avgEnergyStarvedSec: avg(rs.map(r => (r.energy_starved_ms || 0) / 1000)),
      avgDurationSec: avg(rs.map(r => r.duration_seconds || 0)),
      dominantTower: dom.kind,
      dominantTowerPct: dom.pct,
      commonFailWave,
      flags: scoreModifierFlags({
        attempts, players, winRate, avgRetries,
        avgLeaks: avg(rs.map(r => r.leaks || 0)),
        avgEnergyStarvedSec: avg(rs.map(r => (r.energy_starved_ms || 0) / 1000)),
        dominantPct: dom.pct,
      }),
    });
  }

  // Sort: most-played stacks first, then lowest winRate.
  return out.sort((a, b) => {
    if (b.attempts !== a.attempts) return b.attempts - a.attempts;
    return a.winRate - b.winRate;
  });
}

/* ───────── insight flags ───────── */

interface ScoreInput {
  attempts: number;
  players: number;
  winRate: number;
  avgRetries: number;
  avgLeaks: number;
  avgEnergyStarvedSec: number;
  dominantPct: number;
}

const MIN_RELIABLE_ATTEMPTS = 6;

export function scoreModifierFlags(s: ScoreInput): InsightFlag[] {
  const flags: InsightFlag[] = [];
  if (s.attempts === 0) {
    flags.push({ id: 'no_data', label: 'No runs yet', severity: 'info' });
    return flags;
  }
  if (s.attempts < MIN_RELIABLE_ATTEMPTS) {
    flags.push({ id: 'low_sample', label: `Low sample (${s.attempts})`, severity: 'info' });
    // Skip strong claims when sample is tiny — but still allow tower-dependence
    // hint because that one is structural rather than statistical.
    if (s.dominantPct >= 80) {
      flags.push({ id: 'tower_dep', label: `Tower dependence ${s.dominantPct}%`, severity: 'warn' });
    }
    return flags;
  }
  if (s.winRate < 0.3) flags.push({ id: 'too_hard', label: 'Likely too hard', severity: 'bad' });
  else if (s.winRate > 0.92) flags.push({ id: 'too_easy', label: 'Possibly too easy', severity: 'warn' });
  if (s.avgLeaks >= 4) flags.push({ id: 'leaky', label: `High leak rate (${s.avgLeaks.toFixed(1)})`, severity: 'bad' });
  if (s.avgRetries >= 2.5) flags.push({ id: 'retries', label: `Heavy retries (${s.avgRetries.toFixed(1)}×)`, severity: 'warn' });
  if (s.avgEnergyStarvedSec >= 12) flags.push({ id: 'starved', label: `Energy pressure ~${Math.round(s.avgEnergyStarvedSec)}s`, severity: 'warn' });
  if (s.dominantPct >= 70) flags.push({ id: 'tower_dep', label: `Tower dependence ${s.dominantPct}%`, severity: 'warn' });
  if (s.dominantPct > 0 && s.dominantPct <= 35 && s.winRate >= 0.4 && s.winRate <= 0.85) {
    flags.push({ id: 'healthy', label: 'Healthy variety', severity: 'good' });
  }
  if (s.winRate >= 0.55 && s.winRate <= 0.85 && s.avgLeaks < 3 && s.avgRetries < 2) {
    flags.push({ id: 'balanced', label: 'Balanced', severity: 'good' });
  }
  return flags;
}

/* ───────── mission cross-read ───────── */

export interface MissionModifierBreakdown {
  missionId: number;
  modifierIds: string[];
  perModifier: ModifierMetrics[];   // each modifier's overall (cross-mission) metrics
  stackMetrics: StackMetrics | null; // for runs on THIS mission only
}

export function computeMissionModifierBreakdown(rows: RunRow[]): MissionModifierBreakdown[] {
  const allMod = computeModifierMetrics(rows);
  const modIndex = new Map(allMod.map(m => [m.id, m]));
  const out: MissionModifierBreakdown[] = [];
  for (const m of MISSIONS) {
    const ids = m.modifierIds || [];
    if (!ids.length) continue;
    const missionRows = rows.filter(r => r.mission_id === m.id);
    const stackMetrics = missionRows.length
      ? computeStackMetrics(missionRows)[0] || null
      : null;
    out.push({
      missionId: m.id,
      modifierIds: ids,
      perModifier: ids.map(id => modIndex.get(id)).filter(Boolean) as ModifierMetrics[],
      stackMetrics,
    });
  }
  return out;
}
