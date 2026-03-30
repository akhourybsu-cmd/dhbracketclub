
-- Weekly cycles
CREATE TABLE public.lockbox_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number integer NOT NULL,
  year integer NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(week_number, year)
);

ALTER TABLE public.lockbox_weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Weeks viewable by authenticated" ON public.lockbox_weeks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert weeks" ON public.lockbox_weeks
  FOR INSERT TO authenticated WITH CHECK (true);

-- Locks
CREATE TABLE public.lockbox_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid REFERENCES public.lockbox_weeks(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  number_code text NOT NULL,
  color_code text NOT NULL,
  maze_id integer NOT NULL,
  is_cracked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(week_id, user_id)
);

ALTER TABLE public.lockbox_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Locks viewable by authenticated" ON public.lockbox_locks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create own lock" ON public.lockbox_locks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lock" ON public.lockbox_locks
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Crack attempts (tracks each player's progress against a lock)
CREATE TABLE public.lockbox_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lock_id uuid REFERENCES public.lockbox_locks(id) ON DELETE CASCADE NOT NULL,
  attacker_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  phase text NOT NULL DEFAULT 'number',
  total_attempts integer NOT NULL DEFAULT 0,
  is_solved boolean NOT NULL DEFAULT false,
  solved_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lock_id, attacker_id)
);

ALTER TABLE public.lockbox_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attempts viewable by authenticated" ON public.lockbox_attempts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create own attempts" ON public.lockbox_attempts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = attacker_id);

CREATE POLICY "Users can update own attempts" ON public.lockbox_attempts
  FOR UPDATE TO authenticated USING (auth.uid() = attacker_id);

-- Individual guesses (for clue history)
CREATE TABLE public.lockbox_guesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid REFERENCES public.lockbox_attempts(id) ON DELETE CASCADE NOT NULL,
  phase text NOT NULL,
  guess_value text NOT NULL,
  correct_position integer NOT NULL DEFAULT 0,
  correct_value integer NOT NULL DEFAULT 0,
  is_correct boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lockbox_guesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guesses viewable by authenticated" ON public.lockbox_guesses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own guesses" ON public.lockbox_guesses
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.lockbox_attempts WHERE id = lockbox_guesses.attempt_id AND attacker_id = auth.uid())
  );

-- Weekly scores
CREATE TABLE public.lockbox_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid REFERENCES public.lockbox_weeks(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  crack_points integer NOT NULL DEFAULT 0,
  defense_points integer NOT NULL DEFAULT 0,
  total_points integer NOT NULL DEFAULT 0,
  rank integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(week_id, user_id)
);

ALTER TABLE public.lockbox_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scores viewable by authenticated" ON public.lockbox_scores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own scores" ON public.lockbox_scores
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scores" ON public.lockbox_scores
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
