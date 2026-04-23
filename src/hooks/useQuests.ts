import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRuneDelveHero } from '@/hooks/useRuneDelveHero';
import { useEarnShards } from '@/hooks/useRuneShards';
import {
  dailyPeriodKey,
  weeklyPeriodKey,
  rollQuestSet,
  progressDelta,
  scopeLabel,
  type QuestDefinition,
  type ActiveQuest,
  type QuestProgressEvent,
  type QuestScope,
} from '@/lib/runedelve/quests';
import { toast } from 'sonner';

const DEFS_QK = ['rd-quest-defs'];
const ACTIVE_QK = (uid: string | undefined) => ['rd-active-quests', uid];

/** Catalog of all quest templates — cached aggressively. */
export function useQuestDefinitions() {
  return useQuery({
    queryKey: DEFS_QK,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<QuestDefinition[]> => {
      const { data, error } = await supabase
        .from('rune_delve_quest_definitions' as never)
        .select('*');
      if (error) throw error;
      return (data ?? []) as unknown as QuestDefinition[];
    },
  });
}

/**
 * Player's active quests for the current daily + weekly periods. Auto-rolls
 * the set on first read and ensures rows exist for every quest in the set.
 */
export function useActiveQuests() {
  const { user } = useAuth();
  const { data: hero } = useRuneDelveHero();
  const { data: defs } = useQuestDefinitions();
  const qc = useQueryClient();

  const dailyKey = dailyPeriodKey();
  const weeklyKey = weeklyPeriodKey();

  return useQuery({
    queryKey: [...ACTIVE_QK(user?.id), dailyKey, weeklyKey, hero?.class],
    enabled: !!user && !!defs,
    staleTime: 30_000,
    queryFn: async (): Promise<ActiveQuest[]> => {
      if (!user || !defs) return [];

      // Fetch existing rows for both current periods.
      const { data: existing, error: readErr } = await supabase
        .from('rune_delve_active_quests' as never)
        .select('*')
        .eq('user_id', user.id)
        .in('period_key', [dailyKey, weeklyKey]);
      if (readErr) throw readErr;

      const existingRows = (existing ?? []) as unknown as ActiveQuest[];

      // Roll the expected set for each scope and ensure rows exist.
      const rollFor = (scope: QuestScope, periodKey: string) => rollQuestSet({
        defs,
        scope,
        periodKey,
        userId: user.id,
        heroClass: hero?.class ?? null,
      });

      const desiredDaily = rollFor('daily', dailyKey);
      const desiredWeekly = rollFor('weekly', weeklyKey);

      const missing: Array<Omit<ActiveQuest, 'id' | 'definition'>> = [];
      const ensure = (def: QuestDefinition, periodKey: string) => {
        const has = existingRows.some(r => r.quest_id === def.id && r.period_key === periodKey);
        if (!has) {
          missing.push({
            user_id: user.id,
            quest_id: def.id,
            scope: def.scope,
            period_key: periodKey,
            progress: 0,
            target_value: def.target_value,
            status: 'active',
            claimed_at: null,
          });
        }
      };
      desiredDaily.forEach(d => ensure(d, dailyKey));
      desiredWeekly.forEach(d => ensure(d, weeklyKey));

      if (missing.length > 0) {
        const { data: inserted, error: insErr } = await supabase
          .from('rune_delve_active_quests' as never)
          .insert(missing as never)
          .select('*');
        if (insErr) throw insErr;
        existingRows.push(...((inserted ?? []) as unknown as ActiveQuest[]));
      }

      // Attach definitions for the UI layer.
      const defMap = new Map(defs.map(d => [d.id, d]));
      const all = existingRows
        .filter(r => {
          // Hide quests not in the current rolled set (e.g., personal quest
          // changed because user switched class) — keep DB rows but don't show.
          const desired = r.scope === 'daily' ? desiredDaily : desiredWeekly;
          return desired.some(d => d.id === r.quest_id);
        })
        .map(r => ({ ...r, definition: defMap.get(r.quest_id) }));
      // Sort: daily first, then by personal flag, then by id for stability.
      all.sort((a, b) => {
        if (a.scope !== b.scope) return a.scope === 'daily' ? -1 : 1;
        const ap = a.definition?.is_personal ? 1 : 0;
        const bp = b.definition?.is_personal ? 1 : 0;
        if (ap !== bp) return ap - bp;
        return a.quest_id.localeCompare(b.quest_id);
      });
      return all;
    },
  });
}

