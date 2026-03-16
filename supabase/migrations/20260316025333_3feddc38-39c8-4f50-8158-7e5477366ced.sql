
-- =============================================
-- PHASE TWO: Schema Extensions for Live Data
-- =============================================

-- 1. provider_configs: Registered external data providers
CREATE TABLE public.provider_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  base_url text,
  sport text NOT NULL DEFAULT 'basketball',
  tournament_scope text NOT NULL DEFAULT 'mens',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.provider_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Provider configs viewable by authenticated" ON public.provider_configs FOR SELECT TO authenticated USING (true);

-- 2. game_external_mappings: Maps internal games to provider game IDs
CREATE TABLE public.game_external_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  provider_name text NOT NULL,
  external_game_id text NOT NULL,
  external_round_name text,
  external_region text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_name, external_game_id)
);
ALTER TABLE public.game_external_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mappings viewable by authenticated" ON public.game_external_mappings FOR SELECT TO authenticated USING (true);

-- 3. sync_runs: Top-level sync operation records
CREATE TABLE public.sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name text NOT NULL,
  sync_type text NOT NULL DEFAULT 'full',
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  initiated_by_user_id uuid REFERENCES public.profiles(id),
  error_message text,
  raw_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sync runs viewable by authenticated" ON public.sync_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sync runs insertable by service" ON public.sync_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Sync runs updatable by service" ON public.sync_runs FOR UPDATE TO authenticated USING (true);

-- 4. sync_events: Granular per-entity sync events within a run
CREATE TABLE public.sync_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id uuid NOT NULL REFERENCES public.sync_runs(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sync_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sync events viewable by authenticated" ON public.sync_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sync events insertable by service" ON public.sync_events FOR INSERT TO authenticated WITH CHECK (true);

-- 5. game_state_history: Audit trail of game state changes
CREATE TABLE public.game_state_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  previous_status text,
  new_status text,
  previous_winner_team_id uuid REFERENCES public.teams(id),
  new_winner_team_id uuid REFERENCES public.teams(id),
  previous_score jsonb,
  new_score jsonb,
  changed_by_source text NOT NULL,
  sync_run_id uuid REFERENCES public.sync_runs(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.game_state_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Game history viewable by authenticated" ON public.game_state_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Game history insertable by service" ON public.game_state_history FOR INSERT TO authenticated WITH CHECK (true);

-- 6. standings_snapshots: Point-in-time standings snapshots
CREATE TABLE public.standings_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  total_points integer NOT NULL DEFAULT 0,
  correct_picks integer NOT NULL DEFAULT 0,
  possible_points_remaining integer NOT NULL DEFAULT 0,
  rank integer,
  source text NOT NULL DEFAULT 'sync',
  snapshot_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.standings_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Snapshots viewable by pool members" ON public.standings_snapshots FOR SELECT TO authenticated USING (is_pool_member(auth.uid(), pool_id));
CREATE POLICY "Snapshots insertable by service" ON public.standings_snapshots FOR INSERT TO authenticated WITH CHECK (true);

-- 7. Extend tournaments table
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS external_season_id text,
  ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- 8. Extend games table
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS source_last_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS live_clock text,
  ADD COLUMN IF NOT EXISTS live_period text,
  ADD COLUMN IF NOT EXISTS source_payload jsonb,
  ADD COLUMN IF NOT EXISTS is_result_final boolean NOT NULL DEFAULT false;

-- Enable realtime for games and standings
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.standings;

-- Add updated_at triggers for new tables
CREATE TRIGGER update_provider_configs_updated_at BEFORE UPDATE ON public.provider_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_game_external_mappings_updated_at BEFORE UPDATE ON public.game_external_mappings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
