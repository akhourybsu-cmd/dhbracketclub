CREATE POLICY "Users update own relics"
ON public.rune_delve_relic_unlocks
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);