// Nexus Defense — Rewards hooks (Phase A).
// Backs salvage wallet, sigils (catalog + user-owned + displayed),
// boost catalog, spend/award RPCs.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { SigilRarity } from '@/lib/nexus/sigilStyle';

export interface SigilDef {
  code: string;
  name: string;
  description: string;
  icon: string;
  rarity: SigilRarity;
  category: string;
}

export interface UserSigil {
  sigil_code: string;
  awarded_at: string;
  source_operation_id: string | null;
  source_run_id: string | null;
}

export interface SalvageWallet {
  user_id: string;
  tokens: number;
  lifetime_earned: number;
}

export interface BoostDef {
  code: string;
  name: string;
  description: string;
  cost_tokens: number;
  category: string;
  effect_json: Record<string, any>;
}

/* ---------- catalog hooks ---------- */

export function useSigilCatalog() {
  return useQuery({
    queryKey: ['nexus-sigil-catalog'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SigilDef[]> => {
      const { data, error } = await (supabase as any).from('nexus_sigils').select('*');
      if (error) throw error;
      return (data ?? []) as SigilDef[];
    },
  });
}

export function useBoostCatalog() {
  return useQuery({
    queryKey: ['nexus-boost-catalog'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<BoostDef[]> => {
      const { data, error } = await (supabase as any)
        .from('nexus_boosts')
        .select('*')
        .order('cost_tokens', { ascending: true });
      if (error) throw error;
      return (data ?? []) as BoostDef[];
    },
  });
}

/* ---------- user-scoped hooks ---------- */

export function useSalvageWallet() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['nexus-salvage-wallet', user?.id],
    enabled: !!user,
    staleTime: 15_000,
    queryFn: async (): Promise<SalvageWallet> => {
      if (!user) throw new Error('No user');
      const { data } = await (supabase as any)
        .from('nexus_salvage_wallet')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      return (data as SalvageWallet) ?? { user_id: user.id, tokens: 0, lifetime_earned: 0 };
    },
  });
}

export function useUserSigils(userId?: string | null) {
  const { user } = useAuth();
  const targetId = userId ?? user?.id ?? null;
  return useQuery({
    queryKey: ['nexus-user-sigils', targetId],
    enabled: !!targetId,
    staleTime: 30_000,
    queryFn: async (): Promise<UserSigil[]> => {
      if (!targetId) return [];
      const { data, error } = await (supabase as any)
        .from('nexus_user_sigils')
        .select('sigil_code, awarded_at, source_operation_id, source_run_id')
        .eq('user_id', targetId)
        .order('awarded_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as UserSigil[];
    },
  });
}

/** Fetch displayed-sigil rows for a list of user IDs in one batch. */
export function useDisplayedSigils(userIds: string[]) {
  const key = userIds.slice().sort().join(',');
  return useQuery({
    queryKey: ['nexus-displayed-sigils', key],
    enabled: userIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Record<string, string>> => {
      if (userIds.length === 0) return {};
      const { data } = await (supabase as any)
        .from('nexus_displayed_sigil')
        .select('user_id, sigil_code')
        .in('user_id', userIds);
      const map: Record<string, string> = {};
      for (const r of data ?? []) map[r.user_id] = r.sigil_code;
      return map;
    },
  });
}

/** Fetch which runs used a boost, for the leaderboard ⚡ tag. */
export function useRunBoosts(runIds: string[]) {
  const key = runIds.slice().sort().join(',');
  return useQuery({
    queryKey: ['nexus-run-boosts', key],
    enabled: runIds.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, string>> => {
      if (runIds.length === 0) return {};
      const { data } = await (supabase as any)
        .from('nexus_run_boosts')
        .select('nexus_run_id, boost_code')
        .in('nexus_run_id', runIds);
      const map: Record<string, string> = {};
      for (const r of data ?? []) if (r.nexus_run_id) map[r.nexus_run_id] = r.boost_code;
      return map;
    },
  });
}

/* ---------- mutations ---------- */

export function useSetDisplayedSigil() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sigilCode: string): Promise<void> => {
      const { error } = await (supabase as any).rpc('set_displayed_sigil', { _sigil_code: sigilCode });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nexus-displayed-sigils'] });
      if (user?.id) qc.invalidateQueries({ queryKey: ['nexus-displayed-sigils', user.id] });
    },
  });
}

export function useSpendBoost() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (boostCode: string): Promise<{ ledgerId: string; tokensRemaining: number; boostCode: string }> => {
      const { data, error } = await (supabase as any).rpc('spend_boost', { _boost_code: boostCode });
      if (error) throw error;
      return {
        ledgerId: data?.ledger_id,
        tokensRemaining: data?.tokens_remaining ?? 0,
        boostCode: data?.boost_code ?? boostCode,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nexus-salvage-wallet', user?.id] });
    },
  });
}

/* ---------- award RPC wrappers (fire-and-forget) ---------- */

export async function awardEndlessMilestone(runId: string): Promise<{ awarded: string[]; tokensEarned: number } | null> {
  try {
    const { data, error } = await (supabase as any).rpc('award_endless_milestone', { _run_id: runId });
    if (error) {
      console.warn('[nexus] award_endless_milestone failed', error.message);
      return null;
    }
    return {
      awarded: (data?.awarded ?? []) as string[],
      tokensEarned: data?.tokens_earned ?? 0,
    };
  } catch (e) {
    console.warn('[nexus] award_endless_milestone threw', e);
    return null;
  }
}

export async function awardOperationRewards(operationId: string): Promise<void> {
  try {
    await (supabase as any).rpc('award_operation_rewards', { _operation_id: operationId });
  } catch (e) {
    console.warn('[nexus] award_operation_rewards failed', e);
  }
}

export async function attachRunBoost(ledgerId: string, runId: string): Promise<void> {
  try {
    await (supabase as any).rpc('attach_run_boost', { _ledger_id: ledgerId, _nexus_run_id: runId });
  } catch (e) {
    console.warn('[nexus] attach_run_boost failed', e);
  }
}
