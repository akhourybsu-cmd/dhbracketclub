import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  BASE_CRACK_POINTS, getEfficiencyBonus, getDefensePoints,
  sortCracksForBest, BEST_CRACK_BONUS,
} from '@/lib/lockboxScoring';

// ── Day Bounds ──
function getDayBounds() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 1);

  // Day of year as the identifier
  const yearStart = new Date(Date.UTC(now.getFullYear(), 0, 1));
  const dayOfYear = Math.ceil((start.getTime() - yearStart.getTime()) / 86400000) + 1;

  return { starts_at: start.toISOString(), ends_at: end.toISOString(), week_number: dayOfYear, year: now.getFullYear() };
}

// ── Current Day ──
export function useCurrentDay() {
  return useQuery({
    queryKey: ['lockbox-day'],
    queryFn: async () => {
      const bounds = getDayBounds();
      const { data } = await supabase
        .from('lockbox_weeks').select('*')
        .eq('week_number', bounds.week_number).eq('year', bounds.year)
        .maybeSingle();
      if (data) return data;
      const { data: created, error } = await supabase
        .from('lockbox_weeks').insert(bounds).select().single();
      if (error) {
        const { data: retry } = await supabase
          .from('lockbox_weeks').select('*')
          .eq('week_number', bounds.week_number).eq('year', bounds.year)
          .single();
        return retry;
      }
      return created;
    },
    staleTime: 1000 * 60 * 10,
  });
}

// Keep old export name as alias for backward compat
export const useCurrentWeek = useCurrentDay;

// ── My Lock ──
export function useMyLock(dayId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['lockbox-my-lock', dayId],
    enabled: !!dayId && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('lockbox_locks').select('*')
        .eq('week_id', dayId!).eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
  });
}

// ── Create Lock (with duplicate guard) ──
export function useCreateLock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { week_id: string; user_id: string; number_code: string; color_code: string; maze_grid?: any; maze_id?: number }) => {
      const { data: existing } = await supabase
        .from('lockbox_locks').select('id')
        .eq('week_id', params.week_id).eq('user_id', params.user_id)
        .maybeSingle();
      if (existing) throw new Error('You already have a lock for today');

      const { data, error } = await supabase.from('lockbox_locks').insert(params).select().single();
      if (error) {
        if (error.code === '23505') throw new Error('You already have a lock for today');
        throw error;
      }
      return data;
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ['lockbox-my-lock', vars.week_id] });
      qc.invalidateQueries({ queryKey: ['lockbox-locks'] });

      // Notify others that a new lock is ready to crack
      supabase.auth.getUser().then(({ data: authData }) => {
        const displayName = authData?.user?.user_metadata?.display_name;
        supabase.from('profiles').select('display_name').eq('id', vars.user_id).single().then(({ data: profile }) => {
          const name = profile?.display_name || displayName || 'Someone';
          supabase.functions.invoke('send-push-notification', {
            body: {
              type: 'lockbox',
              title: '🔒 New Lock Ready',
              message: `${name} set up a lock — try to crack it!`,
              url: '/lockbox',
              sender_user_id: vars.user_id,
            },
          }).catch(() => {});
        });
      });
    },
  });
}

// ── Day Locks (others' locks with my attempts) ──
export function useDayLocks(dayId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['lockbox-locks', dayId],
    enabled: !!dayId && !!user,
    queryFn: async () => {
      const { data: locks } = await supabase
        .from('lockbox_locks')
        .select('*, profiles:user_id(display_name, avatar_url)')
        .eq('week_id', dayId!)
        .neq('user_id', user!.id);

      const lockIds = (locks || []).map((l: any) => l.id);
      let attempts: any[] = [];
      if (lockIds.length > 0) {
        const { data } = await supabase
          .from('lockbox_attempts').select('*')
          .in('lock_id', lockIds).eq('attacker_id', user!.id);
        attempts = data || [];
      }

      return (locks || []).map((lock: any) => ({
        ...lock,
        myAttempt: attempts.find((a: any) => a.lock_id === lock.id) || null,
      }));
    },
  });
}

// Keep old export name as alias
export const useWeekLocks = useDayLocks;

