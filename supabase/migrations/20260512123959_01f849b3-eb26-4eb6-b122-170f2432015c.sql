-- Phase 7: tighten pre-existing permissive policies

-- 1. sync_runs: admins only
DROP POLICY IF EXISTS "Anyone can view sync runs" ON public.sync_runs;
DROP POLICY IF EXISTS "Authenticated can view sync runs" ON public.sync_runs;
DROP POLICY IF EXISTS "sync_runs_select_all" ON public.sync_runs;
DROP POLICY IF EXISTS "sync_runs select" ON public.sync_runs;
CREATE POLICY "sync_runs admin select"
  ON public.sync_runs FOR SELECT
  TO authenticated
  USING (public.is_app_admin(auth.uid()) OR public.is_platform_owner(auth.uid()));

-- 2. sync_events: admins only
DROP POLICY IF EXISTS "Anyone can view sync events" ON public.sync_events;
DROP POLICY IF EXISTS "Authenticated can view sync events" ON public.sync_events;
DROP POLICY IF EXISTS "sync_events_select_all" ON public.sync_events;
DROP POLICY IF EXISTS "sync_events select" ON public.sync_events;
CREATE POLICY "sync_events admin select"
  ON public.sync_events FOR SELECT
  TO authenticated
  USING (public.is_app_admin(auth.uid()) OR public.is_platform_owner(auth.uid()));

-- 3. provider_configs: admins only
DROP POLICY IF EXISTS "Anyone can view provider configs" ON public.provider_configs;
DROP POLICY IF EXISTS "Authenticated can view provider configs" ON public.provider_configs;
DROP POLICY IF EXISTS "provider_configs_select_all" ON public.provider_configs;
DROP POLICY IF EXISTS "provider_configs select" ON public.provider_configs;
CREATE POLICY "provider_configs admin select"
  ON public.provider_configs FOR SELECT
  TO authenticated
  USING (public.is_app_admin(auth.uid()) OR public.is_platform_owner(auth.uid()));

-- 4. chat-attachments-private bucket: only owner folder can read
DROP POLICY IF EXISTS "chat-attachments-private read" ON storage.objects;
DROP POLICY IF EXISTS "chat-attachments-private select" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read private chat attachments" ON storage.objects;
CREATE POLICY "chat-attachments-private owner read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-attachments-private'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5. rune_delve_dungeons: admin-only insert
DROP POLICY IF EXISTS "Authenticated can insert dungeons" ON public.rune_delve_dungeons;
DROP POLICY IF EXISTS "rune_delve_dungeons insert" ON public.rune_delve_dungeons;
DROP POLICY IF EXISTS "rune_delve_dungeons_insert_auth" ON public.rune_delve_dungeons;
CREATE POLICY "rune_delve_dungeons admin insert"
  ON public.rune_delve_dungeons FOR INSERT
  TO authenticated
  WITH CHECK (public.is_app_admin(auth.uid()) OR public.is_platform_owner(auth.uid()));

-- 6. rune_delve_levels: admin-only insert
DROP POLICY IF EXISTS "Authenticated can insert levels" ON public.rune_delve_levels;
DROP POLICY IF EXISTS "rune_delve_levels insert" ON public.rune_delve_levels;
DROP POLICY IF EXISTS "rune_delve_levels_insert_auth" ON public.rune_delve_levels;
CREATE POLICY "rune_delve_levels admin insert"
  ON public.rune_delve_levels FOR INSERT
  TO authenticated
  WITH CHECK (public.is_app_admin(auth.uid()) OR public.is_platform_owner(auth.uid()));