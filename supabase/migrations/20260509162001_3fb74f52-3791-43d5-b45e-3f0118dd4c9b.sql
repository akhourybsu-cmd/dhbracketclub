
-- 1. invite_codes: drop overly permissive SELECT policies
DROP POLICY IF EXISTS "Anyone can validate invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "InviteCodes: lookup by code" ON public.invite_codes;

-- 2. user_roles: scope SELECT to own rows (admins can still see all via is_app_admin())
DROP POLICY IF EXISTS "Roles viewable by authenticated" ON public.user_roles;
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin(auth.uid()) OR public.is_platform_owner(auth.uid()));

-- 3. push_subscriptions: add WITH CHECK to UPDATE
DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can update own subscriptions"
  ON public.push_subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. clubs.join_password: revoke direct column SELECT; reads must go through get_club_password()
REVOKE SELECT (join_password) ON public.clubs FROM anon, authenticated;
-- (UPDATE privilege retained so admins can still rotate the password via their existing flow,
--  gated by the admin_update_own_club RLS policy.)