// ── ALL locks for a day (for leaderboard/results) ──
export function useAllDayLocks(dayId: string | undefined) {
  return useQuery({
    queryKey: ['lockbox-all-locks', dayId],
    enabled: !!dayId,
    queryFn: async () => {
      const { data } = await supabase
        .from('lockbox_locks')
        .select('*, profiles:user_id(display_name, avatar_url)')
        .eq('week_id', dayId!);
      return data || [];
    },
  });
}

export const useAllWeekLocks = useAllDayLocks;

// ── ALL attempts for a day (for computed leaderboard) ──
export function useAllDayAttempts(dayId: string | undefined) {
  return useQuery({
    queryKey: ['lockbox-all-attempts', dayId],
    enabled: !!dayId,
    queryFn: async () => {
      const { data: locks } = await supabase
        .from('lockbox_locks').select('id').eq('week_id', dayId!);
      const lockIds = (locks || []).map((l: any) => l.id);
      if (lockIds.length === 0) return [];
      const { data } = await supabase
        .from('lockbox_attempts')
        .select('*, profiles:attacker_id(display_name, avatar_url)')
        .in('lock_id', lockIds);
      return data || [];
    },
  });
}

// ── Lock-specific attempts (for lock result detail) ──
export function useLockAttempts(lockId: string | undefined) {
  return useQuery({
    queryKey: ['lockbox-lock-attempts', lockId],
    enabled: !!lockId,
    queryFn: async () => {
      const { data } = await supabase
        .from('lockbox_attempts')
        .select('*, profiles:attacker_id(display_name, avatar_url)')
        .eq('lock_id', lockId!)
        .order('total_attempts', { ascending: true });
      return data || [];
    },
  });
}

// ── Attempt Guesses ──
export function useAttemptGuesses(attemptId: string | undefined) {
  return useQuery({
    queryKey: ['lockbox-guesses', attemptId],
    enabled: !!attemptId,
    queryFn: async () => {
      const { data } = await supabase
        .from('lockbox_guesses').select('*')
        .eq('attempt_id', attemptId!)
        .order('created_at', { ascending: true });
      return data || [];
    },
  });
}

