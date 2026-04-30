// Nexus Defense — Mission Workshop draft / live config layer
//
// Drafts are admin-authored configurations that can be simulated, then
// promoted to "live" so the engine picks them up on subsequent runs.
//
//   - kind 'endless'   → overrides the Endless mission definition
//                        (waves, scaling curve, start values).
//   - kind 'operation' → defines Co-op Operation phase targets and
//                        contribution thresholds.
//
// IMPORTANT: real player data (runs, contributions, leaderboards) is never
// touched by the workshop. Drafts only become real when an admin presses
// "Apply Live" — and even then, in-progress runs keep their config.
//
// All DB calls live here so pages stay thin and we have a single audit point
// for what config the engine ends up using.

import { supabase } from '@/integrations/supabase/client';
import { ENDLESS_MISSION, ENDLESS_MISSION_ID, endlessWaveScaling as defaultEndlessScaling } from './endless';
import { EnemyKind, MissionDef, Wave, WaveSpawn } from './types';

/* ────────────────────────────── Types ───────────────────────────────────── */

export type DraftKind = 'endless' | 'operation';
export type DraftStatus = 'draft' | 'live' | 'archived';

export interface MissionDraftRow {
  id: string;
  kind: DraftKind;
  status: DraftStatus;
  name: string;
  notes: string | null;
  config: any;
  version: number;
  parent_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  applied_at: string | null;
  archived_at: string | null;
}

/** Endless draft config schema. Mirrors a minimal MissionDef + scaling curve. */
export interface EndlessDraftConfig {
  startEnergy: number;
  baseHp: number;
  rewardCores: number;
  modifierIds: string[];
  waves: Wave[];
  /** Wave-tier enemy stat scaling curve. Pure data, applied at spawn time. */
  scaling: EndlessScalingConfig;
  /** Optional milestone reward overrides. Read by award_endless_rewards SQL. */
  endlessRewards?: EndlessRewardsConfig;
}

export interface EndlessRewardMilestone {
  wave: number;
  tokens: number;
  /** Optional sigil code to grant first-time at this milestone. */
  sigilCode?: string | null;
}

export interface EndlessRewardsConfig {
  milestones: EndlessRewardMilestone[];
}

export const DEFAULT_ENDLESS_REWARDS: EndlessRewardsConfig = {
  milestones: [
    { wave: 10, tokens: 10, sigilCode: 'endless_wave_10' },
    { wave: 20, tokens: 20, sigilCode: 'endless_wave_20' },
    { wave: 30, tokens: 40, sigilCode: 'endless_wave_30' },
  ],
};

export interface EndlessScalingConfig {
  /** Wave at which non-boss HP scaling begins (1-indexed inclusive). */
  hpStartWave: number;
  /** Per-wave HP multiplier added past start (e.g. 0.10 = +10%/wave). */
  hpPerWave: number;
  /** Hard cap on total non-boss HP multiplier. */
  hpCap: number;
  /** Wave shield scaling begins (1-indexed). */
  shieldStartWave: number;
  shieldPerWave: number;
  shieldCap: number;
  /** Wave speed scaling begins. */
  speedStartWave: number;
  speedPerWave: number;
  /** Hard cap on speed multiplier (engine-stable max). */
  speedCap: number;
  /** Boss HP grows per wave-index past 0. */
  bossHpPerWave: number;
  bossHpCap: number;
}

export const DEFAULT_ENDLESS_SCALING: EndlessScalingConfig = {
  hpStartWave: 4,
  hpPerWave: 0.10,
  hpCap: 6.0,
  shieldStartWave: 9,
  shieldPerWave: 0.08,
  shieldCap: 3.5,
  speedStartWave: 8,
  speedPerWave: 0.018,
  speedCap: 1.40,
  bossHpPerWave: 0.04,
  bossHpCap: 2.0,
};

