
-- Tighten insert policy: only allow insert for items the user created
DROP POLICY "Authenticated can insert enrichments" ON public.item_enrichments;
CREATE POLICY "Authenticated can insert enrichments"
  ON public.item_enrichments FOR INSERT
  TO authenticated
  WITH CHECK (
    item_type = 'ranking_item' AND EXISTS (
      SELECT 1 FROM ranking_items ri
      JOIN rankings r ON r.id = ri.ranking_id
      WHERE ri.id = item_enrichments.item_id AND r.created_by = auth.uid()
    )
  );

-- Tighten update policy: only ranking creator can update enrichments
DROP POLICY "Authenticated can update enrichments" ON public.item_enrichments;
CREATE POLICY "Creator can update enrichments"
  ON public.item_enrichments FOR UPDATE
  TO authenticated
  USING (
    item_type = 'ranking_item' AND EXISTS (
      SELECT 1 FROM ranking_items ri
      JOIN rankings r ON r.id = ri.ranking_id
      WHERE ri.id = item_enrichments.item_id AND r.created_by = auth.uid()
    )
  );
