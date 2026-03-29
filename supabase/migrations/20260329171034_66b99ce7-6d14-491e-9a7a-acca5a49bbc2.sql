DROP POLICY "Authenticated users can claim codes" ON public.invite_codes;

CREATE POLICY "Users can only claim their own code"
  ON public.invite_codes FOR UPDATE
  TO authenticated
  USING (used_by IS NULL OR used_by = auth.uid())
  WITH CHECK (used_by = auth.uid());