/** Operation draft config — target thresholds + contribution policy. */
export interface OperationDraftConfig {
  name: string;
  flavor?: string | null;
  phaseTargets: { phase1: number; phase2: number; phase3: number };
  /** Multiplier on points awarded per kill / score / wave / boss damage. */
  weights: { kills: number; score: number; waves: number; boss: number };
  thresholds: {
    /** Minimum waves OR (duration AND kills) gates from the SQL. Display-only here;
     *  SQL still enforces. Surface so admins know what they're tuning. */
    minWavesOrDurationKills: { waves: number; durationSec: number; kills: number };
    /** Per-run cap on contribution points awarded. */
    perRunPointCap: number;
  };
  expectedGroupSize: number;
}

export const DEFAULT_OPERATION_CONFIG: OperationDraftConfig = {
  name: 'Operation Aegis',
  flavor: null,
  phaseTargets: { phase1: 6000, phase2: 220000, phase3: 80000 },
  weights: { kills: 1.0, score: 1.0, waves: 1.0, boss: 1.0 },
  thresholds: {
    minWavesOrDurationKills: { waves: 2, durationSec: 60, kills: 5 },
    perRunPointCap: 10000,
  },
  expectedGroupSize: 4,
};

/* ──────────────────────── Endless: read-through engine glue ─────────────── */
// The engine still imports ENDLESS_MISSION as a const (synchronous import).
// To honor a live endless draft without rearchitecting the engine, we cache
// the active draft mission here and patch it into the resolver path that
// `useResolvedMission` uses. The cache is loaded once at app start and
// refreshed when admins apply a new draft.

let liveEndlessMissionCache: MissionDef | null = null;
let liveEndlessScalingCache: EndlessScalingConfig | null = null;
let endlessLoadPromise: Promise<void> | null = null;

export function getLiveEndlessMission(): MissionDef {
  return liveEndlessMissionCache ?? ENDLESS_MISSION;
}

export function getLiveEndlessScaling(): EndlessScalingConfig {
  return liveEndlessScalingCache ?? DEFAULT_ENDLESS_SCALING;
}

/** Replacement for endless.ts `endlessWaveScaling` that respects the live draft. */
export function liveEndlessWaveScaling(waveIndex: number, kind: EnemyKind): { hp: number; shield: number; speed: number } {
  const cfg = getLiveEndlessScaling();
  const w = Math.max(0, waveIndex);
  if (kind === 'boss') {
    const hp = 1 + Math.min(cfg.bossHpCap - 1, w * cfg.bossHpPerWave);
    return { hp: Math.max(1, hp), shield: 1, speed: 1 };
  }
  let hp = 1, shield = 1, speed = 1;
  if (w >= cfg.hpStartWave - 1) {
    const steps = w - (cfg.hpStartWave - 1) + 1;
    hp = Math.min(cfg.hpCap, 1 + steps * cfg.hpPerWave);
  }
  if (w >= cfg.shieldStartWave - 1) {
    const steps = w - (cfg.shieldStartWave - 1) + 1;
    shield = Math.min(cfg.shieldCap, 1 + steps * cfg.shieldPerWave);
  }
  if (w >= cfg.speedStartWave - 1) {
    const steps = w - (cfg.speedStartWave - 1) + 1;
    speed = Math.min(cfg.speedCap, 1 + steps * cfg.speedPerWave);
  }
  return { hp, shield, speed };
}

export function isEndlessId(missionId: number): boolean {
  return missionId === ENDLESS_MISSION_ID;
}

/** Build a MissionDef from a draft config, falling back to default endless metadata. */
export function endlessConfigToMission(cfg: EndlessDraftConfig): MissionDef {
  return {
    id: ENDLESS_MISSION_ID,
    name: ENDLESS_MISSION.name,
    sector: ENDLESS_MISSION.sector,
    startEnergy: cfg.startEnergy,
    baseHp: cfg.baseHp,
    rewardCores: cfg.rewardCores,
    modifier: ENDLESS_MISSION.modifier,
    modifierIds: cfg.modifierIds ?? ENDLESS_MISSION.modifierIds,
    waves: cfg.waves,
  };
}

