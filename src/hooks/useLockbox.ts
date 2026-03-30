import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

function getWeekBounds() {
  const now = new Date();
  const day = now.getUTCDay();
  const start = new Date(now);
  start.setUTCDate(now.getUTCDate() - day);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);

  // ISO week number
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  return { starts_at: start.toISOString(), ends_at: end.toISOString(), week_number: weekNumber, year: now.getFullYear() };
}

export function useCurrentWeek() {
  return useQuery({
    queryKey: ['lockbox-week'],
    queryFn: async () => {
      const bounds = getWeekBounds();
      // Try to find existing week
      const { data } = await supabase
        .from('lockbox_weeks')
        .select('*')
        .eq('week_number', bounds.week_number)
        .eq('year', bounds.year)
        .maybeSingle();
      if (data) return data;
      // Create it
      const { data: created, error } = await supabase
        .from('lockbox_weeks')
        .insert(bounds)
        .select()
        .single();
      if (error) {
        // Race condition - another user created it
        const { data: retry } = await supabase
          .from('lockbox_weeks')
          .select('*')
          .eq('week_number', bounds.week_number)
          .eq('year', bounds.year)
          .single();
        return retry;
      }
      return created;
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useMyLock(weekId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['lockbox-my-lock', weekId],
    enabled: !!weekId && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('lockbox_locks')
        .select('*')
        .eq('week_id', weekId!)
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
  });
}

export function useCreateLock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { week_id: string; user_id: string; number_code: string; color_code: string; maze_id: number }) => {
      const { data, error } = await supabase
        .from('lockbox_locks')
        .insert(params)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['lockbox-my-lock', vars.week_id] });
      qc.invalidateQueries({ queryKey: ['lockbox-locks'] });
    },
  });
}

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

      // Get my attempts for these locks
      const lockIds = (locks || []).map((l: any) => l.id);
      let attempts: any[] = [];
      if (lockIds.length > 0) {
        const { data } = await supabase
          .from('lockbox_attempts')
          .select('*')
          .in('lock_id', lockIds)
          .eq('attacker_id', user!.id);
        attempts = data || [];
      }

      return (locks || []).map((lock: any) => ({
        ...lock,
        myAttempt: attempts.find((a: any) => a.lock_id === lock.id) || null,
      }));
    },
  });
}

export function useAttemptGuesses(attemptId: string | undefined) {
  return useQuery({
    queryKey: ['lockbox-guesses', attemptId],
    enabled: !!attemptId,
    queryFn: async () => {
      const { data } = await supabase
        .from('lockbox_guesses')
        .select('*')
        .eq('attempt_id', attemptId!)
        .order('created_at', { ascending: true });
      return data || [];
    },
  });
}

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
      // Get or create attempt
      let { data: attempt } = await supabase
        .from('lockbox_attempts')
        .select('*')
        .eq('lock_id', params.lockId)
        .eq('attacker_id', params.attackerId)
        .maybeSingle();

      if (!attempt) {
        const { data: newAttempt, error } = await supabase
          .from('lockbox_attempts')
          .insert({ lock_id: params.lockId, attacker_id: params.attackerId, phase: 'number', total_attempts: 0 })
          .select()
          .single();
        if (error) throw error;
        attempt = newAttempt;
      }

      // Calculate feedback
      const guessArr = params.guessValue.split(',');
      const codeArr = params.lockCode.split(',');
      let correctPosition = 0;
      let correctValue = 0;
      const usedGuess = new Array(3).fill(false);
      const usedCode = new Array(3).fill(false);

      // First pass: exact matches
      for (let i = 0; i < 3; i++) {
        if (guessArr[i] === codeArr[i]) {
          correctPosition++;
          usedGuess[i] = true;
          usedCode[i] = true;
        }
      }
      // Second pass: wrong position
      for (let i = 0; i < 3; i++) {
        if (usedGuess[i]) continue;
        for (let j = 0; j < 3; j++) {
          if (usedCode[j]) continue;
          if (guessArr[i] === codeArr[j]) {
            correctValue++;
            usedCode[j] = true;
            break;
          }
        }
      }

      const isCorrect = correctPosition === 3;

      // Insert guess
      await supabase.from('lockbox_guesses').insert({
        attempt_id: attempt.id,
        phase: params.phase,
        guess_value: params.guessValue,
        correct_position: correctPosition,
        correct_value: correctValue,
        is_correct: isCorrect,
      });

      // Update attempt
      const newTotal = (attempt.total_attempts || 0) + 1;
      const updates: any = { total_attempts: newTotal, updated_at: new Date().toISOString() };
      
      if (isCorrect) {
        if (params.phase === 'number') updates.phase = 'color';
        else if (params.phase === 'color') updates.phase = 'maze';
        else if (params.phase === 'maze') {
          updates.is_solved = true;
          updates.solved_at = new Date().toISOString();
          // Mark lock as cracked
          await supabase.from('lockbox_locks').update({ is_cracked: true }).eq('id', params.lockId);
        }
      }

      await supabase.from('lockbox_attempts').update(updates).eq('id', attempt.id);

      return { correctPosition, correctValue, isCorrect, phase: params.phase, newPhase: updates.phase };
    },
    onSuccess: (_, params) => {
      qc.invalidateQueries({ queryKey: ['lockbox-locks'] });
      qc.invalidateQueries({ queryKey: ['lockbox-guesses'] });
    },
  });
}

export function useWeekScores(weekId: string | undefined) {
  return useQuery({
    queryKey: ['lockbox-scores', weekId],
    enabled: !!weekId,
    queryFn: async () => {
      const { data } = await supabase
        .from('lockbox_scores')
        .select('*, profiles:user_id(display_name, avatar_url)')
        .eq('week_id', weekId!)
        .order('total_points', { ascending: false });
      return data || [];
    },
  });
}
