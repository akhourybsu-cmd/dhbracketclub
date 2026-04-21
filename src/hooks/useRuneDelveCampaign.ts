import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { generateLevel, chapterFor, type LevelDefinition } from '@/lib/runedelve/levelGenerator';

export interface RuneDelveLevel {
  id: string;
  level_number: number;
  chapter: number;
  difficulty_tier: number;
  generation_seed: number;
  board_size: number;
  enemy_config: any;
  turn_limit: number;
  objective_type: string;
  objective_target: number;
  modifiers: any;
  status: string;
}

export interface RuneDelveProgress {
  id: string;
  user_id: string;
  highest_unlocked_level: number;
  highest_completed_level: number;
  total_levels_cleared: number;
  current_chapter: number;
}

// Fetch a single canonical level by number; auto-generate + persist if missing.
export function useLevel(levelNumber: number | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['rune-delve-level', levelNumber],
    enabled: typeof levelNumber === 'number' && levelNumber > 0,
    staleTime: Infinity,
    queryFn: async (): Promise<RuneDelveLevel> => {
      if (!levelNumber) throw new Error('No level number');
      const { data: existing } = await (supabase as any)
        .from('rune_delve_levels')
        .select('*')
        .eq('level_number', levelNumber)
        .maybeSingle();
      if (existing) return existing as RuneDelveLevel;

      // Generate deterministically client-side, then attempt to persist.
      // RLS only allows admins to insert — non-admins will fall through to the
      // re-fetch (someone else, or a future admin, will seed it). Until then,
      // we still return a transient level so play can continue.
      const def: LevelDefinition = generateLevel(levelNumber);
      const { data: inserted, error } = await (supabase as any)
        .from('rune_delve_levels')
        .insert({
          level_number: def.level_number,
          chapter: def.chapter,
          difficulty_tier: def.difficulty_tier,
          generation_seed: def.generation_seed,
          board_size: def.board_size,
          enemy_config: def.enemy_config,
          turn_limit: def.turn_limit,
          objective_type: def.objective_type,
          objective_target: def.objective_target,
          modifiers: def.modifiers,
        })
        .select()
        .maybeSingle();
      if (inserted) {
        qc.invalidateQueries({ queryKey: ['rune-delve-levels-batch'] });
        return inserted as RuneDelveLevel;
      }
      // Race or RLS denial — try fetch once more, otherwise return a transient
      // level shaped like a DB row so the UI can render and the user can play.
      const { data: again } = await (supabase as any)
        .from('rune_delve_levels')
        .select('*')
        .eq('level_number', levelNumber)
        .maybeSingle();
      if (again) return again as RuneDelveLevel;
      return {
        id: `transient-${def.level_number}`,
        level_number: def.level_number,
        chapter: def.chapter,
        difficulty_tier: def.difficulty_tier,
        generation_seed: def.generation_seed,
        board_size: def.board_size,
        enemy_config: def.enemy_config,
        turn_limit: def.turn_limit,
        objective_type: def.objective_type,
        objective_target: def.objective_target,
        modifiers: def.modifiers,
        status: 'active',
      };
    },
  });
}

// Fetch a window of levels (for the level map). Generates missing rows lazily on
// open of each — which is fine for the size of the window.
export function useLevelWindow(start: number, count: number) {
  return useQuery({
    queryKey: ['rune-delve-levels-batch', start, count],
    staleTime: 60_000,
    queryFn: async (): Promise<RuneDelveLevel[]> => {
      const numbers = Array.from({ length: count }, (_, i) => start + i).filter(n => n >= 1);
      const { data } = await (supabase as any)
        .from('rune_delve_levels')
        .select('*')
        .in('level_number', numbers);
      const byNum = new Map<number, RuneDelveLevel>();
      (data ?? []).forEach((r: any) => byNum.set(r.level_number, r as RuneDelveLevel));
      // Synthesize transient rows for any numbers the DB doesn't have yet so the
      // map is fully populated. They share the same seed so they will eventually
      // hydrate into identical canonical rows when an admin (or first run) seeds them.
      return numbers.map(n => {
        const existing = byNum.get(n);
        if (existing) return existing;
        const def = generateLevel(n);
        return {
          id: `transient-${n}`,
          level_number: n,
          chapter: def.chapter,
          difficulty_tier: def.difficulty_tier,
          generation_seed: def.generation_seed,
          board_size: def.board_size,
          enemy_config: def.enemy_config,
          turn_limit: def.turn_limit,
          objective_type: def.objective_type,
          objective_target: def.objective_target,
          modifiers: def.modifiers,
          status: 'active',
        } as RuneDelveLevel;
      }).sort((a, b) => a.level_number - b.level_number);
    },
  });
}

