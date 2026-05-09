
-- ============================================================
-- Phase A: Club-scope Portfolio Wars
-- ============================================================

-- 1. Add nullable club_id columns
ALTER TABLE public.pw_challenges      ADD COLUMN IF NOT EXISTS club_id uuid;
ALTER TABLE public.pw_entries         ADD COLUMN IF NOT EXISTS club_id uuid;
ALTER TABLE public.pw_picks           ADD COLUMN IF NOT EXISTS club_id uuid;
ALTER TABLE public.pw_price_snapshots ADD COLUMN IF NOT EXISTS club_id uuid;
ALTER TABLE public.pw_accolades       ADD COLUMN IF NOT EXISTS club_id uuid;

-- 2. Backfill to Dry Horse (oldest club)
DO $$
DECLARE dh uuid;
BEGIN
  SELECT id INTO dh FROM public.clubs ORDER BY created_at ASC LIMIT 1;
  UPDATE public.pw_challenges      SET club_id = dh WHERE club_id IS NULL;
  UPDATE public.pw_entries         SET club_id = dh WHERE club_id IS NULL;
  UPDATE public.pw_picks           SET club_id = dh WHERE club_id IS NULL;
  UPDATE public.pw_price_snapshots SET club_id = dh WHERE club_id IS NULL;
  UPDATE public.pw_accolades       SET club_id = dh WHERE club_id IS NULL;
END $$;

-- 3. Enforce NOT NULL + FK
ALTER TABLE public.pw_challenges      ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE public.pw_entries         ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE public.pw_picks           ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE public.pw_price_snapshots ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE public.pw_accolades       ALTER COLUMN club_id SET NOT NULL;

ALTER TABLE public.pw_challenges
  ADD CONSTRAINT pw_challenges_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;
ALTER TABLE public.pw_entries
  ADD CONSTRAINT pw_entries_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;
ALTER TABLE public.pw_picks
  ADD CONSTRAINT pw_picks_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;
ALTER TABLE public.pw_price_snapshots
  ADD CONSTRAINT pw_price_snapshots_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;
ALTER TABLE public.pw_accolades
  ADD CONSTRAINT pw_accolades_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_pw_challenges_club ON public.pw_challenges(club_id);
CREATE INDEX IF NOT EXISTS idx_pw_entries_club    ON public.pw_entries(club_id);
CREATE INDEX IF NOT EXISTS idx_pw_picks_club      ON public.pw_picks(club_id);
CREATE INDEX IF NOT EXISTS idx_pw_snapshots_club  ON public.pw_price_snapshots(club_id);
CREATE INDEX IF NOT EXISTS idx_pw_accolades_club  ON public.pw_accolades(club_id);

-- 4. Replace global (year, week_number) uniqueness with per-club
ALTER TABLE public.pw_challenges DROP CONSTRAINT IF EXISTS pw_challenges_year_week_number_key;
ALTER TABLE public.pw_challenges
  ADD CONSTRAINT pw_challenges_club_year_week_key UNIQUE (club_id, year, week_number);

-- 5. Auto-stamp club_id triggers ----------------------------------

-- Challenges: from current user's club (admin can override by passing club_id)
CREATE OR REPLACE FUNCTION public.pw_set_challenge_club()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.club_id IS NULL THEN
    NEW.club_id := public.current_user_club_id();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pw_challenges_club ON public.pw_challenges;
CREATE TRIGGER trg_pw_challenges_club
  BEFORE INSERT ON public.pw_challenges
  FOR EACH ROW EXECUTE FUNCTION public.pw_set_challenge_club();

-- Entries: derive from parent challenge
CREATE OR REPLACE FUNCTION public.pw_set_entry_club()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.club_id IS NULL THEN
    SELECT club_id INTO NEW.club_id FROM public.pw_challenges WHERE id = NEW.challenge_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pw_entries_club ON public.pw_entries;
CREATE TRIGGER trg_pw_entries_club
  BEFORE INSERT ON public.pw_entries
  FOR EACH ROW EXECUTE FUNCTION public.pw_set_entry_club();

-- Picks: derive from parent entry
CREATE OR REPLACE FUNCTION public.pw_set_pick_club()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.club_id IS NULL THEN
    SELECT club_id INTO NEW.club_id FROM public.pw_entries WHERE id = NEW.entry_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pw_picks_club ON public.pw_picks;
CREATE TRIGGER trg_pw_picks_club
  BEFORE INSERT ON public.pw_picks
  FOR EACH ROW EXECUTE FUNCTION public.pw_set_pick_club();

-- Snapshots: derive from challenge
CREATE OR REPLACE FUNCTION public.pw_set_snapshot_club()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.club_id IS NULL THEN
    SELECT club_id INTO NEW.club_id FROM public.pw_challenges WHERE id = NEW.challenge_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pw_snapshots_club ON public.pw_price_snapshots;
CREATE TRIGGER trg_pw_snapshots_club
  BEFORE INSERT ON public.pw_price_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.pw_set_snapshot_club();

-- Accolades: derive from challenge
CREATE OR REPLACE FUNCTION public.pw_set_accolade_club()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.club_id IS NULL THEN
    SELECT club_id INTO NEW.club_id FROM public.pw_challenges WHERE id = NEW.challenge_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pw_accolades_club ON public.pw_accolades;
CREATE TRIGGER trg_pw_accolades_club
  BEFORE INSERT ON public.pw_accolades
  FOR EACH ROW EXECUTE FUNCTION public.pw_set_accolade_club();

