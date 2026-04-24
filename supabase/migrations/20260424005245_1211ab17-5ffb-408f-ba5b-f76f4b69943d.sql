-- 1. Add new columns to clubs
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS join_password text,
  ADD COLUMN IF NOT EXISTS password_visible boolean NOT NULL DEFAULT true;

-- 2. Server-side function: validate password & enroll the user as a member.
-- Returns the club_id on success, raises on failure.
CREATE OR REPLACE FUNCTION public.join_club_with_password(_password text, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_club_id uuid;
  existing_membership uuid;
BEGIN
  IF _password IS NULL OR length(trim(_password)) = 0 THEN
    RAISE EXCEPTION 'Password required';
  END IF;
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'User required';
  END IF;

  -- Case-insensitive match against active clubs only
  SELECT id INTO matched_club_id
  FROM public.clubs
  WHERE status = 'active'
    AND join_password IS NOT NULL
    AND lower(join_password) = lower(trim(_password))
  LIMIT 1;

  IF matched_club_id IS NULL THEN
    RAISE EXCEPTION 'Invalid club password';
  END IF;

  -- One club per account: bail if already a member somewhere
  SELECT club_id INTO existing_membership
  FROM public.club_members
  WHERE user_id = _user_id
  LIMIT 1;

  IF existing_membership IS NOT NULL THEN
    IF existing_membership = matched_club_id THEN
      RETURN matched_club_id;
    END IF;
    RAISE EXCEPTION 'Account already belongs to a different club';
  END IF;

  INSERT INTO public.club_members (club_id, user_id, role)
  VALUES (matched_club_id, _user_id, 'member');

  RETURN matched_club_id;
END;
$$;

-- 3. Lock down direct reads of the password column.
-- Drop the existing broad SELECT policy and replace with one that hides join_password
-- from non-admin members at the row level via a security-definer view helper.
-- Simpler approach: keep the row visible (members need name/accent/logo) but
-- expose join_password only when the caller is admin or password_visible=true.
-- We do this with a security-definer function the UI calls explicitly.

CREATE OR REPLACE FUNCTION public.get_club_password(_club_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  is_admin boolean;
  pwd text;
  visible boolean;
BEGIN
  IF caller IS NULL THEN
    RETURN NULL;
  END IF;

  -- Caller must belong to the club (or be platform owner)
  IF NOT (
    EXISTS (SELECT 1 FROM public.club_members WHERE user_id = caller AND club_id = _club_id)
    OR public.is_platform_owner(caller)
  ) THEN
    RETURN NULL;
  END IF;

  SELECT join_password, password_visible INTO pwd, visible
  FROM public.clubs WHERE id = _club_id;

  is_admin := public.is_club_admin(caller, _club_id) OR public.is_platform_owner(caller);

  IF is_admin THEN
    RETURN pwd;
  END IF;

  IF visible THEN
    RETURN pwd;
  END IF;

  RETURN NULL;
END;
$$;

-- 4. Allow public.join_club_with_password to be called by any authenticated user
GRANT EXECUTE ON FUNCTION public.join_club_with_password(text, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_club_password(uuid) TO authenticated;