// Per-player progress. Auto-creates row on first read.
export function useMyProgress() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['rune-delve-progress', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async (): Promise<RuneDelveProgress | null> => {
      if (!user) return null;
      const { data: existing } = await (supabase as any)
        .from('rune_delve_progress')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (existing) return existing as RuneDelveProgress;
      const { data: created } = await (supabase as any)
        .from('rune_delve_progress')
        .insert({ user_id: user.id })
        .select()
        .single();
      qc.invalidateQueries({ queryKey: ['rune-delve-progress-leaderboard'] });
      return created as RuneDelveProgress;
    },
  });
}

// All runs for a given level by current user (latest best-score upserted).
// Self-healing: always revalidates on mount/focus, and if the play page just
// submitted a run for this level (sessionStorage signal) we briefly poll until
// the row appears — this eliminates the post-submit race that left users
// staring at "No run yet" until they cleared their cache.
export function useMyLevelRun(levelId: string | undefined, levelNumber?: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['rune-delve-level-run', levelId, user?.id],
    enabled: !!user && !!levelId && !levelId.startsWith('transient-'),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!user || !levelId) return null;
      const fetchOnce = async () => {
        const { data } = await (supabase as any)
          .from('rune_delve_runs')
          .select('*')
          .eq('user_id', user.id)
          .eq('level_id', levelId)
          .maybeSingle();
        return data ?? null;
      };
      let row = await fetchOnce();
      if (row) return row;

      // If the play page just submitted, give the write a few short retries
      // to land before we report "no run yet".
      let justSubmitted = false;
      try {
        if (typeof levelNumber === 'number' && typeof sessionStorage !== 'undefined') {
          const key = `rd-just-submitted-${levelNumber}`;
          const ts = sessionStorage.getItem(key);
          if (ts && Date.now() - parseInt(ts, 10) < 15_000) {
            justSubmitted = true;
          }
        }
      } catch { /* sessionStorage may be unavailable */ }

      if (!justSubmitted) return null;

      for (let i = 0; i < 4; i++) {
        await new Promise(r => setTimeout(r, 400));
        row = await fetchOnce();
        if (row) {
          try {
            if (typeof levelNumber === 'number') {
              sessionStorage.removeItem(`rd-just-submitted-${levelNumber}`);
            }
          } catch { /* noop */ }
          return row;
        }
      }
      return null;
    },
  });
}

// Submit (upsert) a run: keeps the higher score for the level.
export function useSubmitLevelRun() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      level_id: string;
      level_number: number;
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
    }) => {
      if (!user) throw new Error('Not authenticated');

      // Read existing best — upsert manually to keep best-score semantics.
      const { data: existing } = await (supabase as any)
        .from('rune_delve_runs')
        .select('id, score')
        .eq('user_id', user.id)
        .eq('level_id', params.level_id)
        .maybeSingle();

      if (existing && existing.score >= params.score) {
        // Keep the existing best, but update meta fields for the latest attempt.
        const { data } = await (supabase as any)
          .from('rune_delve_runs')
          .update({
            // intentionally only persist non-score meta to preserve best-of behavior
            ability_used: params.ability_used,
          })
          .eq('id', existing.id)
          .select()
          .single();
        return data;
      }
      if (existing) {
        const { data } = await (supabase as any)
          .from('rune_delve_runs')
          .update({
            score: params.score,
            enemies_defeated: params.enemies_defeated,
            dungeon_cleared: params.dungeon_cleared,
            turns_used: params.turns_used,
            total_damage: params.total_damage,
            longest_chain: params.longest_chain,
            hp_remaining: params.hp_remaining,
            xp_earned: params.xp_earned,
            ability_used: params.ability_used,
            hero_class: params.hero_class,
            level_number: params.level_number,
          })
          .eq('id', existing.id)
          .select()
          .single();
        return data;
      }
      const { data, error } = await (supabase as any)
        .from('rune_delve_runs')
        .insert({
          user_id: user.id,
          ...params,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rune-delve-level-run'] });
      qc.invalidateQueries({ queryKey: ['rune-delve-progress'] });
      qc.invalidateQueries({ queryKey: ['rune-delve-progress-leaderboard'] });
      qc.invalidateQueries({ queryKey: ['rune-delve-history'] });
      qc.invalidateQueries({ queryKey: ['rune-delve-hero', user?.id] });
    },
  });
}

