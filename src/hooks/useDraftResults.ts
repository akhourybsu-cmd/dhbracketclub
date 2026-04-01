import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PickRating {
  pick_id: string;
  pick_text: string;
  score: number;
  explanation: string;
}

export interface DraftResult {
  id: string;
  draft_id: string;
  user_id: string;
  rank: number;
  total_score: number;
  pick_ratings: PickRating[];
  summary: string | null;
  points_awarded: number;
  created_at: string;
}

export function useDraftResults(draftId: string | undefined) {
  const [results, setResults] = useState<DraftResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [hasResults, setHasResults] = useState(false);

  const fetchResults = useCallback(async () => {
    if (!draftId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('draft_results' as any)
        .select('*')
        .eq('draft_id', draftId)
        .order('rank');

      if (error) throw error;
      const typed = (data || []) as unknown as DraftResult[];
      setResults(typed);
      setHasResults(typed.length > 0);
    } catch (err) {
      console.error('Failed to fetch draft results:', err);
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const generateResults = useCallback(async () => {
    if (!draftId) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('rate-draft', {
        body: { draft_id: draftId },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success('AI Report generated! 🏆');
      await fetchResults();
    } catch (err: any) {
      const msg = err?.message || 'Failed to generate report';
      toast.error(msg);
      console.error('Generate results error:', err);
    } finally {
      setGenerating(false);
    }
  }, [draftId, fetchResults]);

  return { results, loading, generating, hasResults, generateResults, fetchResults };
}
