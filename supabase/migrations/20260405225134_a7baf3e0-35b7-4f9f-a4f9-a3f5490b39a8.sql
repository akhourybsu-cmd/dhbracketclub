CREATE POLICY "Authenticated can delete standings"
ON public.draft_season_standings
FOR DELETE
TO authenticated
USING (true);