ALTER TABLE public.pools ADD COLUMN allow_late_entries boolean NOT NULL DEFAULT false;

-- Update RLS on brackets to allow late entries when pool has allow_late_entries = true
DROP POLICY IF EXISTS "Users can create own bracket" ON public.brackets;
CREATE POLICY "Users can create own bracket" ON public.brackets
  FOR INSERT TO public
  WITH CHECK (
    auth.uid() = user_id
    AND (
      (SELECT lock_time FROM pools WHERE id = pool_id) > now()
      OR (SELECT allow_late_entries FROM pools WHERE id = pool_id) = true
    )
  );

DROP POLICY IF EXISTS "Users can update own bracket before lock" ON public.brackets;
CREATE POLICY "Users can update own bracket before lock" ON public.brackets
  FOR UPDATE TO public
  USING (
    auth.uid() = user_id
    AND (
      (SELECT lock_time FROM pools WHERE id = pool_id) > now()
      OR (SELECT allow_late_entries FROM pools WHERE id = pool_id) = true
    )
  );

-- Update RLS on bracket_picks to allow late entries
DROP POLICY IF EXISTS "Users can insert own picks" ON public.bracket_picks;
CREATE POLICY "Users can insert own picks" ON public.bracket_picks
  FOR INSERT TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM brackets b JOIN pools p ON p.id = b.pool_id
      WHERE b.id = bracket_picks.bracket_id
        AND b.user_id = auth.uid()
        AND (p.lock_time > now() OR p.allow_late_entries = true)
    )
  );

DROP POLICY IF EXISTS "Users can update own picks" ON public.bracket_picks;
CREATE POLICY "Users can update own picks" ON public.bracket_picks
  FOR UPDATE TO public
  USING (
    EXISTS (
      SELECT 1 FROM brackets b JOIN pools p ON p.id = b.pool_id
      WHERE b.id = bracket_picks.bracket_id
        AND b.user_id = auth.uid()
        AND (p.lock_time > now() OR p.allow_late_entries = true)
    )
  );

DROP POLICY IF EXISTS "Users can delete own picks" ON public.bracket_picks;
CREATE POLICY "Users can delete own picks" ON public.bracket_picks
  FOR DELETE TO public
  USING (
    EXISTS (
      SELECT 1 FROM brackets b JOIN pools p ON p.id = b.pool_id
      WHERE b.id = bracket_picks.bracket_id
        AND b.user_id = auth.uid()
        AND (p.lock_time > now() OR p.allow_late_entries = true)
    )
  );
