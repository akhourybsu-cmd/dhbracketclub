import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type PwStatus = 'upcoming' | 'locked' | 'active' | 'completed' | 'archived';
export interface PwChallenge {
  id: string;
  week_number: number;
  year: number;
  week_start: string;
  week_end: string;
  lock_at: string;
  end_at: string;
  status: PwStatus;
  start_trading_date: string | null;
  end_trading_date: string | null;
  finalized_at: string | null;
}
export interface PwPick {
  id: string;
  entry_id: string;
  ticker: string;
  position: number;
  start_price: number | null;
  end_price: number | null;
  latest_price: number | null;
  pct_change: number | null;
}
export interface PwEntry {
  id: string;
  challenge_id: string;
  user_id: string;
  submitted_at: string;
  locked_at: string | null;
  avg_pct: number | null;
  final_rank: number | null;
}
export interface PwAccolade {
  id: string;
  challenge_id: string;
  user_id: string;
  kind: string;
  ticker: string | null;
  value: number | null;
}

/** Most relevant challenge for the lobby: prefer active > upcoming > most recent completed. */
export function useCurrentChallenge() {
  return useQuery({
    queryKey: ['pw-current-challenge'],
    queryFn: async () => {
      // Try active
      const { data: act } = await supabase.from('pw_challenges').select('*')
        .in('status', ['active', 'locked']).order('week_start', { ascending: false }).limit(1).maybeSingle();
      if (act) return act as PwChallenge;
      const { data: up } = await supabase.from('pw_challenges').select('*')
        .eq('status', 'upcoming').order('week_start', { ascending: true }).limit(1).maybeSingle();
      if (up) return up as PwChallenge;
      const { data: done } = await supabase.from('pw_challenges').select('*')
        .in('status', ['completed', 'archived']).order('week_start', { ascending: false }).limit(1).maybeSingle();
      return (done as PwChallenge) || null;
    },
    staleTime: 1000 * 60,
  });
}

export function useAllChallenges() {
  return useQuery({
    queryKey: ['pw-challenges'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pw_challenges').select('*')
        .order('week_start', { ascending: false });
      if (error) throw error;
      return (data || []) as PwChallenge[];
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useMyEntry(challengeId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['pw-entry', challengeId, user?.id],
    enabled: !!challengeId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('pw_entries').select('*, pw_picks(*)')
        .eq('challenge_id', challengeId!).eq('user_id', user!.id).maybeSingle();
      if (error) throw error;
      return data as (PwEntry & { pw_picks: PwPick[] }) | null;
    },
  });
}

export function useChallengeLeaderboard(challengeId?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['pw-leaderboard', challengeId],
    enabled: !!challengeId,
    queryFn: async () => {
      const { data: entries, error } = await supabase.from('pw_entries')
        .select('*, pw_picks(*)').eq('challenge_id', challengeId!);
      if (error) throw error;
      const userIds = [...new Set((entries || []).map((e: any) => e.user_id))];
      const { data: profs } = await supabase.from('profiles')
        .select('id, display_name, avatar_url').in('id', userIds);
      const profMap = new Map((profs || []).map((p: any) => [p.id, p]));
      return (entries || []).map((e: any) => ({
        ...e,
        profile: profMap.get(e.user_id) || null,
      })).sort((a: any, b: any) => {
        const av = a.avg_pct ?? -Infinity;
        const bv = b.avg_pct ?? -Infinity;
        return bv - av;
      });
    },
    staleTime: 1000 * 30,
  });

  // Realtime: refresh leaderboard when picks/entries change for this challenge
  useEffect(() => {
    if (!challengeId) return;
    const channel = supabase
      .channel(`pw-leaderboard-${challengeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pw_picks' },
        () => qc.invalidateQueries({ queryKey: ['pw-leaderboard', challengeId] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pw_entries', filter: `challenge_id=eq.${challengeId}` },
        () => qc.invalidateQueries({ queryKey: ['pw-leaderboard', challengeId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [challengeId, qc]);

  return query;
}

export function useChallengeAccolades(challengeId?: string) {
  return useQuery({
    queryKey: ['pw-accolades', challengeId],
    enabled: !!challengeId,
    queryFn: async () => {
      const { data, error } = await supabase.from('pw_accolades').select('*').eq('challenge_id', challengeId!);
      if (error) throw error;
      return (data || []) as PwAccolade[];
    },
  });
}

export function useSubmitPicks() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ challengeId, tickers }: { challengeId: string; tickers: string[] }) => {
      if (!user) throw new Error('Not signed in');
      if (tickers.length !== 3) throw new Error('Pick exactly 3 tickers');
      const unique = [...new Set(tickers.map((t) => t.toUpperCase()))];
      if (unique.length !== 3) throw new Error('Tickers must be unique');
      // Upsert entry
      const { data: existing } = await supabase.from('pw_entries').select('id')
        .eq('challenge_id', challengeId).eq('user_id', user.id).maybeSingle();
      let entryId = existing?.id as string | undefined;
      if (!entryId) {
        const { data, error } = await supabase.from('pw_entries').insert({
          challenge_id: challengeId, user_id: user.id,
        }).select('id').single();
        if (error) throw error;
        entryId = data.id;
      }
      // Replace picks (delete + insert)
      await supabase.from('pw_picks').delete().eq('entry_id', entryId!);
      const rows = unique.map((ticker, i) => ({ entry_id: entryId!, ticker, position: i + 1 }));
      const { error: pErr } = await supabase.from('pw_picks').insert(rows);
      if (pErr) throw pErr;
      return { entryId };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['pw-entry', vars.challengeId] });
      qc.invalidateQueries({ queryKey: ['pw-leaderboard', vars.challengeId] });
    },
  });
}

export function useTickerQuote() {
  return useMutation({
    mutationFn: async (symbol: string) => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pw-quote?symbol=${encodeURIComponent(symbol)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      });
      if (!res.ok) throw new Error(`Quote failed (${res.status})`);
      return res.json();
    },
  });
}

export function usePwAdminAction() {
  return useMutation({
    mutationFn: async (payload: { action: 'open_next' | 'snapshot' | 'lock' | 'finalize'; challenge_id?: string }) => {
      const { data, error } = await supabase.functions.invoke('pw-week-action', { body: payload });
      if (error) throw error;
      return data;
    },
  });
}
