import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { freshSeed, generateDungeon } from '@/lib/runedelve/dungeonGenerator';
import { format } from 'date-fns';

export interface RuneDelveDungeon {
  id: string;
  run_date: string; // ISO date YYYY-MM-DD
  seed: number;
  enemy_config: any;
  max_turns: number;
}

function todayDate(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

// Fetch today's dungeon, creating it if missing.
export function useTodayDungeon() {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['rune-delve-dungeon', todayDate()],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<RuneDelveDungeon> => {
      const date = todayDate();
      const { data: existing } = await (supabase as any)
        .from('rune_delve_dungeons')
        .select('*')
        .eq('run_date', date)
        .maybeSingle();
      if (existing) return existing as RuneDelveDungeon;

      // Seed today's dungeon if it doesn't exist (any authenticated user can do this).
      const seed = freshSeed();
      const cfg = generateDungeon(seed);
      const { data, error } = await (supabase as any)
        .from('rune_delve_dungeons')
        .insert({
          run_date: date,
          seed,
          enemy_config: cfg.enemies,
          max_turns: cfg.maxTurns,
        })
        .select()
        .single();
      if (error) {
        // Race: someone else inserted first — fetch again.
        const { data: again } = await (supabase as any)
          .from('rune_delve_dungeons')
          .select('*')
          .eq('run_date', date)
          .maybeSingle();
        if (again) return again as RuneDelveDungeon;
        throw error;
      }
      qc.invalidateQueries({ queryKey: ['rune-delve-leaderboard'] });
      return data as RuneDelveDungeon;
    },
  });
}

export interface RuneDelveRun {
  id: string;
  user_id: string;
  dungeon_id: string;
  run_date: string;
  score: number;
  enemies_defeated: number;
  dungeon_cleared: boolean;
  turns_used: number;
  total_damage: number;
  longest_chain: number;
  hp_remaining: number;
  xp_earned: number;
  ability_used: boolean;
  hero_class: string;
  completed_at: string;
}

export function useMyTodayRun(dungeonId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['rune-delve-my-run', dungeonId, user?.id],
    enabled: !!user && !!dungeonId,
    staleTime: 30_000,
    queryFn: async (): Promise<RuneDelveRun | null> => {
      if (!user || !dungeonId) return null;
      const { data, error } = await (supabase as any)
        .from('rune_delve_runs')
        .select('*')
        .eq('user_id', user.id)
        .eq('dungeon_id', dungeonId)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return (data as RuneDelveRun) ?? null;
    },
  });
}

export function useSubmitRun() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: Omit<RuneDelveRun, 'id' | 'user_id' | 'completed_at'> & { pick_log?: any[] }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await (supabase as any)
        .from('rune_delve_runs')
        .insert({
          user_id: user.id,
          ...params,
        })
        .select()
        .single();
      if (error) throw error;
      return data as RuneDelveRun;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rune-delve-my-run'] });
      qc.invalidateQueries({ queryKey: ['rune-delve-leaderboard'] });
      qc.invalidateQueries({ queryKey: ['rune-delve-history'] });
      qc.invalidateQueries({ queryKey: ['rune-delve-hero', user?.id] });
    },
  });
}

export function useDailyLeaderboard(dungeonId: string | undefined) {
  return useQuery({
    queryKey: ['rune-delve-leaderboard', dungeonId],
    enabled: !!dungeonId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!dungeonId) return [];
      const { data: runs, error } = await (supabase as any)
        .from('rune_delve_runs')
        .select('*')
        .eq('dungeon_id', dungeonId)
        .order('score', { ascending: false });
      if (error) throw error;
      const list = (runs ?? []) as RuneDelveRun[];
      const userIds = Array.from(new Set(list.map(r => r.user_id)));
      let profiles: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
      if (userIds.length) {
        const { data: pdata } = await supabase
          .from('profiles').select('id, display_name, avatar_url').in('id', userIds);
        profiles = Object.fromEntries((pdata ?? []).map((p: any) => [p.id, p]));
      }
      // Fetch hero identity for richer leaderboard rows.
      let heroes: Record<string, { class: string; current_streak: number; level: number; hero_name: string; cosmetic_title: string | null }> = {};
      if (userIds.length) {
        const { data: hdata } = await (supabase as any)
          .from('rune_delve_heroes')
          .select('user_id, class, current_streak, level, hero_name, cosmetic_title')
          .in('user_id', userIds);
        heroes = Object.fromEntries((hdata ?? []).map((h: any) => [h.user_id, h]));
      }
      return list.map((r, i) => ({
        ...r,
        rank: i + 1,
        profile: profiles[r.user_id] ?? { display_name: 'Unknown', avatar_url: null },
        hero: heroes[r.user_id] ?? null,
      }));
    },
  });
}

export function useRunHistory(limit = 20) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['rune-delve-history', user?.id, limit],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await (supabase as any)
        .from('rune_delve_runs')
        .select('*')
        .eq('user_id', user.id)
        .order('run_date', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as RuneDelveRun[];
    },
  });
}
