
-- Portfolio Wars: weekly stock-picking competition
-- Status enum
DO $$ BEGIN
  CREATE TYPE public.pw_challenge_status AS ENUM ('upcoming','locked','active','completed','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Challenges: one per trading week
CREATE TABLE IF NOT EXISTS public.pw_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  -- Display week start (Monday) and end (Friday) in calendar terms
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  -- Actual lock and finalization timestamps (market-calendar aware, set by admin or cron)
  lock_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status public.pw_challenge_status NOT NULL DEFAULT 'upcoming',
  -- Resolved trading day metadata (filled when locks/finalizes)
  start_trading_date DATE,
  end_trading_date DATE,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (year, week_number)
);

CREATE INDEX IF NOT EXISTS idx_pw_challenges_status ON public.pw_challenges(status);
CREATE INDEX IF NOT EXISTS idx_pw_challenges_week_start ON public.pw_challenges(week_start DESC);

-- User entries (one per user per challenge)
CREATE TABLE IF NOT EXISTS public.pw_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.pw_challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  avg_pct NUMERIC(8,4),
  final_rank INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_pw_entries_challenge ON public.pw_entries(challenge_id);
CREATE INDEX IF NOT EXISTS idx_pw_entries_user ON public.pw_entries(user_id);

-- Picks (3 per entry)
CREATE TABLE IF NOT EXISTS public.pw_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.pw_entries(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  position SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 3),
  start_price NUMERIC(14,4),
  end_price NUMERIC(14,4),
  latest_price NUMERIC(14,4),
  pct_change NUMERIC(8,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entry_id, position),
  UNIQUE (entry_id, ticker)
);
CREATE INDEX IF NOT EXISTS idx_pw_picks_entry ON public.pw_picks(entry_id);
CREATE INDEX IF NOT EXISTS idx_pw_picks_ticker ON public.pw_picks(ticker);

-- Price snapshots (per challenge + ticker)
CREATE TABLE IF NOT EXISTS public.pw_price_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.pw_challenges(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('start','end','latest')),
  price NUMERIC(14,4) NOT NULL,
  trading_date DATE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, ticker, kind)
);
CREATE INDEX IF NOT EXISTS idx_pw_snapshots_challenge_ticker ON public.pw_price_snapshots(challenge_id, ticker);

-- Accolades for completed weeks
CREATE TABLE IF NOT EXISTS public.pw_accolades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.pw_challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL, -- winner, best_pick, worst_pick, most_balanced, boom_or_bust, bag_holder
  ticker TEXT,
  value NUMERIC(8,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_pw_accolades_user ON public.pw_accolades(user_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_pw_challenges_updated ON public.pw_challenges;
CREATE TRIGGER trg_pw_challenges_updated BEFORE UPDATE ON public.pw_challenges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_pw_entries_updated ON public.pw_entries;
CREATE TRIGGER trg_pw_entries_updated BEFORE UPDATE ON public.pw_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.pw_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pw_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pw_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pw_price_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pw_accolades ENABLE ROW LEVEL SECURITY;

-- Challenges: anyone authenticated can read; only admins write
CREATE POLICY "pw_challenges_read_all" ON public.pw_challenges
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pw_challenges_admin_write" ON public.pw_challenges
  FOR ALL TO authenticated
  USING (public.is_app_admin(auth.uid()) OR public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_app_admin(auth.uid()) OR public.is_platform_owner(auth.uid()));

-- Snapshots: read all authenticated, admin/service writes
CREATE POLICY "pw_snapshots_read_all" ON public.pw_price_snapshots
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pw_snapshots_admin_write" ON public.pw_price_snapshots
  FOR ALL TO authenticated
  USING (public.is_app_admin(auth.uid()) OR public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_app_admin(auth.uid()) OR public.is_platform_owner(auth.uid()));

-- Accolades: read all, admin write
CREATE POLICY "pw_accolades_read_all" ON public.pw_accolades
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pw_accolades_admin_write" ON public.pw_accolades
  FOR ALL TO authenticated
  USING (public.is_app_admin(auth.uid()) OR public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_app_admin(auth.uid()) OR public.is_platform_owner(auth.uid()));

-- Entries: users see all entries (for leaderboard); insert/update only their own when challenge upcoming
CREATE POLICY "pw_entries_read_all" ON public.pw_entries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pw_entries_insert_own_when_upcoming" ON public.pw_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.pw_challenges c
      WHERE c.id = challenge_id AND c.status = 'upcoming' AND c.lock_at > now()
    )
  );

CREATE POLICY "pw_entries_update_own_when_upcoming" ON public.pw_entries
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.pw_challenges c
      WHERE c.id = challenge_id AND c.status = 'upcoming' AND c.lock_at > now()
    )
  );

CREATE POLICY "pw_entries_delete_own_when_upcoming" ON public.pw_entries
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.pw_challenges c
      WHERE c.id = challenge_id AND c.status = 'upcoming' AND c.lock_at > now()
    )
  );

CREATE POLICY "pw_entries_admin_all" ON public.pw_entries
  FOR ALL TO authenticated
  USING (public.is_app_admin(auth.uid()) OR public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_app_admin(auth.uid()) OR public.is_platform_owner(auth.uid()));

-- Picks: read all; CRUD own picks while challenge is upcoming
CREATE POLICY "pw_picks_read_all" ON public.pw_picks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pw_picks_modify_own_when_upcoming" ON public.pw_picks
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pw_entries e
      JOIN public.pw_challenges c ON c.id = e.challenge_id
      WHERE e.id = pw_picks.entry_id
        AND e.user_id = auth.uid()
        AND c.status = 'upcoming'
        AND c.lock_at > now()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pw_entries e
      JOIN public.pw_challenges c ON c.id = e.challenge_id
      WHERE e.id = pw_picks.entry_id
        AND e.user_id = auth.uid()
        AND c.status = 'upcoming'
        AND c.lock_at > now()
    )
  );

CREATE POLICY "pw_picks_admin_all" ON public.pw_picks
  FOR ALL TO authenticated
  USING (public.is_app_admin(auth.uid()) OR public.is_platform_owner(auth.uid()))
  WITH CHECK (public.is_app_admin(auth.uid()) OR public.is_platform_owner(auth.uid()));
