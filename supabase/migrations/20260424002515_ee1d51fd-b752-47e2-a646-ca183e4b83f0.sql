
-- =====================================================
-- PHASE 1: Multi-Club foundation
-- =====================================================

CREATE TABLE IF NOT EXISTS public.clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  accent_color text NOT NULL DEFAULT '152 72% 46%',
  logo_url text,
  owner_admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.club_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_club_members_club ON public.club_members(club_id);

CREATE TABLE IF NOT EXISTS public.club_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  proposed_name text NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_club_requests_status ON public.club_requests(status);

CREATE OR REPLACE FUNCTION public.current_user_club_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT club_id FROM public.club_members WHERE user_id = auth.uid() LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.is_club_admin(_user uuid, _club uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.club_members WHERE user_id=_user AND club_id=_club AND role='admin') $$;

CREATE OR REPLACE FUNCTION public.is_platform_owner(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user AND role='owner'::app_role) $$;

-- Seed DH Club with a fixed valid UUID
INSERT INTO public.clubs (id, name, slug, accent_color, owner_admin_id, status)
VALUES ('11111111-1111-1111-1111-111111111111', 'DH Club', 'dh-club', '152 72% 46%',
        '4fba7a48-825b-4690-8e3e-804c574ab960', 'active')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES ('4fba7a48-825b-4690-8e3e-804c574ab960', 'owner'::app_role)
ON CONFLICT DO NOTHING;

INSERT INTO public.club_members (club_id, user_id, role)
SELECT '11111111-1111-1111-1111-111111111111', p.id,
       CASE WHEN p.id = '4fba7a48-825b-4690-8e3e-804c574ab960' THEN 'admin' ELSE 'member' END
FROM public.profiles p
ON CONFLICT (user_id) DO NOTHING;

DO $$
DECLARE
  t text;
  scoped_tables text[] := ARRAY[
    'drafts','draft_participants','draft_picks','draft_results','draft_seasons',
    'draft_season_entries','draft_season_standings','draft_playoff_matches','draft_pick_disputes',
    'channels','channel_categories','messages','message_reactions','message_link_previews','channel_read_states',
    'events','event_rsvps','event_comments',
    'posts','post_comments','reactions',
    'polls','poll_options','poll_votes','rankings','ranking_items','ranking_submissions','ranking_submission_entries',
    'lore_entries','lore_contributions','lore_reactions',
    'lockbox_weeks','lockbox_locks','lockbox_attempts','lockbox_guesses','lockbox_scores',
    'rune_delve_runs','rune_delve_heroes','rune_delve_progress','rune_delve_class_progress',
    'rune_delve_daily_runs','rune_delve_daily_streaks','rune_delve_wallet','rune_delve_loadouts',
    'rune_delve_bestiary','rune_delve_relic_unlocks','rune_delve_active_quests','rune_delve_failure_rewards',
    'activity_feed','push_subscriptions','notification_preferences','invite_codes',
    'competitions','pools','pool_members','brackets','bracket_picks',
    'nfl_picks','nfl_season_standings','nfl_weekly_standings','nfl_tiebreakers'
  ];
BEGIN
  FOREACH t IN ARRAY scoped_tables LOOP
    IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE', t);
      EXECUTE format('UPDATE public.%I SET club_id = %L WHERE club_id IS NULL', t, '11111111-1111-1111-1111-111111111111');
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN club_id SET NOT NULL', t);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_club_id ON public.%I(club_id)', t, t);
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_view_own_club" ON public.clubs;
CREATE POLICY "members_view_own_club" ON public.clubs FOR SELECT
  USING (id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));

DROP POLICY IF EXISTS "owner_insert_clubs" ON public.clubs;
CREATE POLICY "owner_insert_clubs" ON public.clubs FOR INSERT
  WITH CHECK (public.is_platform_owner(auth.uid()));

DROP POLICY IF EXISTS "admin_update_own_club" ON public.clubs;
CREATE POLICY "admin_update_own_club" ON public.clubs FOR UPDATE
  USING (public.is_club_admin(auth.uid(), id) OR public.is_platform_owner(auth.uid()));

DROP POLICY IF EXISTS "members_view_roster" ON public.club_members;
CREATE POLICY "members_view_roster" ON public.club_members FOR SELECT
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));

DROP POLICY IF EXISTS "admin_manage_members" ON public.club_members;
CREATE POLICY "admin_manage_members" ON public.club_members FOR ALL
  USING (public.is_club_admin(auth.uid(), club_id) OR public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_club_admin(auth.uid(), club_id) OR public.is_platform_owner(auth.uid()));

DROP POLICY IF EXISTS "user_view_own_requests" ON public.club_requests;
CREATE POLICY "user_view_own_requests" ON public.club_requests FOR SELECT
  USING (requested_by = auth.uid() OR public.is_platform_owner(auth.uid()));

DROP POLICY IF EXISTS "user_create_request" ON public.club_requests;
CREATE POLICY "user_create_request" ON public.club_requests FOR INSERT
  WITH CHECK (requested_by = auth.uid());

DROP POLICY IF EXISTS "owner_review_requests" ON public.club_requests;
CREATE POLICY "owner_review_requests" ON public.club_requests FOR UPDATE
  USING (public.is_platform_owner(auth.uid()));

DROP TRIGGER IF EXISTS update_clubs_updated_at ON public.clubs;
CREATE TRIGGER update_clubs_updated_at
  BEFORE UPDATE ON public.clubs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
