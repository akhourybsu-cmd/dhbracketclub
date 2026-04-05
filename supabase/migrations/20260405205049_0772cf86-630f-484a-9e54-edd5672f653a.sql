CREATE POLICY "Authenticated can delete entries"
ON public.draft_season_entries
FOR DELETE
TO authenticated
USING (true);