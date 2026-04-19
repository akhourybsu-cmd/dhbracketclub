
-- =========================
-- nfl_teams
-- =========================
CREATE TABLE public.nfl_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  abbr text NOT NULL UNIQUE,
  name text NOT NULL,
  city text NOT NULL,
  conference text NOT NULL CHECK (conference IN ('AFC','NFC')),
  division text NOT NULL CHECK (division IN ('North','South','East','West')),
  primary_color text,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nfl_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teams viewable by authenticated" ON public.nfl_teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert teams" ON public.nfl_teams FOR INSERT TO authenticated WITH CHECK (is_app_admin(auth.uid()));
CREATE POLICY "Admins can update teams" ON public.nfl_teams FOR UPDATE TO authenticated USING (is_app_admin(auth.uid()));
CREATE POLICY "Admins can delete teams" ON public.nfl_teams FOR DELETE TO authenticated USING (is_app_admin(auth.uid()));

-- =========================
-- nfl_seasons
-- =========================
CREATE TABLE public.nfl_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','active','complete')),
  current_week integer NOT NULL DEFAULT 1,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nfl_seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seasons viewable by authenticated" ON public.nfl_seasons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert seasons" ON public.nfl_seasons FOR INSERT TO authenticated WITH CHECK (is_app_admin(auth.uid()));
CREATE POLICY "Admins can update seasons" ON public.nfl_seasons FOR UPDATE TO authenticated USING (is_app_admin(auth.uid()));
CREATE POLICY "Admins can delete seasons" ON public.nfl_seasons FOR DELETE TO authenticated USING (is_app_admin(auth.uid()));
CREATE TRIGGER trg_nfl_seasons_updated BEFORE UPDATE ON public.nfl_seasons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- nfl_weeks
-- =========================
CREATE TABLE public.nfl_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.nfl_seasons(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  label text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','open','partially_locked','closed','scored')),
  featured_game_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(season_id, week_number)
);
ALTER TABLE public.nfl_weeks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Weeks viewable by authenticated" ON public.nfl_weeks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert weeks" ON public.nfl_weeks FOR INSERT TO authenticated WITH CHECK (is_app_admin(auth.uid()));
CREATE POLICY "Admins can update weeks" ON public.nfl_weeks FOR UPDATE TO authenticated USING (is_app_admin(auth.uid()));
CREATE POLICY "Admins can delete weeks" ON public.nfl_weeks FOR DELETE TO authenticated USING (is_app_admin(auth.uid()));
CREATE TRIGGER trg_nfl_weeks_updated BEFORE UPDATE ON public.nfl_weeks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- nfl_games
-- =========================
CREATE TABLE public.nfl_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.nfl_seasons(id) ON DELETE CASCADE,
  week_id uuid NOT NULL REFERENCES public.nfl_weeks(id) ON DELETE CASCADE,
  away_team_id uuid NOT NULL REFERENCES public.nfl_teams(id),
  home_team_id uuid NOT NULL REFERENCES public.nfl_teams(id),
  kickoff_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','final')),
  away_score integer,
  home_score integer,
  winner_team_id uuid REFERENCES public.nfl_teams(id),
  external_provider text,
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_nfl_games_week ON public.nfl_games(week_id);
CREATE INDEX idx_nfl_games_season_kickoff ON public.nfl_games(season_id, kickoff_at);
ALTER TABLE public.nfl_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Games viewable by authenticated" ON public.nfl_games FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert games" ON public.nfl_games FOR INSERT TO authenticated WITH CHECK (is_app_admin(auth.uid()));
CREATE POLICY "Admins can update games" ON public.nfl_games FOR UPDATE TO authenticated USING (is_app_admin(auth.uid()));
CREATE POLICY "Admins can delete games" ON public.nfl_games FOR DELETE TO authenticated USING (is_app_admin(auth.uid()));
CREATE TRIGGER trg_nfl_games_updated BEFORE UPDATE ON public.nfl_games FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.nfl_weeks ADD CONSTRAINT nfl_weeks_featured_game_fk FOREIGN KEY (featured_game_id) REFERENCES public.nfl_games(id) ON DELETE SET NULL;

-- Helper function: is this game still pickable (kickoff in the future, not started)?
CREATE OR REPLACE FUNCTION public.is_pick_unlocked(_game_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.nfl_games
    WHERE id = _game_id AND kickoff_at > now() AND status = 'scheduled'
  )
$$;

