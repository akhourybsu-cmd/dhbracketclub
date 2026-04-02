-- Let the picker delete their own draft picks
CREATE POLICY "Users can delete own draft picks"
ON public.draft_picks FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Let creator or picker update pick numbers (for renumbering)
CREATE POLICY "Creator or picker can update draft picks"
ON public.draft_picks FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM drafts WHERE drafts.id = draft_picks.draft_id AND drafts.created_by = auth.uid())
);

-- Let creator or picker delete enrichments for draft picks
CREATE POLICY "Creator or picker can delete draft pick enrichments"
ON public.item_enrichments FOR DELETE TO authenticated
USING (
  item_type = 'draft_pick' AND (
    EXISTS (
      SELECT 1 FROM draft_picks dp
      JOIN drafts d ON d.id = dp.draft_id
      WHERE dp.id = item_enrichments.item_id
      AND (dp.user_id = auth.uid() OR d.created_by = auth.uid())
    )
  )
);