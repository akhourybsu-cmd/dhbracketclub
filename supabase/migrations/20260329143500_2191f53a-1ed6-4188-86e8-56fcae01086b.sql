-- Add category column to drafts table for content classification
ALTER TABLE public.drafts ADD COLUMN IF NOT EXISTS category text;

-- Expand item_enrichments RLS to also support draft_pick items
-- Drop and recreate INSERT policy to support both ranking_item and draft_pick
DROP POLICY IF EXISTS "Authenticated can insert enrichments" ON public.item_enrichments;
CREATE POLICY "Authenticated can insert enrichments"
ON public.item_enrichments
FOR INSERT
TO authenticated
WITH CHECK (
  (item_type = 'ranking_item' AND EXISTS (
    SELECT 1 FROM ranking_items ri JOIN rankings r ON r.id = ri.ranking_id
    WHERE ri.id = item_enrichments.item_id AND r.created_by = auth.uid()
  ))
  OR
  (item_type = 'draft_pick' AND EXISTS (
    SELECT 1 FROM draft_picks dp JOIN drafts d ON d.id = dp.draft_id
    WHERE dp.id = item_enrichments.item_id AND (d.created_by = auth.uid() OR dp.user_id = auth.uid())
  ))
);

-- Drop and recreate UPDATE policy to support both types
DROP POLICY IF EXISTS "Creator can update enrichments" ON public.item_enrichments;
CREATE POLICY "Creator can update enrichments"
ON public.item_enrichments
FOR UPDATE
TO authenticated
USING (
  (item_type = 'ranking_item' AND EXISTS (
    SELECT 1 FROM ranking_items ri JOIN rankings r ON r.id = ri.ranking_id
    WHERE ri.id = item_enrichments.item_id AND r.created_by = auth.uid()
  ))
  OR
  (item_type = 'draft_pick' AND EXISTS (
    SELECT 1 FROM draft_picks dp JOIN drafts d ON d.id = dp.draft_id
    WHERE dp.id = item_enrichments.item_id AND (d.created_by = auth.uid() OR dp.user_id = auth.uid())
  ))
);