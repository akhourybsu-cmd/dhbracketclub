import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ── Week Bounds ──
function getWeekBounds() {
  const now = new Date();
  const day = now.getUTCDay();
  const start = new Date(now);
  start.setUTCDate(now.getUTCDate() - day);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);

  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  return { starts_at: start.toISOString(), ends_at: end.toISOString(), week_number: weekNumber, year: now.getFullYear() };
}

// ── Current Week ──
export function useCurrentWeek() {
  return useQuery({
    queryKey: ['lockbox-week'],
    queryFn: async () => {
      const bounds = getWeekBounds();
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

// ── My Lock ──
export function useMyLock(weekId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['lockbox-my-lock', weekId],
    enabled: !!weekId && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('lockbox_locks').select('*')
        .eq('week_id', weekId!).eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
  });
}

// ── Create Lock ──
export function useCreateLock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { week_id: string; user_id: string; number_code: string; color_code: string; maze_id: number }) => {
      const { data, error } = await supabase.from('lockbox_locks').insert(params).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['lockbox-my-lock', vars.week_id] });
      qc.invalidateQueries({ queryKey: ['lockbox-locks'] });
    },
  });
}

// ── Week Locks (others' locks with my attempts) ──
export function useWeekLocks(weekId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['lockbox-locks', weekId],
    enabled: !!weekId && !!user,
    queryFn: async () => {
      const { data: locks } = await supabase
        .from('lockbox_locks')
        .select('*, profiles:user_id(display_name, avatar_url)')
        .eq('week_id', weekId!)
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

// ── ALL locks for a week (for leaderboard/results) ──
export function useAllWeekLocks(weekId: string | undefined) {
  return useQuery({
    queryKey: ['lockbox-all-locks', weekId],
    enabled: !!weekId,
    queryFn: async () => {
      const { data } = await supabase
        .from('lockbox_locks')
        .select('*, profiles:user_id(display_name, avatar_url)')
        .eq('week_id', weekId!);
      return data || [];
    },
  });
}

// ── ALL attempts for a week (for computed leaderboard) ──
export function useAllWeekAttempts(weekId: string | undefined) {
  return useQuery({
    queryKey: ['lockbox-all-attempts', weekId],
    enabled: !!weekId,
    queryFn: async () => {
      // Get all locks for this week first, then all attempts on those locks
      const { data: locks } = await supabase
        .from('lockbox_locks').select('id').eq('week_id', weekId!);
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
      let { data: attempt } = await supabase
        .from('lockbox_attempts').select('*')
        .eq('lock_id', params.lockId).eq('attacker_id', params.attackerId)
        .maybeSingle();

      if (!attempt) {
        const { data: newAttempt, error } = await supabase
          .from('lockbox_attempts')
          .insert({ lock_id: params.lockId, attacker_id: params.attackerId, phase: 'number', total_attempts: 0 })
          .select().single();
        if (error) throw error;
        attempt = newAttempt;
      }

      const guessArr = params.guessValue.split(',');
      const codeArr = params.lockCode.split(',');
      let correctPosition = 0;
      let correctValue = 0;
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

      const isCorrect = correctPosition === 3;

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
        }
      }

      await supabase.from('lockbox_attempts').update(updates).eq('id', attempt.id);

      return { correctPosition, correctValue, isCorrect, phase: params.phase, newPhase: updates.phase };
    },
    onSuccess: (_, params) => {
      qc.invalidateQueries({ queryKey: ['lockbox-locks'] });
      qc.invalidateQueries({ queryKey: ['lockbox-guesses'] });
      qc.invalidateQueries({ queryKey: ['lockbox-all-attempts'] });
      qc.invalidateQueries({ queryKey: ['lockbox-lock-attempts'] });
    },
  });
}

// ── Week Scores ──
export function useWeekScores(weekId: string | undefined) {
  return useQuery({
    queryKey: ['lockbox-scores', weekId],
    enabled: !!weekId,
    queryFn: async () => {
      const { data } = await supabase
        .from('lockbox_scores')
        .select('*, profiles:user_id(display_name, avatar_url)')
        .eq('week_id', weekId!).order('total_points', { ascending: false });
      return data || [];
    },
  });
}