// ── Submit Guess ──
export function useSubmitGuess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      lockId: string;
      attackerId: string;
      phase: 'number' | 'color' | 'maze';
      guessValue: string;
      lockCode: string;
    }) => {
      // Check if lock's day is still active
      const { data: lockData } = await supabase
        .from('lockbox_locks')
        .select('week_id')
        .eq('id', params.lockId)
        .single();
      if (lockData) {
        const { data: dayData } = await supabase
          .from('lockbox_weeks')
          .select('ends_at')
          .eq('id', lockData.week_id)
          .single();
        if (dayData && new Date(dayData.ends_at) < new Date()) {
          throw new Error('Today\'s round has ended — no more guesses allowed');
        }
      }

      // Get or create attempt (with race condition guard)
      let { data: attempt } = await supabase
        .from('lockbox_attempts').select('*')
        .eq('lock_id', params.lockId).eq('attacker_id', params.attackerId)
        .maybeSingle();

      if (!attempt) {
        const { data: newAttempt, error } = await supabase
          .from('lockbox_attempts')
          .insert({ lock_id: params.lockId, attacker_id: params.attackerId, phase: 'number', total_attempts: 0 })
          .select().single();
        if (error) {
          const { data: retry } = await supabase
            .from('lockbox_attempts').select('*')
            .eq('lock_id', params.lockId).eq('attacker_id', params.attackerId)
            .single();
          if (!retry) throw error;
          attempt = retry;
        } else {
          attempt = newAttempt;
        }
      }

      if (attempt.is_solved) {
        throw new Error('You already cracked this lock');
      }
      if (params.phase !== attempt.phase) {
        throw new Error(`Expected phase "${attempt.phase}" but got "${params.phase}"`);
      }

      const guessArr = params.guessValue.split(',');
      const codeArr = params.lockCode.split(',');
      let correctPosition = 0;
      let correctValue = 0;

      if (params.phase !== 'maze') {
        const usedGuess = new Array(3).fill(false);
        const usedCode = new Array(3).fill(false);

        for (let i = 0; i < 3; i++) {
          if (guessArr[i] === codeArr[i]) { correctPosition++; usedGuess[i] = true; usedCode[i] = true; }
        }
        for (let i = 0; i < 3; i++) {
          if (usedGuess[i]) continue;
          for (let j = 0; j < 3; j++) {
            if (usedCode[j]) continue;
            if (guessArr[i] === codeArr[j]) { correctValue++; usedCode[j] = true; break; }
          }
        }
      } else {
        correctPosition = params.guessValue === 'solved' ? 1 : 0;
      }

      const isCorrect = params.phase === 'maze'
        ? params.guessValue === 'solved'
        : correctPosition === 3;

      await supabase.from('lockbox_guesses').insert({
        attempt_id: attempt.id, phase: params.phase,
        guess_value: params.guessValue,
        correct_position: correctPosition, correct_value: correctValue,
        is_correct: isCorrect,
      });

      const newTotal = (attempt.total_attempts || 0) + 1;
      const updates: any = { total_attempts: newTotal, updated_at: new Date().toISOString() };

      if (isCorrect) {
        if (params.phase === 'number') updates.phase = 'color';
        else if (params.phase === 'color') updates.phase = 'maze';
        else if (params.phase === 'maze') {
          updates.is_solved = true;
          updates.solved_at = new Date().toISOString();
          await supabase.from('lockbox_locks').update({ is_cracked: true }).eq('id', params.lockId);

          // Notify the lock owner that their lock was cracked
          const { data: lockOwner } = await supabase
            .from('lockbox_locks')
            .select('user_id, profiles:user_id(display_name)')
            .eq('id', params.lockId)
            .single();

          if (lockOwner && lockOwner.user_id !== params.attackerId) {
            const { data: attackerProfile } = await supabase
              .from('profiles').select('display_name').eq('id', params.attackerId).single();
            const attackerName = attackerProfile?.display_name || 'Someone';

            supabase.functions.invoke('send-push-notification', {
              body: {
                type: 'lockbox',
                title: '💔 Your Lock Was Cracked!',
                message: `${attackerName} cracked your lock!`,
                url: '/lockbox',
                sender_user_id: params.attackerId,
                target_user_id: lockOwner.user_id,
              },
            }).catch(() => {});
          }
        }
      }

      await supabase.from('lockbox_attempts').update(updates).eq('id', attempt.id);

      return { correctPosition, correctValue, isCorrect, phase: params.phase, newPhase: updates.phase };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lockbox-locks'] });
      qc.invalidateQueries({ queryKey: ['lockbox-guesses'] });
      qc.invalidateQueries({ queryKey: ['lockbox-all-attempts'] });
      qc.invalidateQueries({ queryKey: ['lockbox-lock-attempts'] });
      qc.invalidateQueries({ queryKey: ['lockbox-attempt'] });
    },
  });
}

// ── Day Scores ──
export function useDayScores(dayId: string | undefined) {
  return useQuery({
    queryKey: ['lockbox-scores', dayId],
    enabled: !!dayId,
    queryFn: async () => {
      const { data } = await supabase
        .from('lockbox_scores')
        .select('*, profiles:user_id(display_name, avatar_url)')
        .eq('week_id', dayId!).order('total_points', { ascending: false });
      return data || [];
    },
  });
}

export const useWeekScores = useDayScores;

// ── Past Days (excludes current day) ──
export function usePastDays() {
  return useQuery({
    queryKey: ['lockbox-past-days'],
    queryFn: async () => {
      const bounds = getDayBounds();
      const { data } = await supabase
        .from('lockbox_weeks')
        .select('*')
        .order('year', { ascending: false })
        .order('week_number', { ascending: false })
        .limit(30);
      return (data || []).filter(
        (w: any) => !(w.week_number === bounds.week_number && w.year === bounds.year)
      );
    },
    staleTime: 1000 * 60 * 5,
  });
}

export const usePastWeeks = usePastDays;