/** Build a default endless draft config from the hardcoded mission. */
export function defaultEndlessDraftConfig(): EndlessDraftConfig {
  return {
    startEnergy: ENDLESS_MISSION.startEnergy,
    baseHp: ENDLESS_MISSION.baseHp,
    rewardCores: ENDLESS_MISSION.rewardCores,
    modifierIds: ENDLESS_MISSION.modifierIds ?? [],
    waves: ENDLESS_MISSION.waves.map(w => ({
      ...w,
      spawns: w.spawns.map(s => ({ ...s })),
    })),
    scaling: { ...DEFAULT_ENDLESS_SCALING },
    endlessRewards: { milestones: DEFAULT_ENDLESS_REWARDS.milestones.map(m => ({ ...m })) },
  };
}

/* ─────────────────────────────── DB calls ───────────────────────────────── */

export async function listDrafts(kind?: DraftKind): Promise<MissionDraftRow[]> {
  let q = (supabase as any)
    .from('nexus_mission_drafts')
    .select('*')
    .order('updated_at', { ascending: false });
  if (kind) q = q.eq('kind', kind);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as MissionDraftRow[];
}

export async function getLiveDraft(kind: DraftKind): Promise<MissionDraftRow | null> {
  const { data, error } = await (supabase as any)
    .from('nexus_mission_drafts')
    .select('*')
    .eq('kind', kind)
    .eq('status', 'live')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MissionDraftRow) ?? null;
}

