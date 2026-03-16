
-- 1. Tighten games UPDATE: only pool admins (via tournament → pools) can update
DROP POLICY IF EXISTS "Authenticated users can update games" ON public.games;

CREATE POLICY "Pool admins can update games"
ON public.games
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pools p
    WHERE p.tournament_id = games.tournament_id
    AND public.is_pool_admin(auth.uid(), p.id)
  )
);

-- 2. Allow pool admins to INSERT game_state_history (for manual overrides / simulation)
CREATE POLICY "Pool admins can insert game history"
ON public.game_state_history
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.games g
    JOIN public.pools p ON p.tournament_id = g.tournament_id
    WHERE g.id = game_state_history.game_id
    AND public.is_pool_admin(auth.uid(), p.id)
  )
);

-- 3. Allow pool admins to INSERT standings_snapshots (for manual recalc)
CREATE POLICY "Pool admins can insert snapshots"
ON public.standings_snapshots
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_pool_admin(auth.uid(), pool_id)
);

-- 4. Add unique constraint on game_external_mappings for idempotent upserts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'game_external_mappings_provider_external_id_key'
  ) THEN
    ALTER TABLE public.game_external_mappings
      ADD CONSTRAINT game_external_mappings_provider_external_id_key
      UNIQUE (provider_name, external_game_id);
  END IF;
END $$;

-- 5. Add unique constraint on standings for idempotent upserts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'standings_pool_user_unique'
  ) THEN
    ALTER TABLE public.standings
      ADD CONSTRAINT standings_pool_user_unique
      UNIQUE (pool_id, user_id);
  END IF;
END $$;
