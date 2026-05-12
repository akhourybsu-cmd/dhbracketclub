
-- Phase 2 (focused): tighten profiles read + explicit deny on user_roles writes

-- 1) profiles: require auth to read
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- 2) user_roles: explicit deny on writes (defense in depth)
CREATE POLICY "Deny direct insert on user_roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "Deny direct update on user_roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny direct delete on user_roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (false);
