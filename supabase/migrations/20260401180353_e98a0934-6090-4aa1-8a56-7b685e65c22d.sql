
-- Allow updating lockbox_weeks (e.g. marking status = 'complete')
CREATE POLICY "Authenticated can update weeks"
ON public.lockbox_weeks
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow deleting lockbox_scores (for re-finalization)
CREATE POLICY "Authenticated can delete scores"
ON public.lockbox_scores
FOR DELETE
TO authenticated
USING (true);
