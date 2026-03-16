
-- Tighten sync_runs INSERT/UPDATE to pool admins or the initiating user
DROP POLICY "Sync runs insertable by service" ON public.sync_runs;
DROP POLICY "Sync runs updatable by service" ON public.sync_runs;

-- Sync events INSERT - only via edge functions (service role), 
-- but for RLS we restrict to users who initiated a sync
DROP POLICY "Sync events insertable by service" ON public.sync_events;

-- Game history INSERT - same pattern
DROP POLICY "Game history insertable by service" ON public.game_state_history;

-- Standings snapshots INSERT
DROP POLICY "Snapshots insertable by service" ON public.standings_snapshots;

-- For sync_runs, sync_events, game_state_history: 
-- Edge functions use service_role key which bypasses RLS entirely.
-- Authenticated users should only have SELECT access.
-- No INSERT/UPDATE/DELETE policies needed for authenticated users
-- since all writes come from service_role edge functions.
