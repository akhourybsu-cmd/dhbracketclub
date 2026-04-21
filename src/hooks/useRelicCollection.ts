import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MAX_RANK, clampRank } from '@/lib/runedelve/relics';

export interface OwnedRelic {
  id: string;
  relic_id: string;
  acquired_at: string;
  acquired_at_level: number;
  rank: number;
}

export function useRelicCollection() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['rune-delve-relics', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async (): Promise<OwnedRelic[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('rune_delve_relic_unlocks')
        .select('id, relic_id, acquired_at, acquired_at_level, rank')
        .eq('user_id', user.id)
        .order('acquired_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        rank: clampRank(r.rank ?? 1),
      })) as OwnedRelic[];
    },
  });
}

export function useUnlockRelic() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { relic_id: string; level: number }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('rune_delve_relic_unlocks')
        .insert({
          user_id: user.id,
          relic_id: params.relic_id,
          acquired_at_level: params.level,
          rank: 1,
        })
        .select()
        .single();
      if (error) throw error;
      return data as OwnedRelic;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rune-delve-relics', user?.id] });
    },
  });
}

/** Bumps an owned relic's rank by exactly +1, scoped to the current user.
 *  Validates current rank server-side via select-then-update so we never
 *  skip ranks or exceed MAX_RANK. The shard spend is performed separately
 *  by the shop (useSpendShards) so failures unwind cleanly via the caller. */
export function useUpgradeRelic() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { relic_id: string; expected_rank: number }) => {
      if (!user) throw new Error('Not authenticated');
      const { data: current, error: readErr } = await supabase
        .from('rune_delve_relic_unlocks')
        .select('id, rank')
        .eq('user_id', user.id)
        .eq('relic_id', params.relic_id)
        .maybeSingle();
      if (readErr) throw readErr;
      if (!current) throw new Error('Relic not owned');
      const currentRank = clampRank(current.rank ?? 1);
      if (currentRank !== params.expected_rank) {
        throw new Error('Rank changed — please retry');
      }
      if (currentRank >= MAX_RANK) throw new Error('Already at max rank');
      const nextRank = currentRank + 1;
      const { data, error } = await supabase
        .from('rune_delve_relic_unlocks')
        .update({ rank: nextRank })
        .eq('id', current.id)
        .eq('user_id', user.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Upgrade failed — please retry');
      return data as OwnedRelic;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rune-delve-relics', user?.id] });
    },
  });
}

/** Build a quick id->rank lookup from a collection. */
export function rankMapFromOwned(owned: OwnedRelic[] | undefined | null): Map<string, number> {
  const m = new Map<string, number>();
  for (const o of owned ?? []) m.set(o.relic_id, clampRank(o.rank ?? 1));
  return m;
}
