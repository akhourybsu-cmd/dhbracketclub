import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MISSIONS, getMission as getBaseMission } from '@/lib/nexus/missions';
import {
  applyCalibration,
  buildEnemyMods,
  EnemyMods,
  MissionCalibration,
  withDefaults,
} from '@/lib/nexus/calibration';
import { MissionDef } from '@/lib/nexus/types';
import { refreshLiveEndlessCache } from '@/lib/nexus/missionDrafts';
import { ENDLESS_MISSION_ID } from '@/lib/nexus/endless';

let cachedRows: MissionCalibration[] | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 30_000;
const listeners = new Set<(rows: MissionCalibration[]) => void>();

async function fetchAll(force = false): Promise<MissionCalibration[]> {
  const fresh = cachedRows && (Date.now() - cacheLoadedAt) < CACHE_TTL_MS;
  if (fresh && !force) return cachedRows!;
  const { data, error } = await (supabase as any)
    .from('nexus_mission_calibrations')
    .select('*');
  if (error) {
    console.warn('[nexus] calibration fetch failed', error.message);
    cachedRows = cachedRows ?? [];
    return cachedRows;
  }
  cachedRows = (data as MissionCalibration[]) ?? [];
  cacheLoadedAt = Date.now();
  listeners.forEach(l => l(cachedRows!));
  return cachedRows;
}

export function invalidateCalibrationCache() {
  cachedRows = null;
  cacheLoadedAt = 0;
}

/** Loads all calibration rows (cached). Returns resolved missions. */
export function useResolvedMissions(): { missions: MissionDef[]; loading: boolean; calibrations: MissionCalibration[] } {
  const [rows, setRows] = useState<MissionCalibration[] | null>(cachedRows);
  const [loading, setLoading] = useState(cachedRows == null);

  useEffect(() => {
    let cancelled = false;
    fetchAll().then(r => {
      if (cancelled) return;
      setRows(r);
      setLoading(false);
    });
    const l = (r: MissionCalibration[]) => { if (!cancelled) setRows([...r]); };
    listeners.add(l);
    return () => { cancelled = true; listeners.delete(l); };
  }, []);

  const calibrations = rows ?? [];
  const missions = MISSIONS.map(m => {
    const cal = calibrations.find(c => c.mission_id === m.id);
    return applyCalibration(m, cal);
  });
  return { missions, loading, calibrations };
}

/** Fetch a single resolved mission + its enemy mods (used by the battle screen). */
export function useResolvedMission(missionId: number): {
  mission: MissionDef | null;
  enemyMods: EnemyMods;
  calibration: MissionCalibration | null;
  loading: boolean;
} {
  const [cal, setCal] = useState<MissionCalibration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchAll().then(rows => {
      if (cancelled) return;
      setCal(rows.find(r => r.mission_id === missionId) ?? null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [missionId]);

  const base = getBaseMission(missionId) ?? null;
  const mission = base ? applyCalibration(base, cal) : null;
  return { mission, enemyMods: buildEnemyMods(cal), calibration: cal, loading };
}

/** Admin-only mutation helpers. */
export async function saveCalibration(input: MissionCalibration, userId: string): Promise<{ ok: boolean; error?: string }> {
  const payload = { ...input, updated_by: userId };
  const { error } = await (supabase as any)
    .from('nexus_mission_calibrations')
    .upsert(payload, { onConflict: 'mission_id' });
  if (error) return { ok: false, error: error.message };
  invalidateCalibrationCache();
  await fetchAll(true);
  return { ok: true };
}

export async function resetCalibration(missionId: number): Promise<{ ok: boolean; error?: string }> {
  const { error } = await (supabase as any)
    .from('nexus_mission_calibrations')
    .delete()
    .eq('mission_id', missionId);
  if (error) return { ok: false, error: error.message };
  invalidateCalibrationCache();
  await fetchAll(true);
  return { ok: true };
}

export { withDefaults };
