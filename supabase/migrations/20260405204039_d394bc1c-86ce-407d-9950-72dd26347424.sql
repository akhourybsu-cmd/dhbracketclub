
-- Seasons table
CREATE TABLE public.draft_seasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  season_label TEXT NOT NULL CHECK (season_label IN ('winter', 'spring', 'summer', 'fall')),
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'regular_season', 'playoffs', 'complete')),
  regular_season_weeks INTEGER NOT NULL DEFAULT 8,
  playoff_weeks INTEGER NOT NULL DEFAULT 2,
  best_of INTEGER NOT NULL DEFAULT 6,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (year, season_label)
);

ALTER TABLE public.draft_seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Seasons viewable by authenticated" ON public.draft_seasons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create seasons" ON public.draft_seasons FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update seasons" ON public.draft_seasons FOR UPDATE TO authenticated USING (true);

-- Season entries: links a draft to a season week
CREATE TABLE public.draft_season_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES public.draft_seasons(id) ON DELETE CASCADE,
  draft_id UUID NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  is_playoff BOOLEAN NOT NULL DEFAULT false,
  season_points_awarded JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (draft_id)
);

ALTER TABLE public.draft_season_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Entries viewable by authenticated" ON public.draft_season_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create entries" ON public.draft_season_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update entries" ON public.draft_season_entries FOR UPDATE TO authenticated USING (true);

-- Season standings: per-user per-season aggregate
CREATE TABLE public.draft_season_standings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES public.draft_seasons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  season_points INTEGER NOT NULL DEFAULT 0,
  drafts_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  podiums INTEGER NOT NULL DEFAULT 0,
  avg_finish NUMERIC NOT NULL DEFAULT 0,
  avg_score NUMERIC NOT NULL DEFAULT 0,
  best_score NUMERIC NOT NULL DEFAULT 0,
  worst_score NUMERIC NOT NULL DEFAULT 999,
  consistency NUMERIC NOT NULL DEFAULT 0,
  rank INTEGER,
  playoff_seed INTEGER,
  is_eliminated BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (season_id, user_id)
);

ALTER TABLE public.draft_season_standings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Standings viewable by authenticated" ON public.draft_season_standings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert standings" ON public.draft_season_standings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update standings" ON public.draft_season_standings FOR UPDATE TO authenticated USING (true);

-- Playoff matches
CREATE TABLE public.draft_playoff_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES public.draft_seasons(id) ON DELETE CASCADE,
  round TEXT NOT NULL CHECK (round IN ('semifinal', 'final', 'third_place')),
  match_number INTEGER NOT NULL DEFAULT 1,
  seed_a INTEGER NOT NULL,
  seed_b INTEGER NOT NULL,
  user_a UUID,
  user_b UUID,
  draft_id UUID REFERENCES public.drafts(id),
  winner_user_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'complete')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.draft_playoff_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Matches viewable by authenticated" ON public.draft_playoff_matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create matches" ON public.draft_playoff_matches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update matches" ON public.draft_playoff_matches FOR UPDATE TO authenticated USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_draft_seasons_updated_at BEFORE UPDATE ON public.draft_seasons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_draft_season_standings_updated_at BEFORE UPDATE ON public.draft_season_standings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_draft_playoff_matches_updated_at BEFORE UPDATE ON public.draft_playoff_matches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