// ── Past Weeks ──
export function usePastWeeks() {
  return useQuery({
    queryKey: ['lockbox-past-weeks'],
    queryFn: async () => {
      const { data } = await supabase
        .from('lockbox_weeks')
        .select('*')
        .order('year', { ascending: false })
        .order('week_number', { ascending: false })
        .limit(20);
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ── Player Lifetime Stats (computed from attempts + scores) ──
export function usePlayerStats(userId: string | undefined) {
  return useQuery({
    queryKey: ['lockbox-player-stats', userId],
    enabled: !!userId,
    queryFn: async () => {
      // All scores
      const { data: scores } = await supabase
        .from('lockbox_scores').select('*')
        .eq('user_id', userId!);

      // All solved attempts by this user
      const { data: solvedAttempts } = await supabase
        .from('lockbox_attempts').select('*')
        .eq('attacker_id', userId!).eq('is_solved', true);

      // All locks by this user
      const { data: locks } = await supabase
        .from('lockbox_locks').select('*')
        .eq('user_id', userId!);

      const totalPoints = (scores || []).reduce((s: number, r: any) => s + (r.total_points || 0), 0);
      const crackPoints = (scores || []).reduce((s: number, r: any) => s + (r.crack_points || 0), 0);
      const defensePoints = (scores || []).reduce((s: number, r: any) => s + (r.defense_points || 0), 0);
      const weeklyWins = (scores || []).filter((s: any) => s.rank === 1).length;
      const topThree = (scores || []).filter((s: any) => s.rank && s.rank <= 3).length;
      const locksCracked = (solvedAttempts || []).length;
      const locksDefended = (locks || []).filter((l: any) => !l.is_cracked).length;
      const totalLocks = (locks || []).length;

      const attemptCounts = (solvedAttempts || []).map((a: any) => a.total_attempts);
      const avgAttempts = attemptCounts.length > 0
        ? Math.round((attemptCounts.reduce((a: number, b: number) => a + b, 0) / attemptCounts.length) * 10) / 10
        : 0;
      const bestCrack = attemptCounts.length > 0 ? Math.min(...attemptCounts) : 0;

      // Weekly placements
      const placements = (scores || [])
        .sort((a: any, b: any) => {
          const wa = a.week_id; const wb = b.week_id;
          return wa < wb ? 1 : -1;
        })
        .slice(0, 10);

      return {
        totalPoints, crackPoints, defensePoints,
        weeklyWins, topThree,
        locksCracked, locksDefended, totalLocks,
        avgAttempts, bestCrack,
        weeksPlayed: (scores || []).length,
        placements,
      };
    },
    staleTime: 1000 * 60 * 3,
  });
}

// ── Computed Leaderboard (from locks + attempts when scores aren't written yet) ──
export function useComputedLeaderboard(weekId: string | undefined) {
  const allLocks = useAllWeekLocks(weekId);
  const allAttempts = useAllWeekAttempts(weekId);
  const scores = useWeekScores(weekId);

  const leaderboard = (() => {
    // If we have formal scores, use them
    if (scores.data && scores.data.length > 0) return null;
    
    const locks = allLocks.data || [];
    const attempts = allAttempts.data || [];
    if (locks.length === 0) return [];

    // Build player map
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

    // Defense: lock owners
    for (const lock of locks) {
      ensurePlayer(lock.user_id, lock.profiles?.display_name || 'Player', lock.profiles?.avatar_url);
      if (!lock.is_cracked) {
        players.get(lock.user_id)!.defensePts += 5;
      }
    }

    // Crack scoring per lock
    for (const lock of locks) {
      const lockAttempts = attempts.filter((a: any) => a.lock_id === lock.id && a.is_solved);
      for (const a of lockAttempts) {
        const p = ensurePlayer(a.attacker_id, a.profiles?.display_name || 'Player', a.profiles?.avatar_url);
        p.crackPts += 5;
        p.locksCracked++;
        p.totalAttempts += a.total_attempts;
        p.solves++;
      }
      // Best crack bonus
      if (lockAttempts.length > 0) {
        const best = lockAttempts.sort((a: any, b: any) => a.total_attempts - b.total_attempts)[0];
        const p = players.get(best.attacker_id);
        if (p) p.crackPts += 2;
      }
    }

    return Array.from(players.values())
      .map(p => ({ ...p, totalPts: p.crackPts + p.defensePts, avgAttempts: p.solves > 0 ? Math.round(p.totalAttempts / p.solves * 10) / 10 : 0 }))
      .sort((a, b) => b.totalPts - a.totalPts);
  })();

  return {
    data: leaderboard,
    formalScores: scores.data,
    locks: allLocks.data,
    attempts: allAttempts.data,
    isLoading: allLocks.isLoading || allAttempts.isLoading,
  };
}