// ── Player Lifetime Stats (computed from attempts + scores) ──
export function usePlayerStats(userId: string | undefined) {
  return useQuery({
    queryKey: ['lockbox-player-stats', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: scores } = await supabase
        .from('lockbox_scores').select('*')
        .eq('user_id', userId!);

      const { data: solvedAttempts } = await supabase
        .from('lockbox_attempts').select('*')
        .eq('attacker_id', userId!).eq('is_solved', true);

      const { data: locks } = await supabase
        .from('lockbox_locks').select('*')
        .eq('user_id', userId!);

      const totalPoints = (scores || []).reduce((s: number, r: any) => s + (r.total_points || 0), 0);
      const crackPoints = (scores || []).reduce((s: number, r: any) => s + (r.crack_points || 0), 0);
      const defensePoints = (scores || []).reduce((s: number, r: any) => s + (r.defense_points || 0), 0);
      const dailyWins = (scores || []).filter((s: any) => s.rank === 1).length;
      const topThree = (scores || []).filter((s: any) => s.rank && s.rank <= 3).length;
      const locksCracked = (solvedAttempts || []).length;
      const locksDefended = (locks || []).filter((l: any) => !l.is_cracked).length;
      const totalLocks = (locks || []).length;

      const attemptCounts = (solvedAttempts || []).map((a: any) => a.total_attempts);
      const avgAttempts = attemptCounts.length > 0
        ? Math.round((attemptCounts.reduce((a: number, b: number) => a + b, 0) / attemptCounts.length) * 10) / 10
        : 0;
      const bestCrack = attemptCounts.length > 0 ? Math.min(...attemptCounts) : 0;

      const placements = (scores || [])
        .sort((a: any, b: any) => (a.week_id < b.week_id ? 1 : -1))
        .slice(0, 10);

      return {
        totalPoints, crackPoints, defensePoints,
        dailyWins, topThree,
        locksCracked, locksDefended, totalLocks,
        avgAttempts, bestCrack,
        daysPlayed: (scores || []).length,
        placements,
      };
    },
    staleTime: 1000 * 60 * 3,
  });
}

// ── Computed Leaderboard (from locks + attempts when scores aren't written yet) ──
export function useComputedLeaderboard(dayId: string | undefined) {
  const allLocks = useAllDayLocks(dayId);
  const allAttempts = useAllDayAttempts(dayId);
  const scores = useDayScores(dayId);

  const leaderboard = (() => {
    if (scores.data && scores.data.length > 0) return null;
    
    const locks = allLocks.data || [];
    const attempts = allAttempts.data || [];
    if (locks.length === 0) return [];

    const players = new Map<string, {
      userId: string; name: string; avatar: string | null;
      crackPts: number; defensePts: number; locksCracked: number;
      totalAttempts: number; solves: number;
    }>();

    const ensurePlayer = (id: string, name: string, avatar: string | null) => {
      if (!players.has(id)) {
        players.set(id, { userId: id, name, avatar, crackPts: 0, defensePts: 0, locksCracked: 0, totalAttempts: 0, solves: 0 });
      }
      return players.get(id)!;
    };

    for (const lock of locks) {
      ensurePlayer(lock.user_id, lock.profiles?.display_name || 'Player', lock.profiles?.avatar_url);
      const lockSolves = attempts.filter((a: any) => a.lock_id === lock.id && a.is_solved);
      const bestCrackAttempts = lockSolves.length > 0
        ? Math.min(...lockSolves.map((a: any) => a.total_attempts))
        : null;
      const defPts = getDefensePoints(lock.is_cracked, bestCrackAttempts);
      players.get(lock.user_id)!.defensePts += defPts;
    }

    for (const lock of locks) {
      const lockSolves = attempts.filter((a: any) => a.lock_id === lock.id && a.is_solved);
      
      for (const a of lockSolves) {
        const p = ensurePlayer(a.attacker_id, a.profiles?.display_name || 'Player', a.profiles?.avatar_url);
        p.crackPts += BASE_CRACK_POINTS + getEfficiencyBonus(a.total_attempts);
        p.locksCracked++;
        p.totalAttempts += a.total_attempts;
        p.solves++;
      }
      
      if (lockSolves.length > 0) {
        const sorted = sortCracksForBest(lockSolves);
        if (sorted.length > 0) {
          const p = players.get(sorted[0].attacker_id);
          if (p) p.crackPts += BEST_CRACK_BONUS;
        }
      }
    }

    return Array.from(players.values())
      .map(p => ({ ...p, totalPts: p.crackPts + p.defensePts, avgAttempts: p.solves > 0 ? Math.round(p.totalAttempts / p.solves * 10) / 10 : 0 }))
      .sort((a, b) => {
        if (b.totalPts !== a.totalPts) return b.totalPts - a.totalPts;
        if (b.locksCracked !== a.locksCracked) return b.locksCracked - a.locksCracked;
        return a.avgAttempts - b.avgAttempts;
      });
  })();

  return {
    data: leaderboard,
    formalScores: scores.data,
    locks: allLocks.data,
    attempts: allAttempts.data,
    isLoading: allLocks.isLoading || allAttempts.isLoading,
  };
}
