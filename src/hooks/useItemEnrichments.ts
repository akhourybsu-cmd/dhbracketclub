import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ItemEnrichment {
  id: string;
  item_id: string;
  item_type: string;
  category: string | null;
  normalized_name: string | null;
  matched_name: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
  source_provider: string | null;
  confidence: number;
  metadata: Record<string, any>;
  status: 'pending' | 'matched' | 'low_confidence' | 'placeholder' | 'manual';
}

export function useItemEnrichments(itemIds: string[], itemType = 'ranking_item') {
  const [enrichments, setEnrichments] = useState<Map<string, ItemEnrichment>>(new Map());
  const [loading, setLoading] = useState(false);

  const fetchEnrichments = useCallback(async () => {
    if (!itemIds.length) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('item_enrichments')
        .select('*')
        .in('item_id', itemIds)
        .eq('item_type', itemType);

      if (error) throw error;
      const map = new Map<string, ItemEnrichment>();
      (data || []).forEach((e: any) => {
        map.set(e.item_id, {
          ...e,
          confidence: parseFloat(e.confidence) || 0,
          metadata: e.metadata || {},
        });
      });
      setEnrichments(map);
    } catch (err: any) {
      console.error('Failed to fetch enrichments:', err);
    } finally {
      setLoading(false);
    }
  }, [itemIds.join(','), itemType]);

  return { enrichments, loading, fetchEnrichments };
}

export function useEnrichRanking() {
  const [enriching, setEnriching] = useState(false);

  const enrichRanking = useCallback(async (rankingId: string) => {
    setEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-ranking', {
        body: { ranking_id: rankingId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    } catch (err: any) {
      console.error('Enrichment failed:', err);
      toast.error('Failed to enrich items');
      return null;
    } finally {
      setEnriching(false);
    }
  }, []);

  return { enriching, enrichRanking };
}
