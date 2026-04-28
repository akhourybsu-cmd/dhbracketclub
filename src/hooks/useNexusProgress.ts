import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface NexusProgress {
  cores: number;
  unlocked_towers: string[];
  unlocked_abilities: string[];
  highest_mission: number;
  upgrades: Record<string, number>;
}

const DEFAULT: NexusProgress = {
  cores: 0,
  unlocked_towers: ['pulse', 'arc', 'cryo', 'rail'],
  unlocked_abilities: ['orbital', 'emp'],
  highest_mission: 1,
  upgrades: {},
};

export function useNexusProgress() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<NexusProgress>(DEFAULT);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await (supabase as any).from('nexus_progress').select('*').eq('user_id', user.id).maybeSingle();
    if (data) {
      setProgress({
        cores: data.cores,
        unlocked_towers: data.unlocked_towers,
        unlocked_abilities: data.unlocked_abilities,
        highest_mission: data.highest_mission,
        upgrades: data.upgrades || {},
      });
    } else {
      // Lazy create
      await (supabase as any).from('nexus_progress').insert({ user_id: user.id });
      setProgress(DEFAULT);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const updateProgress = useCallback(async (patch: Partial<NexusProgress>) => {
    if (!user) return;
    const next = { ...progress, ...patch };
    setProgress(next);
    await (supabase as any).from('nexus_progress').upsert({
      user_id: user.id,
      cores: next.cores,
      unlocked_towers: next.unlocked_towers,
      unlocked_abilities: next.unlocked_abilities,
      highest_mission: next.highest_mission,
      upgrades: next.upgrades,
    });
  }, [user, progress]);

  return { progress, loading, refresh, updateProgress };
}

export async function recordNexusRun(params: {
  userId: string;
  missionId: number;
  victory: boolean;
  score: number;
  wavesCleared: number;
  baseHpRemaining: number;
  durationSeconds: number;
  loadout: { towers: string[]; abilities: string[] };
  failedWave?: number | null;
  towerUsage?: Record<string, number>;
  towerUpgrades?: Record<string, number>;
  towerSells?: Record<string, number>;
  abilityUsage?: Record<string, number>;
  energyStarvedMs?: number;
  leaks?: number;
}) {
  await (supabase as any).from('nexus_runs').insert({
    user_id: params.userId,
    mission_id: params.missionId,
    victory: params.victory,
    score: params.score,
    waves_cleared: params.wavesCleared,
    base_hp_remaining: params.baseHpRemaining,
    duration_seconds: params.durationSeconds,
    loadout: params.loadout,
    failed_wave: params.failedWave ?? null,
    tower_usage: params.towerUsage ?? {},
    tower_upgrades: params.towerUpgrades ?? {},
    tower_sells: params.towerSells ?? {},
    ability_usage: params.abilityUsage ?? {},
    energy_starved_ms: params.energyStarvedMs ?? 0,
    leaks: params.leaks ?? 0,
  });
}
