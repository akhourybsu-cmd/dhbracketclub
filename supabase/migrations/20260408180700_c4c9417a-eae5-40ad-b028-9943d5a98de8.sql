-- Drop and recreate the UPDATE policy to include admin access
DROP POLICY IF EXISTS "Creator can update enrichments" ON public.item_enrichments;
CREATE POLICY "Creator admin can update enrichments"
ON public.item_enrichments
FOR UPDATE
TO authenticated
USING (
  is_app_admin(auth.uid())
  OR (
    (item_type = 'ranking_item' AND EXISTS (
      SELECT 1 FROM ranking_items ri JOIN rankings r ON r.id = ri.ranking_id
      WHERE ri.id = item_enrichments.item_id AND r.created_by = auth.uid()
    ))
    OR (item_type = 'draft_pick' AND EXISTS (
      SELECT 1 FROM draft_picks dp JOIN drafts d ON d.id = dp.draft_id
      WHERE dp.id = item_enrichments.item_id AND (d.created_by = auth.uid() OR dp.user_id = auth.uid())
    ))
  )
);

-- Drop and recreate the DELETE policy to include admin access
DROP POLICY IF EXISTS "Creator or picker can delete draft pick enrichments" ON public.item_enrichments;
CREATE POLICY "Creator admin can delete enrichments"
ON public.item_enrichments
FOR DELETE
TO authenticated
USING (
  is_app_admin(auth.uid())
  OR (
    (item_type = 'ranking_item' AND EXISTS (
      SELECT 1 FROM ranking_items ri JOIN rankings r ON r.id = ri.ranking_id
      WHERE ri.id = item_enrichments.item_id AND r.created_by = auth.uid()
    ))
    OR (item_type = 'draft_pick' AND EXISTS (
      SELECT 1 FROM draft_picks dp JOIN drafts d ON d.id = dp.draft_id
      WHERE dp.id = item_enrichments.item_id AND (d.created_by = auth.uid() OR dp.user_id = auth.uid())
    ))
  )
);

-- Also update INSERT policy to allow admin
DROP POLICY IF EXISTS "Authenticated can insert enrichments" ON public.item_enrichments;
CREATE POLICY "Authenticated or admin can insert enrichments"
ON public.item_enrichments
FOR INSERT
TO authenticated
WITH CHECK (
  is_app_admin(auth.uid())
  OR (
    (item_type = 'ranking_item' AND EXISTS (
      SELECT 1 FROM ranking_items ri JOIN rankings r ON r.id = ri.ranking_id
      WHERE ri.id = item_enrichments.item_id AND r.created_by = auth.uid()
    ))
    OR (item_type = 'draft_pick' AND EXISTS (
      SELECT 1 FROM draft_picks dp JOIN drafts d ON d.id = dp.draft_id
      WHERE dp.id = item_enrichments.item_id AND (d.created_by = auth.uid() OR dp.user_id = auth.uid())
    ))
  )
);