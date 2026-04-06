
-- Create app_role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Only admins can view roles
CREATE POLICY "Roles viewable by authenticated"
ON public.user_roles FOR SELECT TO authenticated
USING (true);

-- Security definer function to check admin status
CREATE OR REPLACE FUNCTION public.is_app_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- Grant Alex K. admin role
INSERT INTO public.user_roles (user_id, role)
VALUES ('4fba7a48-825b-4690-8e3e-804c574ab960', 'admin');

-- Update drafts policies: admin can update/delete any draft
DROP POLICY IF EXISTS "Creators can update own drafts" ON public.drafts;
CREATE POLICY "Creators or admins can update drafts"
ON public.drafts FOR UPDATE TO authenticated
USING (auth.uid() = created_by OR public.is_app_admin(auth.uid()));

DROP POLICY IF EXISTS "Creators can delete own drafts" ON public.drafts;
CREATE POLICY "Creators or admins can delete drafts"
ON public.drafts FOR DELETE TO authenticated
USING (auth.uid() = created_by OR public.is_app_admin(auth.uid()));

-- Update competitions policies
DROP POLICY IF EXISTS "Creators can update own competitions" ON public.competitions;
CREATE POLICY "Creators or admins can update competitions"
ON public.competitions FOR UPDATE TO authenticated
USING (auth.uid() = created_by OR public.is_app_admin(auth.uid()));

DROP POLICY IF EXISTS "Creators can delete own competitions" ON public.competitions;
CREATE POLICY "Creators or admins can delete competitions"
ON public.competitions FOR DELETE TO authenticated
USING (auth.uid() = created_by OR public.is_app_admin(auth.uid()));

-- Update draft_picks: admin can update/delete any picks
DROP POLICY IF EXISTS "Creator or picker can update draft picks" ON public.draft_picks;
CREATE POLICY "Creator picker or admin can update draft picks"
ON public.draft_picks FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_app_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM drafts WHERE drafts.id = draft_picks.draft_id AND drafts.created_by = auth.uid())
);

DROP POLICY IF EXISTS "Creators can delete draft picks" ON public.draft_picks;
DROP POLICY IF EXISTS "Users can delete own draft picks" ON public.draft_picks;
CREATE POLICY "Owner creator or admin can delete draft picks"
ON public.draft_picks FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_app_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM drafts WHERE drafts.id = draft_picks.draft_id AND drafts.created_by = auth.uid())
);

-- Update draft_participants: admin can manage
DROP POLICY IF EXISTS "Creators can delete draft participants" ON public.draft_participants;
DROP POLICY IF EXISTS "Draft creators can remove participants" ON public.draft_participants;
CREATE POLICY "Creator or admin can delete participants"
ON public.draft_participants FOR DELETE TO authenticated
USING (
  public.is_app_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM drafts WHERE drafts.id = draft_participants.draft_id AND drafts.created_by = auth.uid())
);

DROP POLICY IF EXISTS "Draft creators can update participants" ON public.draft_participants;
CREATE POLICY "Creator or admin can update participants"
ON public.draft_participants FOR UPDATE TO authenticated
USING (
  public.is_app_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM drafts WHERE drafts.id = draft_participants.draft_id AND drafts.created_by = auth.uid())
);

-- Update draft_results: admin can manage
DROP POLICY IF EXISTS "Draft creator can insert results" ON public.draft_results;
CREATE POLICY "Creator or admin can insert results"
ON public.draft_results FOR INSERT TO authenticated
WITH CHECK (
  public.is_app_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM drafts WHERE drafts.id = draft_results.draft_id AND drafts.created_by = auth.uid())
);

DROP POLICY IF EXISTS "Draft creator can update results" ON public.draft_results;
CREATE POLICY "Creator or admin can update results"
ON public.draft_results FOR UPDATE TO authenticated
USING (
  public.is_app_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM drafts WHERE drafts.id = draft_results.draft_id AND drafts.created_by = auth.uid())
);

DROP POLICY IF EXISTS "Draft creator can delete results" ON public.draft_results;
CREATE POLICY "Creator or admin can delete results"
ON public.draft_results FOR DELETE TO authenticated
USING (
  public.is_app_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM drafts WHERE drafts.id = draft_results.draft_id AND drafts.created_by = auth.uid())
);

-- Update events: admin can manage any
DROP POLICY IF EXISTS "Creators can update events" ON public.events;
CREATE POLICY "Creator or admin can update events"
ON public.events FOR UPDATE TO authenticated
USING (auth.uid() = created_by OR public.is_app_admin(auth.uid()));

DROP POLICY IF EXISTS "Creators can delete events" ON public.events;
CREATE POLICY "Creator or admin can delete events"
ON public.events FOR DELETE TO authenticated
USING (auth.uid() = created_by OR public.is_app_admin(auth.uid()));

-- Update polls: admin can manage
-- polls doesn't have update/delete policies currently via created_by, but let's add them
-- (polls table has created_by column)

-- Update messages: admin can update/delete any
DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
CREATE POLICY "Owner or admin can update messages"
ON public.messages FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.is_app_admin(auth.uid()))
WITH CHECK (auth.uid() = user_id OR public.is_app_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;
CREATE POLICY "Owner or admin can delete messages"
ON public.messages FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.is_app_admin(auth.uid()));

-- Update channels: admin can manage
DROP POLICY IF EXISTS "Authenticated can delete channels" ON public.channels;
CREATE POLICY "Admin can delete channels"
ON public.channels FOR DELETE TO authenticated
USING (public.is_app_admin(auth.uid()));

-- Update posts: admin can manage any
-- posts has user_id column
-- No existing update/delete creator policies visible, but let's ensure admin access

-- Draft seasons: admin can manage
DROP POLICY IF EXISTS "Authenticated can update seasons" ON public.draft_seasons;
CREATE POLICY "Commissioner or admin can update seasons"
ON public.draft_seasons FOR UPDATE TO authenticated
USING (commissioner_user_id = auth.uid() OR public.is_app_admin(auth.uid()));
