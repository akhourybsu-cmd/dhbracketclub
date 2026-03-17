
-- ═══ DH Club Expansion — New Module Tables ═══

-- Umbrella competition entity
CREATE TABLE public.competitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('bracket_pool', 'ranking', 'poll', 'draft')),
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Competitions viewable by authenticated" ON public.competitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create competitions" ON public.competitions FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update own competitions" ON public.competitions FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Creators can delete own competitions" ON public.competitions FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE TRIGGER update_competitions_updated_at BEFORE UPDATE ON public.competitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══ RANKINGS ═══

CREATE TABLE public.rankings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  item_count INT NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rankings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rankings viewable by authenticated" ON public.rankings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create rankings" ON public.rankings FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update own rankings" ON public.rankings FOR UPDATE TO authenticated USING (auth.uid() = created_by);

CREATE TRIGGER update_rankings_updated_at BEFORE UPDATE ON public.rankings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ranking_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ranking_id UUID NOT NULL REFERENCES public.rankings(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  image_url TEXT,
  position INT NOT NULL DEFAULT 0
);

ALTER TABLE public.ranking_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ranking items viewable by authenticated" ON public.ranking_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Ranking creators can manage items" ON public.ranking_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.rankings WHERE id = ranking_id AND created_by = auth.uid()));
CREATE POLICY "Ranking creators can update items" ON public.ranking_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rankings WHERE id = ranking_id AND created_by = auth.uid()));
CREATE POLICY "Ranking creators can delete items" ON public.ranking_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rankings WHERE id = ranking_id AND created_by = auth.uid()));

CREATE TABLE public.ranking_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ranking_id UUID NOT NULL REFERENCES public.rankings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ranking_id, user_id)
);

ALTER TABLE public.ranking_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Submissions viewable by authenticated" ON public.ranking_submissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can submit own rankings" ON public.ranking_submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own submissions" ON public.ranking_submissions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own submissions" ON public.ranking_submissions FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.ranking_submission_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.ranking_submissions(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.ranking_items(id) ON DELETE CASCADE,
  rank INT NOT NULL
);

ALTER TABLE public.ranking_submission_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Entries viewable by authenticated" ON public.ranking_submission_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage own entries" ON public.ranking_submission_entries FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.ranking_submissions WHERE id = submission_id AND user_id = auth.uid()));
CREATE POLICY "Users can update own entries" ON public.ranking_submission_entries FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ranking_submissions WHERE id = submission_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete own entries" ON public.ranking_submission_entries FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ranking_submissions WHERE id = submission_id AND user_id = auth.uid()));

-- ═══ POLLS ═══

CREATE TABLE public.polls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  poll_type TEXT NOT NULL DEFAULT 'single' CHECK (poll_type IN ('single', 'multi')),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  closes_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Polls viewable by authenticated" ON public.polls FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create polls" ON public.polls FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update own polls" ON public.polls FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Creators can delete own polls" ON public.polls FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE TRIGGER update_polls_updated_at BEFORE UPDATE ON public.polls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.poll_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0
);

ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Poll options viewable by authenticated" ON public.poll_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "Poll creators can manage options" ON public.poll_options FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.polls WHERE id = poll_id AND created_by = auth.uid()));
CREATE POLICY "Poll creators can delete options" ON public.poll_options FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polls WHERE id = poll_id AND created_by = auth.uid()));

CREATE TABLE public.poll_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Votes viewable by authenticated" ON public.poll_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can cast votes" ON public.poll_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own votes" ON public.poll_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ═══ DRAFTS ═══

CREATE TABLE public.drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  num_rounds INT NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'in_progress', 'complete')),
  current_pick_user_id UUID REFERENCES public.profiles(id),
  current_round INT NOT NULL DEFAULT 1,
  current_pick_number INT NOT NULL DEFAULT 1,
  timer_seconds INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Drafts viewable by authenticated" ON public.drafts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create drafts" ON public.drafts FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update own drafts" ON public.drafts FOR UPDATE TO authenticated USING (auth.uid() = created_by);

CREATE TRIGGER update_drafts_updated_at BEFORE UPDATE ON public.drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.draft_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  pick_order INT NOT NULL,
  UNIQUE(draft_id, user_id),
  UNIQUE(draft_id, pick_order)
);

ALTER TABLE public.draft_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Draft participants viewable by authenticated" ON public.draft_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Draft creators can manage participants" ON public.draft_participants FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.drafts WHERE id = draft_id AND created_by = auth.uid()));
CREATE POLICY "Draft creators can remove participants" ON public.draft_participants FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drafts WHERE id = draft_id AND created_by = auth.uid()));

CREATE TABLE public.draft_picks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  round INT NOT NULL,
  pick_number INT NOT NULL,
  pick_text TEXT NOT NULL,
  picked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(draft_id, round, pick_number)
);

ALTER TABLE public.draft_picks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Draft picks viewable by authenticated" ON public.draft_picks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can make own picks" ON public.draft_picks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ═══ ACTIVITY FEED ═══

CREATE TABLE public.activity_feed (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id UUID NOT NULL REFERENCES public.profiles(id),
  event_type TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Activity viewable by authenticated" ON public.activity_feed FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can insert activity" ON public.activity_feed FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_user_id);

-- ═══ REACTIONS ═══

CREATE TABLE public.reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('fraud', 'elite', 'horrible_take', 'robbery', 'respect', 'cooked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, target_type, target_id, reaction_type)
);

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reactions viewable by authenticated" ON public.reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can add reactions" ON public.reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own reactions" ON public.reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Enable realtime for activity feed and drafts
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_feed;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drafts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.draft_picks;