-- 6. Rewrite RLS policies (drop all old, create club-scoped)

-- pw_challenges
DROP POLICY IF EXISTS pw_challenges_admin_write ON public.pw_challenges;
DROP POLICY IF EXISTS pw_challenges_read_all   ON public.pw_challenges;

CREATE POLICY pw_challenges_read_in_club ON public.pw_challenges
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.club_members
               WHERE user_id = auth.uid() AND club_id = pw_challenges.club_id)
  );

CREATE POLICY pw_challenges_admin_write ON public.pw_challenges
  FOR ALL TO authenticated
  USING (public.is_app_admin(auth.uid()) OR public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_app_admin(auth.uid()) OR public.is_platform_owner(auth.uid()));

-- pw_entries
DROP POLICY IF EXISTS pw_entries_admin_all                  ON public.pw_entries;
DROP POLICY IF EXISTS pw_entries_delete_own_when_upcoming   ON public.pw_entries;
DROP POLICY IF EXISTS pw_entries_insert_own_when_upcoming   ON public.pw_entries;
DROP POLICY IF EXISTS pw_entries_read_all                   ON public.pw_entries;
DROP POLICY IF EXISTS pw_entries_update_own_when_upcoming   ON public.pw_entries;

CREATE POLICY pw_entries_read_in_club ON public.pw_entries
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.club_members
               WHERE user_id = auth.uid() AND club_id = pw_entries.club_id)
  );

CREATE POLICY pw_entries_insert_own_when_upcoming ON public.pw_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.club_members
                WHERE user_id = auth.uid() AND club_id = pw_entries.club_id)
    AND EXISTS (SELECT 1 FROM public.pw_challenges c
                WHERE c.id = pw_entries.challenge_id
                  AND c.status = 'upcoming'::pw_challenge_status
                  AND c.lock_at > now())
  );

CREATE POLICY pw_entries_update_own_when_upcoming ON public.pw_entries
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.pw_challenges c
                WHERE c.id = pw_entries.challenge_id
                  AND c.status = 'upcoming'::pw_challenge_status
                  AND c.lock_at > now())
  );

CREATE POLICY pw_entries_delete_own_when_upcoming ON public.pw_entries
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.pw_challenges c
                WHERE c.id = pw_entries.challenge_id
                  AND c.status = 'upcoming'::pw_challenge_status
                  AND c.lock_at > now())
  );

CREATE POLICY pw_entries_admin_all ON public.pw_entries
  FOR ALL TO authenticated
  USING (public.is_app_admin(auth.uid()) OR public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_app_admin(auth.uid()) OR public.is_platform_owner(auth.uid()));

-- pw_picks
DROP POLICY IF EXISTS pw_picks_admin_all                  ON public.pw_picks;
DROP POLICY IF EXISTS pw_picks_modify_own_when_upcoming   ON public.pw_picks;
DROP POLICY IF EXISTS pw_picks_read_all                   ON public.pw_picks;

CREATE POLICY pw_picks_read_in_club ON public.pw_picks
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.club_members
               WHERE user_id = auth.uid() AND club_id = pw_picks.club_id)
  );

CREATE POLICY pw_picks_modify_own_when_upcoming ON public.pw_picks
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pw_entries e
    JOIN public.pw_challenges c ON c.id = e.challenge_id
    WHERE e.id = pw_picks.entry_id
      AND e.user_id = auth.uid()
      AND c.status = 'upcoming'::pw_challenge_status
      AND c.lock_at > now()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.pw_entries e
    JOIN public.pw_challenges c ON c.id = e.challenge_id
    WHERE e.id = pw_picks.entry_id
      AND e.user_id = auth.uid()
      AND c.status = 'upcoming'::pw_challenge_status
      AND c.lock_at > now()
  ));

CREATE POLICY pw_picks_admin_all ON public.pw_picks
  FOR ALL TO authenticated
  USING (public.is_app_admin(auth.uid()) OR public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_app_admin(auth.uid()) OR public.is_platform_owner(auth.uid()));

-- pw_price_snapshots
DROP POLICY IF EXISTS pw_snapshots_admin_write ON public.pw_price_snapshots;
DROP POLICY IF EXISTS pw_snapshots_read_all    ON public.pw_price_snapshots;

CREATE POLICY pw_snapshots_read_in_club ON public.pw_price_snapshots
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.club_members
               WHERE user_id = auth.uid() AND club_id = pw_price_snapshots.club_id)
  );

CREATE POLICY pw_snapshots_admin_write ON public.pw_price_snapshots
  FOR ALL TO authenticated
  USING (public.is_app_admin(auth.uid()) OR public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_app_admin(auth.uid()) OR public.is_platform_owner(auth.uid()));

-- pw_accolades
DROP POLICY IF EXISTS pw_accolades_admin_write ON public.pw_accolades;
DROP POLICY IF EXISTS pw_accolades_read_all    ON public.pw_accolades;

CREATE POLICY pw_accolades_read_in_club ON public.pw_accolades
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.club_members
               WHERE user_id = auth.uid() AND club_id = pw_accolades.club_id)
  );

CREATE POLICY pw_accolades_admin_write ON public.pw_accolades
  FOR ALL TO authenticated
  USING (public.is_app_admin(auth.uid()) OR public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_app_admin(auth.uid()) OR public.is_platform_owner(auth.uid()));