/**
 * Fan a single progress event out to all matching active quests for the
 * player. Updates progress in DB; flips status to `completed` when target hit.
 * Best-effort — never throws into the gameplay loop.
 */
export function useReportQuestProgress() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: activeQuests } = useActiveQuests();

  return useCallback(async (event: QuestProgressEvent) => {
    if (!user || !activeQuests || activeQuests.length === 0) return;
    const updates: Array<{ id: string; nextProgress: number; nowComplete: boolean; title: string }> = [];

    for (const q of activeQuests) {
      if (q.status !== 'active') continue;
      const delta = progressDelta(event, q);
      if (delta <= 0) continue;
      const nextProgress = Math.min(q.target_value, q.progress + delta);
      if (nextProgress === q.progress) continue;
      const nowComplete = nextProgress >= q.target_value;
      updates.push({
        id: q.id,
        nextProgress,
        nowComplete,
        title: q.definition?.title ?? 'Quest',
      });
    }

    if (updates.length === 0) return;

      await Promise.all(updates.map(u =>
      supabase
        .from('rune_delve_active_quests' as never)
        .update({ progress: u.nextProgress, status: u.nowComplete ? 'completed' : 'active' } as never)
        .eq('id', u.id)
        .then(({ error }) => {
          if (error) console.warn('[quest-progress] update failed', error);
        }),
    ));

    // Invalidate so the home + quests page reflect the new progress.
    qc.invalidateQueries({ queryKey: ['rd-active-quests'] });

    // Surface completed quests with a non-blocking toast.
    for (const u of updates) {
      if (u.nowComplete) {
        toast.success(`✅ Quest Complete — ${u.title}`, {
          description: 'Tap your Quests panel to claim the reward.',
          duration: 5000,
        });
      }
    }
  }, [user, activeQuests, qc]);
}

/** Claim a completed quest — pays out shards (+ XP) and marks it claimed. */
export function useClaimQuest() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const earnShards = useEarnShards();

  return useMutation({
    mutationFn: async (quest: ActiveQuest) => {
      if (!user) throw new Error('Not authenticated');
      if (quest.status !== 'completed') throw new Error('Quest not completed');
      const def = quest.definition;
      if (!def) throw new Error('Quest definition missing');

      // Mark claimed first (race-safe — second claim returns 0 rows).
      const { data, error } = await supabase
        .from('rune_delve_active_quests' as never)
        .update({ status: 'claimed', claimed_at: new Date().toISOString() } as never)
        .eq('id', quest.id)
        .eq('status', 'completed')
        .select('id');
      if (error) throw error;
      if (!data || (data as unknown[]).length === 0) {
        throw new Error('Already claimed');
      }

      // Pay shard reward.
      if (def.shard_reward > 0) {
        await earnShards.mutateAsync(def.shard_reward);
      }

      return { shards: def.shard_reward, xp: def.xp_reward, title: def.title, scope: def.scope };
    },
    onSuccess: (result) => {
      toast.success(`+${result.shards} 💎 — ${scopeLabel(result.scope)} Reward`, {
        description: result.title,
        duration: 4000,
      });
      qc.invalidateQueries({ queryKey: ['rd-active-quests'] });
      qc.invalidateQueries({ queryKey: ['rune-delve-wallet'] });
    },
    onError: (e: Error) => {
      toast.error(`Couldn't claim quest: ${e.message}`);
    },
  });
}

/** Lightweight summary for the home-page badge. */
export function useQuestSummary() {
  const { data: quests } = useActiveQuests();
  return useMemo(() => {
    const list = quests ?? [];
    return {
      total: list.length,
      claimable: list.filter(q => q.status === 'completed').length,
      claimed: list.filter(q => q.status === 'claimed').length,
    };
  }, [quests]);
}
