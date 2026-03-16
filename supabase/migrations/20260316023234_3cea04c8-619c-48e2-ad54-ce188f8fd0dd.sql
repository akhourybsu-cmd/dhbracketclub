
-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =====================
-- CREATE ALL TABLES FIRST
-- =====================

-- 1. PROFILES
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 2. TOURNAMENTS
CREATE TABLE public.tournaments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  sport TEXT DEFAULT 'basketball',
  gender_division TEXT DEFAULT 'mens',
  lock_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT CHECK (status IN ('upcoming', 'active', 'completed')) DEFAULT 'upcoming',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 3. TEAMS
CREATE TABLE public.teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID REFERENCES public.tournaments ON DELETE CASCADE NOT NULL,
  school_name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  seed INTEGER NOT NULL,
  region TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 4. GAMES
CREATE TABLE public.games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID REFERENCES public.tournaments ON DELETE CASCADE NOT NULL,
  round_number INTEGER NOT NULL,
  round_name TEXT NOT NULL,
  region TEXT NOT NULL,
  game_slot INTEGER NOT NULL,
  team1_id UUID REFERENCES public.teams(id),
  team2_id UUID REFERENCES public.teams(id),
  winner_team_id UUID REFERENCES public.teams(id),
  team1_score INTEGER,
  team2_score INTEGER,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  status TEXT CHECK (status IN ('scheduled', 'in_progress', 'final')) DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 5. POOLS
CREATE TABLE public.pools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID REFERENCES public.profiles(id) NOT NULL,
  tournament_id UUID REFERENCES public.tournaments(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT UNIQUE NOT NULL,
  visibility TEXT CHECK (visibility IN ('public', 'private')) DEFAULT 'private',
  lock_time TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 6. POOL_MEMBERS
CREATE TABLE public.pool_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pool_id UUID REFERENCES public.pools ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('admin', 'member')) DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(pool_id, user_id)
);

-- 7. BRACKETS
CREATE TABLE public.brackets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pool_id UUID REFERENCES public.pools ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('draft', 'submitted')) DEFAULT 'draft',
  submitted_at TIMESTAMP WITH TIME ZONE,
  tiebreaker_score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(pool_id, user_id)
);

-- 8. BRACKET_PICKS
CREATE TABLE public.bracket_picks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bracket_id UUID REFERENCES public.brackets ON DELETE CASCADE NOT NULL,
  game_id UUID REFERENCES public.games ON DELETE CASCADE NOT NULL,
  picked_team_id UUID REFERENCES public.teams(id) NOT NULL,
  picked_in_round INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(bracket_id, game_id)
);

-- 9. SCORING_RULES
CREATE TABLE public.scoring_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pool_id UUID REFERENCES public.pools ON DELETE CASCADE NOT NULL,
  round_number INTEGER NOT NULL,
  points_per_correct_pick INTEGER NOT NULL,
  UNIQUE(pool_id, round_number)
);

-- 10. STANDINGS
CREATE TABLE public.standings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pool_id UUID REFERENCES public.pools ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  total_points INTEGER DEFAULT 0,
  correct_picks INTEGER DEFAULT 0,
  possible_points_remaining INTEGER DEFAULT 0,
  rank INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(pool_id, user_id)
);

-- 11. ADMIN_LOGS
CREATE TABLE public.admin_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pool_id UUID REFERENCES public.pools ON DELETE CASCADE NOT NULL,
  actor_user_id UUID REFERENCES public.profiles(id) NOT NULL,
  action_type TEXT NOT NULL,
  action_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- =====================
-- ENABLE RLS ON ALL TABLES
-- =====================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brackets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bracket_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- =====================
-- SECURITY DEFINER FUNCTIONS
-- =====================
CREATE OR REPLACE FUNCTION public.is_pool_member(_user_id UUID, _pool_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.pool_members WHERE user_id = _user_id AND pool_id = _pool_id)
$$;