-- =========================
-- nfl_picks
-- =========================
CREATE TABLE public.nfl_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  game_id uuid NOT NULL REFERENCES public.nfl_games(id) ON DELETE CASCADE,
  week_id uuid NOT NULL REFERENCES public.nfl_weeks(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.nfl_seasons(id) ON DELETE CASCADE,
  picked_team_id uuid NOT NULL REFERENCES public.nfl_teams(id),
  is_correct boolean,
  points_awarded integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, game_id)
);
CREATE INDEX idx_nfl_picks_user_week ON public.nfl_picks(user_id, week_id);
CREATE INDEX idx_nfl_picks_user_season ON public.nfl_picks(user_id, season_id);
ALTER TABLE public.nfl_picks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Picks viewable by authenticated" ON public.nfl_picks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create own picks while unlocked" ON public.nfl_picks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_pick_unlocked(game_id));
CREATE POLICY "Users can update own picks while unlocked" ON public.nfl_picks FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND is_pick_unlocked(game_id))
  WITH CHECK (auth.uid() = user_id AND is_pick_unlocked(game_id));
CREATE POLICY "Users can delete own picks while unlocked" ON public.nfl_picks FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND is_pick_unlocked(game_id));
CREATE POLICY "Admins can update any pick" ON public.nfl_picks FOR UPDATE TO authenticated USING (is_app_admin(auth.uid()));
CREATE TRIGGER trg_nfl_picks_updated BEFORE UPDATE ON public.nfl_picks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- nfl_tiebreakers
-- =========================
CREATE TABLE public.nfl_tiebreakers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_id uuid NOT NULL REFERENCES public.nfl_weeks(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.nfl_seasons(id) ON DELETE CASCADE,
  predicted_total integer NOT NULL,
  actual_total integer,
  delta integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_id)
);
ALTER TABLE public.nfl_tiebreakers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tiebreakers viewable by authenticated" ON public.nfl_tiebreakers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create own tiebreakers before featured kickoff" ON public.nfl_tiebreakers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.nfl_weeks w JOIN public.nfl_games g ON g.id = w.featured_game_id
    WHERE w.id = nfl_tiebreakers.week_id AND g.kickoff_at > now()));
CREATE POLICY "Users can update own tiebreakers before featured kickoff" ON public.nfl_tiebreakers FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.nfl_weeks w JOIN public.nfl_games g ON g.id = w.featured_game_id
    WHERE w.id = nfl_tiebreakers.week_id AND g.kickoff_at > now()));
CREATE POLICY "Admins can update tiebreakers" ON public.nfl_tiebreakers FOR UPDATE TO authenticated USING (is_app_admin(auth.uid()));
CREATE TRIGGER trg_nfl_tiebreakers_updated BEFORE UPDATE ON public.nfl_tiebreakers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- nfl_weekly_standings
-- =========================
CREATE TABLE public.nfl_weekly_standings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_id uuid NOT NULL REFERENCES public.nfl_weeks(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.nfl_seasons(id) ON DELETE CASCADE,
  correct_picks integer NOT NULL DEFAULT 0,
  total_picks integer NOT NULL DEFAULT 0,
  accuracy numeric NOT NULL DEFAULT 0,
  tiebreak_delta integer,
  rank integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_id)
);
ALTER TABLE public.nfl_weekly_standings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Weekly standings viewable by authenticated" ON public.nfl_weekly_standings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage weekly standings" ON public.nfl_weekly_standings FOR ALL TO authenticated
  USING (is_app_admin(auth.uid())) WITH CHECK (is_app_admin(auth.uid()));

-- =========================
-- nfl_season_standings
-- =========================
CREATE TABLE public.nfl_season_standings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  season_id uuid NOT NULL REFERENCES public.nfl_seasons(id) ON DELETE CASCADE,
  total_correct integer NOT NULL DEFAULT 0,
  total_picked integer NOT NULL DEFAULT 0,
  accuracy numeric NOT NULL DEFAULT 0,
  weekly_wins integer NOT NULL DEFAULT 0,
  avg_weekly_rank numeric,
  rank integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, season_id)
);
ALTER TABLE public.nfl_season_standings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Season standings viewable by authenticated" ON public.nfl_season_standings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage season standings" ON public.nfl_season_standings FOR ALL TO authenticated
  USING (is_app_admin(auth.uid())) WITH CHECK (is_app_admin(auth.uid()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.nfl_picks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nfl_games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nfl_weekly_standings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nfl_season_standings;
