import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  todayUtcDateString,
  rollDailyModifiers,
  dailyLevelFor,
  dailyStarsFor,
  computeDailyReward,
} from '@/lib/runedelve/dailyChallenge';
import type { DailyModifierId } from '@/lib/runedelve/dailyModifiers';
import type { HeroClass } from '@/lib/runedelve/classConfig';

export interface DailyRunRow {
  id: string;
  user_id: string;
  daily_date: string;
  score: number;
  stars: number;
  dungeon_cleared: boolean;
  modifiers: DailyModifierId[];
  hero_class: HeroClass;
  completed_at: string;
}

export interface DailyStreakRow {
  user_id: string;
  current_streak: number;
  best_streak: number;
  last_completed_date: string | null;
  lifetime_clears: number;
}

/** Today's daily roll — pure date-derived data, no network needed. */
export function useTodayDaily() {
  const dateStr = todayUtcDateString();
  return {
    dateStr,
    modifiers: rollDailyModifiers(dateStr),
    levelNumber: dailyLevelFor(dateStr),
  };
}

/** The current player's daily run row for today (null if not played). */
export function useMyDailyRun() {
  const { user } = useAuth();
  const dateStr = todayUtcDateString();
  return useQuery({
    queryKey: ['rd-daily-run', user?.id, dateStr],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<DailyRunRow | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('rune_delve_daily_runs')
        .select('*')
        .eq('user_id', user.id)
        .eq('daily_date', dateStr)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as DailyRunRow) ?? null;
    },
  });
}

/** Player's streak record (null until they've played a daily). */
export function useMyDailyStreak() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['rd-daily-streak', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async (): Promise<DailyStreakRow | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('rune_delve_daily_streaks')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as DailyStreakRow) ?? null;
    },
  });
}

/** Today's leaderboard — top scores for the daily challenge. */
export function useDailyLeaderboard(limit = 10) {
  const dateStr = todayUtcDateString();
  return useQuery({
    queryKey: ['rd-daily-leaderboard', dateStr, limit],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rune_delve_daily_runs')
        .select('id, user_id, score, stars, dungeon_cleared, hero_class, completed_at')
        .eq('daily_date', dateStr)
        .order('score', { ascending: false })
        .limit(limit);
      if (error) throw error;
      // Best-effort profile join — light columns only.
      const ids = (data ?? []).map(d => d.user_id);
      let profiles: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', ids);
        profiles = Object.fromEntries((profs ?? []).map(p => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }]));
      }
      return (data ?? []).map((row, i) => ({
        ...row,
        rank: i + 1,
        profile: profiles[row.user_id] ?? { display_name: null, avatar_url: null },
      }));
    },
  });
}

/**
 * Submit today's daily run. Idempotent at the DB layer (unique constraint on
 * user_id + daily_date) — we use upsert so retries replace a prior row only
 * when the new score is higher. Also updates the streak record.
 */
export function useSubmitDailyRun() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      score: number;
      cleared: boolean;
      heroClass: HeroClass;
      levelNumber: number;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const dateStr = todayUtcDateString();
      const modifiers = rollDailyModifiers(dateStr);
      const stars = dailyStarsFor(params.score, params.levelNumber, params.cleared);

      // Upsert run — only overwrite an existing row when the new score is higher.
      const { data: existing } = await supabase
        .from('rune_delve_daily_runs')
        .select('score')
        .eq('user_id', user.id)
        .eq('daily_date', dateStr)
        .maybeSingle();

      if (!existing || params.score > (existing.score ?? 0)) {
        const { error } = await supabase
          .from('rune_delve_daily_runs')
          .upsert([{
            user_id: user.id,
            daily_date: dateStr,
            score: params.score,
            stars,
            dungeon_cleared: params.cleared,
            modifiers: modifiers as unknown as object,
            hero_class: params.heroClass,
            completed_at: new Date().toISOString(),
          }], { onConflict: 'user_id,daily_date' });
        if (error) throw error;
      }

      // Update streak (only on a clear).
      let nextStreak = 0;
      if (params.cleared) {
        const { data: streak } = await supabase
          .from('rune_delve_daily_streaks')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        const today = dateStr;
        const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const last = (streak as { last_completed_date: string | null } | null)?.last_completed_date ?? null;
        const prevStreak = (streak as { current_streak: number } | null)?.current_streak ?? 0;
        const bestStreak = (streak as { best_streak: number } | null)?.best_streak ?? 0;
        const lifetime = (streak as { lifetime_clears: number } | null)?.lifetime_clears ?? 0;

        if (last === today) {
          nextStreak = prevStreak; // already counted today
        } else if (last === yesterdayStr) {
          nextStreak = prevStreak + 1;
        } else {
          nextStreak = 1;
        }

        await supabase
          .from('rune_delve_daily_streaks')
          .upsert({
            user_id: user.id,
            current_streak: nextStreak,
            best_streak: Math.max(bestStreak, nextStreak),
            last_completed_date: today,
            lifetime_clears: last === today ? lifetime : lifetime + 1,
          }, { onConflict: 'user_id' });
      }

      const reward = computeDailyReward(stars, nextStreak);
      return { stars, reward, dateStr };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rd-daily-run'] });
      qc.invalidateQueries({ queryKey: ['rd-daily-streak'] });
      qc.invalidateQueries({ queryKey: ['rd-daily-leaderboard'] });
    },
  });
}