// Advance progress after a successful clear: unlocks the next level.
export function useAdvanceProgress() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (clearedLevel: number) => {
      if (!user) throw new Error('Not authenticated');
      const { data: existing } = await (supabase as any)
        .from('rune_delve_progress')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      const current: RuneDelveProgress = existing ?? {
        id: '',
        user_id: user.id,
        highest_unlocked_level: 1,
        highest_completed_level: 0,
        total_levels_cleared: 0,
        current_chapter: 1,
      };
      const isNewClear = clearedLevel > current.highest_completed_level;
      const newCompleted = Math.max(current.highest_completed_level, clearedLevel);
      const newUnlocked = Math.max(current.highest_unlocked_level, clearedLevel + 1);
      const newTotal = current.total_levels_cleared + (isNewClear ? 1 : 0);
      const payload = {
        highest_unlocked_level: newUnlocked,
        highest_completed_level: newCompleted,
        total_levels_cleared: newTotal,
        current_chapter: chapterFor(newUnlocked),
      };
      if (existing) {
        const { data } = await (supabase as any)
          .from('rune_delve_progress')
          .update(payload)
          .eq('user_id', user.id)
          .select()
          .single();
        return data;
      }
      const { data } = await (supabase as any)
        .from('rune_delve_progress')
        .insert({ user_id: user.id, ...payload })
        .select()
        .single();
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rune-delve-progress'] });
      qc.invalidateQueries({ queryKey: ['rune-delve-progress-leaderboard'] });
    },
  });
}

// Campaign leaderboard — ranked by highest_completed_level then total cleared.
export function useCampaignLeaderboard() {
  return useQuery({
    queryKey: ['rune-delve-progress-leaderboard'],
    staleTime: 30_000,
    queryFn: async () => {
      const { data: rows } = await (supabase as any)
        .from('rune_delve_progress')
        .select('*')
        .order('highest_completed_level', { ascending: false })
        .order('total_levels_cleared', { ascending: false })
        .limit(100);
      const list = (rows ?? []) as RuneDelveProgress[];
      const userIds = Array.from(new Set(list.map(r => r.user_id)));
      let profiles: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
      let heroes: Record<string, { class: string; level: number; hero_name: string; cosmetic_title: string | null; current_streak: number }> = {};
      if (userIds.length) {
        const [{ data: pdata }, { data: hdata }] = await Promise.all([
          supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds),
          (supabase as any).from('rune_delve_heroes').select('user_id, class, level, hero_name, cosmetic_title, current_streak').in('user_id', userIds),
        ]);
        profiles = Object.fromEntries((pdata ?? []).map((p: any) => [p.id, p]));
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

// Best score per level across all players (top 5) — for the level details popover.
export function useLevelBestScores(levelId: string | undefined) {
  return useQuery({
    queryKey: ['rune-delve-level-best', levelId],
    enabled: !!levelId && !levelId.startsWith('transient-'),
    staleTime: 30_000,
    queryFn: async () => {
      if (!levelId) return [];
      const { data: runs } = await (supabase as any)
        .from('rune_delve_runs')
        .select('*')
        .eq('level_id', levelId)
        .order('score', { ascending: false })
        .limit(5);
      const list = runs ?? [];
      const userIds = Array.from(new Set(list.map((r: any) => r.user_id))) as string[];
      let heroes: Record<string, { hero_name: string; class: string }> = {};
      if (userIds.length) {
        const { data: hdata } = await (supabase as any)
          .from('rune_delve_heroes').select('user_id, hero_name, class').in('user_id', userIds);
        heroes = Object.fromEntries((hdata ?? []).map((h: any) => [h.user_id, h]));
      }
      return list.map((r: any, i: number) => ({
        ...r,
        rank: i + 1,
        hero: heroes[r.user_id] ?? null,
      }));
    },
  });
}
