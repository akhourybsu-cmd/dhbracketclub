import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useAISuggestions() {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSuggestions = async (
    title: string,
    type: 'poll' | 'ranking',
    existingItems: string[]
  ) => {
    if (!title.trim()) {
      toast.error('Enter a title first');
      return;
    }
    setLoading(true);
    setSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-items', {
        body: { title: title.trim(), type, existingItems: existingItems.filter(Boolean) },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setSuggestions(data.suggestions || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to get suggestions');
    } finally {
      setLoading(false);
    }
  };

  const removeSuggestion = (text: string) => {
    setSuggestions(prev => prev.filter(s => s !== text));
  };

  return { suggestions, loading, fetchSuggestions, removeSuggestion };
}