export async function createDraft(args: {
  kind: DraftKind;
  name: string;
  config: any;
  notes?: string;
  parent_id?: string | null;
  userId: string;
}): Promise<MissionDraftRow> {
  const { data, error } = await (supabase as any)
    .from('nexus_mission_drafts')
    .insert({
      kind: args.kind,
      status: 'draft',
      name: args.name,
      notes: args.notes ?? null,
      config: args.config,
      parent_id: args.parent_id ?? null,
      created_by: args.userId,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as MissionDraftRow;
}

export async function updateDraft(id: string, patch: Partial<Pick<MissionDraftRow, 'name' | 'notes' | 'config'>>): Promise<MissionDraftRow> {
  const { data, error } = await (supabase as any)
    .from('nexus_mission_drafts')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as MissionDraftRow;
}

export async function deleteDraft(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('nexus_mission_drafts')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function applyDraftLive(id: string, alsoUpdateActiveOp = true): Promise<{ ok: boolean; archived_id?: string; active_operation_updated?: boolean }> {
  const { data, error } = await (supabase as any).rpc('apply_mission_draft_live', {
    _draft_id: id,
    _also_update_active_op: alsoUpdateActiveOp,
  });
  if (error) throw new Error(error.message);
  return data ?? { ok: false };
}

/** Hydrate the in-memory live-endless cache from DB. Safe to call repeatedly. */
export function refreshLiveEndlessCache(): Promise<void> {
  if (endlessLoadPromise) return endlessLoadPromise;
  endlessLoadPromise = (async () => {
    try {
      const row = await getLiveDraft('endless');
      if (row && row.config) {
        const cfg = row.config as EndlessDraftConfig;
        if (Array.isArray(cfg.waves) && cfg.waves.length > 0) {
          liveEndlessMissionCache = endlessConfigToMission(cfg);
        }
        if (cfg.scaling) liveEndlessScalingCache = { ...DEFAULT_ENDLESS_SCALING, ...cfg.scaling };
      }
    } catch (e) {
      console.warn('[nexus] live endless draft load failed', e);
    } finally {
      // Allow next call to refetch.
      setTimeout(() => { endlessLoadPromise = null; }, 0);
    }
  })();
  return endlessLoadPromise;
}

export function clearLiveEndlessCache() {
  liveEndlessMissionCache = null;
  liveEndlessScalingCache = null;
  endlessLoadPromise = null;
}

/* ──────────────────────── Validation / safety ───────────────────────────── */

export interface ValidationIssue {
  level: 'error' | 'warn';
  message: string;
}

export function validateEndlessConfig(cfg: EndlessDraftConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (cfg.startEnergy < 0) issues.push({ level: 'error', message: 'Start energy cannot be negative.' });
  if (cfg.baseHp < 1) issues.push({ level: 'error', message: 'Base HP must be at least 1.' });
  if (!Array.isArray(cfg.waves) || cfg.waves.length === 0) {
    issues.push({ level: 'error', message: 'Endless must have at least one wave.' });
  } else {
    cfg.waves.forEach((w, i) => {
      if (w.rewardEnergy < 0) issues.push({ level: 'error', message: `Wave ${i + 1}: reward cannot be negative.` });
      if (!w.spawns?.length) issues.push({ level: 'error', message: `Wave ${i + 1}: needs at least one enemy group.` });
      w.spawns?.forEach((s, j) => {
        if (s.count < 1) issues.push({ level: 'error', message: `Wave ${i + 1} group ${j + 1}: count must be ≥1.` });
        if (s.intervalMs < 100) issues.push({ level: 'error', message: `Wave ${i + 1} group ${j + 1}: interval must be ≥100ms.` });
        if (s.delayMs != null && s.delayMs < 0) issues.push({ level: 'error', message: `Wave ${i + 1} group ${j + 1}: delay cannot be negative.` });
      });
      const total = w.spawns?.reduce((a, s) => a + s.count, 0) ?? 0;
      if (i < 2 && total > 25) issues.push({ level: 'warn', message: `Wave ${i + 1}: ${total} enemies may be punishing this early.` });
      const hasStealth = w.spawns?.some(s => s.enemy === 'stealth');
      if (i < 4 && hasStealth) issues.push({ level: 'warn', message: `Wave ${i + 1}: stealth this early forces Rail.` });
      const hasBoss = w.spawns?.some(s => s.enemy === 'boss');
      if (i < 3 && hasBoss) issues.push({ level: 'warn', message: `Wave ${i + 1}: boss this early may wall players.` });
    });
  }
  if (cfg.scaling.hpCap < 1) issues.push({ level: 'error', message: 'HP cap must be ≥1.' });
  if (cfg.scaling.speedCap > 2) issues.push({ level: 'warn', message: 'Speed cap >2× can break enemy pathing visuals.' });
  return issues;
}

export function validateOperationConfig(cfg: OperationDraftConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!cfg.name?.trim()) issues.push({ level: 'error', message: 'Operation needs a name.' });
  for (const k of ['phase1', 'phase2', 'phase3'] as const) {
    if (cfg.phaseTargets[k] <= 0) issues.push({ level: 'error', message: `${k} target must be > 0.` });
  }
  if (cfg.phaseTargets.phase1 < 100) issues.push({ level: 'warn', message: 'Phase 1 target very low — likely completes in 1 run.' });
  if (cfg.phaseTargets.phase3 > 200000) issues.push({ level: 'warn', message: 'Phase 3 target very high — may stall.' });
  if (cfg.thresholds.perRunPointCap < 100) issues.push({ level: 'warn', message: 'Per-run cap very low — runs barely contribute.' });
  return issues;
}

/* ──────────────────────── Wave editor helpers ───────────────────────────── */

export function emptySpawn(enemy: EnemyKind = 'drone'): WaveSpawn {
  return { enemy, count: 6, intervalMs: 800, delayMs: 0 };
}

export function emptyWave(index: number): Wave {
  return { index, rewardEnergy: 50, spawns: [emptySpawn()] };
}

/** Rough per-wave difficulty pressure, used by the editor for a quick chip. */
export function estimateWavePressure(w: Wave): { score: number; label: 'Light' | 'Moderate' | 'Heavy' | 'Punishing' } {
  let score = 0;
  for (const s of w.spawns) {
    const w1 = s.enemy === 'drone' ? 1 : s.enemy === 'walker' ? 2 : s.enemy === 'shielded' ? 3 : s.enemy === 'stealth' ? 3 : 12;
    score += s.count * w1 * (1000 / Math.max(200, s.intervalMs));
  }
  let label: 'Light' | 'Moderate' | 'Heavy' | 'Punishing';
  if (score < 60) label = 'Light';
  else if (score < 140) label = 'Moderate';
  else if (score < 260) label = 'Heavy';
  else label = 'Punishing';
  return { score, label };
}

// Re-export the default scaling fn so callers can compare default vs draft if needed.
export { defaultEndlessScaling };
