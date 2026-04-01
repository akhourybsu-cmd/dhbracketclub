import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PickSuggestion {
  corrected_text: string | null;
  is_irrelevant: boolean;
  is_duplicate: boolean;
  relevance_note: string | null;
}

export function usePickSuggestion(topic: string, category: string | null, existingPicks: string[]) {
  const [suggestion, setSuggestion] = useState<PickSuggestion | null>(null);
  const [checking, setChecking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const checkPick = useCallback(async (text: string) => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    setSuggestion(null);

    const trimmed = text.trim();
    if (trimmed.length < 3) {
      setChecking(false);
      return;
    }

    setChecking(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data, error } = await supabase.functions.invoke('check-draft-pick', {
        body: {
          pick_text: trimmed,
          topic,
          category,
          existing_picks: existingPicks,
        },
      });

      if (controller.signal.aborted) return;
      if (error) throw error;

      const correctedText = data?.corrected_text && data.corrected_text !== "null" ? data.corrected_text : null;
      if (data && (correctedText || data.is_irrelevant || data.is_duplicate)) {
        setSuggestion({ ...data, corrected_text: correctedText });
      } else {
        setSuggestion(null);
      }
    } catch {
      // Silently fail — don't block the user
    } finally {
      if (!controller.signal.aborted) {
        setChecking(false);
      }
    }
  }, [topic, category, existingPicks]);

  const debouncedCheck = useCallback((text: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => checkPick(text), 600);
  }, [checkPick]);

  const clearSuggestion = useCallback(() => {
    setSuggestion(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();
  }, []);

  return { suggestion, checking, debouncedCheck, clearSuggestion };
}
