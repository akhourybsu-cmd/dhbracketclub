import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface OwnedRelic {
  id: string;
  relic_id: string;
  acquired_at: string;
  acquired_at_level: number;
}

export function useRelicCollection() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['rune-delve-relics', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async (): Promise<OwnedRelic[]> => {
      if (!user) return [];
      const { data, error } = await (supabase as any)
        .from('rune_delve_relic_unlocks')
        .select('id, relic_id, acquired_at, acquired_at_level')
        .eq('user_id', user.id)
        .order('acquired_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as OwnedRelic[];
    },
  });
}

export function useUnlockRelic() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { relic_id: string; level: number }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await (supabase as any)
        .from('rune_delve_relic_unlocks')
        .insert({
          user_id: user.id,
          relic_id: params.relic_id,
          acquired_at_level: params.level,
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
