CREATE POLICY "Users can update own runs"
  ON public.rune_delve_runs
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);