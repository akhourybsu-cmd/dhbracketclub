// Nexus Defense — Rewards hooks (Phase A).
// Backs salvage wallet, sigils (catalog + user-owned + displayed),
// boost catalog, purchase/award RPCs.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { SigilRarity } from '@/lib/nexus/sigilStyle';

export interface SigilDef {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  rarity: SigilRarity;
  glow_color: string;
  source: string;
}

export interface UserSigil {
  sigil_id: string;
  earned_at: string;
  is_displayed: boolean;
  source_ref: string | null;
  // joined fields
  code: string;
  name: string;
  description: string;
  icon: string;
  rarity: SigilRarity;
  glow_color: string;
}

export interface SalvageWallet {
  user_id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
}

export interface BoostDef {
  id: string;
  code: string;
  name: string;
  description: string;
  cost_tokens: number;
  icon: string;
  effect_config: Record<string, any>;
}

export interface PendingBoost {
  code: string;
  name: string;
  icon: string;
  effect_config: Record<string, any>;
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
        .eq('is_active', true)
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
      return (
        (data as SalvageWallet) ?? {
          user_id: user.id,
          balance: 0,
          lifetime_earned: 0,
          lifetime_spent: 0,
        }
      );
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
        .select('sigil_id, earned_at, is_displayed, source_ref, nexus_sigils(code,name,description,icon,rarity,glow_color)')
        .eq('user_id', targetId)
        .order('earned_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        sigil_id: r.sigil_id,
        earned_at: r.earned_at,
        is_displayed: r.is_displayed,
        source_ref: r.source_ref,
        code: r.nexus_sigils?.code,
        name: r.nexus_sigils?.name,
        description: r.nexus_sigils?.description,
        icon: r.nexus_sigils?.icon,
        rarity: r.nexus_sigils?.rarity as SigilRarity,
        glow_color: r.nexus_sigils?.glow_color,
      })) as UserSigil[];
    },
  });
}

/** Pending pre-run boost loaded by the player (if any). */
export function usePendingBoost() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['nexus-pending-boost', user?.id],
    enabled: !!user,
    staleTime: 10_000,
    queryFn: async (): Promise<PendingBoost | null> => {
      const { data, error } = await (supabase as any).rpc('get_boost_for_run');
      if (error) throw error;
      return (data as PendingBoost | null) ?? null;
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
    queryFn: async (): Promise<Record<string, { code: string; rarity: SigilRarity; icon: string; name: string }>> => {
      if (userIds.length === 0) return {};
      const { data } = await (supabase as any)
        .from('nexus_user_sigils')
        .select('user_id, nexus_sigils(code,rarity,icon,name)')
        .eq('is_displayed', true)
        .in('user_id', userIds);
      const map: Record<string, any> = {};
      for (const r of (data ?? []) as any[]) {
        if (r.nexus_sigils) {
          map[r.user_id] = {
            code: r.nexus_sigils.code,
            rarity: r.nexus_sigils.rarity as SigilRarity,
            icon: r.nexus_sigils.icon,
            name: r.nexus_sigils.name,
          };
        }
      }
      return map;
    },
  });
}

/* ---------- mutations ---------- */

export function useSetDisplayedSigil() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sigilCode: string | null): Promise<void> => {
      const { error } = await (supabase as any).rpc('set_displayed_sigil', {
        _sigil_code: sigilCode ?? '',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nexus-displayed-sigils'] });
      if (user?.id) qc.invalidateQueries({ queryKey: ['nexus-user-sigils', user.id] });
    },
  });
}

export function usePurchaseBoost() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (boostCode: string): Promise<{ ok: boolean; spent: number; boostCode: string }> => {
      const { data, error } = await (supabase as any).rpc('purchase_boost', { _boost_code: boostCode });
      if (error) throw error;
      return {
        ok: data?.ok ?? false,
        spent: data?.spent ?? 0,
        boostCode: data?.boost_code ?? boostCode,
      };
    },
    onSuccess: () => {
      if (user?.id) {
        qc.invalidateQueries({ queryKey: ['nexus-salvage-wallet', user.id] });
        qc.invalidateQueries({ queryKey: ['nexus-pending-boost', user.id] });
      }
    },
  });
}

/* ---------- award RPC wrappers (fire-and-forget) ---------- */

export async function consumeBoostForRun(runId: string): Promise<PendingBoost | null> {
  try {
    const { data, error } = await (supabase as any).rpc('consume_boost', { _run_id: runId });
    if (error) {
      console.warn('[nexus] consume_boost failed', error.message);
      return null;
    }
    if (!data?.boost_code) return null;
    return {
      code: data.boost_code,
      name: data.boost_code,
      icon: 'zap',
      effect_config: data.effect_config ?? {},
    };
  } catch (e) {
    console.warn('[nexus] consume_boost threw', e);
    return null;
  }
}

export async function awardEndlessRewards(
  runId: string,
  waveReached: number,
): Promise<{ sigils: Array<{ code: string; first_time: boolean }>; tokens: number } | null> {
  try {
    const { data, error } = await (supabase as any).rpc('award_endless_rewards', {
      _run_id: runId,
      _wave_reached: waveReached,
    });
    if (error) {
      console.warn('[nexus] award_endless_rewards failed', error.message);
      return null;
    }
    return {
      sigils: (data?.sigils ?? []) as Array<{ code: string; first_time: boolean }>,
      tokens: data?.tokens ?? 0,
    };
  } catch (e) {
    console.warn('[nexus] award_endless_rewards threw', e);
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