CREATE OR REPLACE FUNCTION public.is_pool_admin(_user_id UUID, _pool_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.pool_members WHERE user_id = _user_id AND pool_id = _pool_id AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.get_bracket_pool_id(_bracket_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT pool_id FROM public.brackets WHERE id = _bracket_id
$$;

-- =====================
-- RLS POLICIES
-- =====================

-- Profiles
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Tournaments & Teams & Games (public read)
CREATE POLICY "Tournaments viewable by everyone" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Teams viewable by everyone" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Games viewable by everyone" ON public.games FOR SELECT USING (true);
-- Admin can update games (for entering results)
CREATE POLICY "Authenticated users can update games" ON public.games FOR UPDATE USING (auth.role() = 'authenticated');

-- Pools
CREATE POLICY "Pools viewable by members" ON public.pools FOR SELECT USING (public.is_pool_member(auth.uid(), id));
CREATE POLICY "Anyone can lookup pool by invite code" ON public.pools FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create pools" ON public.pools FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Admins can update pools" ON public.pools FOR UPDATE USING (public.is_pool_admin(auth.uid(), id));

-- Pool Members
CREATE POLICY "Members can view pool members" ON public.pool_members FOR SELECT USING (public.is_pool_member(auth.uid(), pool_id));
CREATE POLICY "Users can join pools" ON public.pool_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage members" ON public.pool_members FOR DELETE USING (public.is_pool_admin(auth.uid(), pool_id));

-- Brackets
CREATE POLICY "Brackets viewable by pool members" ON public.brackets FOR SELECT USING (public.is_pool_member(auth.uid(), pool_id));
CREATE POLICY "Users can create own bracket" ON public.brackets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bracket before lock" ON public.brackets FOR UPDATE
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.pools WHERE id = pool_id AND lock_time > now()));

-- Bracket Picks
CREATE POLICY "Picks viewable by pool members" ON public.bracket_picks FOR SELECT
  USING (public.is_pool_member(auth.uid(), public.get_bracket_pool_id(bracket_id)));
CREATE POLICY "Users can insert own picks" ON public.bracket_picks FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.brackets b JOIN public.pools p ON p.id = b.pool_id WHERE b.id = bracket_id AND b.user_id = auth.uid() AND p.lock_time > now()));
CREATE POLICY "Users can update own picks" ON public.bracket_picks FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.brackets b JOIN public.pools p ON p.id = b.pool_id WHERE b.id = bracket_id AND b.user_id = auth.uid() AND p.lock_time > now()));
CREATE POLICY "Users can delete own picks" ON public.bracket_picks FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.brackets b JOIN public.pools p ON p.id = b.pool_id WHERE b.id = bracket_id AND b.user_id = auth.uid() AND p.lock_time > now()));

-- Scoring Rules
CREATE POLICY "Scoring rules viewable by pool members" ON public.scoring_rules FOR SELECT USING (public.is_pool_member(auth.uid(), pool_id));
CREATE POLICY "Admins can insert scoring rules" ON public.scoring_rules FOR INSERT WITH CHECK (public.is_pool_admin(auth.uid(), pool_id));
CREATE POLICY "Admins can update scoring rules" ON public.scoring_rules FOR UPDATE USING (public.is_pool_admin(auth.uid(), pool_id));

-- Standings
CREATE POLICY "Standings viewable by pool members" ON public.standings FOR SELECT USING (public.is_pool_member(auth.uid(), pool_id));
CREATE POLICY "Standings insertable by system" ON public.standings FOR INSERT WITH CHECK (public.is_pool_member(auth.uid(), pool_id));
CREATE POLICY "Standings updatable by system" ON public.standings FOR UPDATE USING (public.is_pool_member(auth.uid(), pool_id));

-- Admin Logs
CREATE POLICY "Admin logs viewable by pool admins" ON public.admin_logs FOR SELECT USING (public.is_pool_admin(auth.uid(), pool_id));
CREATE POLICY "Admins can insert logs" ON public.admin_logs FOR INSERT WITH CHECK (public.is_pool_admin(auth.uid(), pool_id));

-- =====================
-- TRIGGERS
-- =====================
CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON public.games FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_brackets_updated_at BEFORE UPDATE ON public.brackets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bracket_picks_updated_at BEFORE UPDATE ON public.bracket_picks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_standings_updated_at BEFORE UPDATE ON public.standings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================
-- INDEXES
-- =====================
CREATE INDEX idx_teams_tournament ON public.teams(tournament_id);
CREATE INDEX idx_games_tournament ON public.games(tournament_id);
CREATE INDEX idx_games_round ON public.games(tournament_id, round_number);
CREATE INDEX idx_pool_members_pool ON public.pool_members(pool_id);
CREATE INDEX idx_pool_members_user ON public.pool_members(user_id);
CREATE INDEX idx_brackets_pool ON public.brackets(pool_id);
CREATE INDEX idx_bracket_picks_bracket ON public.bracket_picks(bracket_id);
CREATE INDEX idx_standings_pool ON public.standings(pool_id);
CREATE INDEX idx_pools_invite_code ON public.pools(invite_code);
