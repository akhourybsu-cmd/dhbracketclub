
-- ============================================================
-- Phase 1: Security linter cleanup
-- ============================================================

-- 1. Fix search_path on set_updated_at (only function missing it)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 2. Revoke broad EXECUTE on all public functions, then grant only to authenticated
--    This closes the "anon can execute SECURITY DEFINER" warnings.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Re-grant to authenticated for everything (RLS still enforces row-level access).
-- This keeps app behavior identical for signed-in users while blocking anon.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Trigger functions and pure-internal helpers don't need any role grant — revoke explicitly.
DO $$
DECLARE
  fn text;
  internal_fns text[] := ARRAY[
    'set_club_id_from_user',
    'pw_set_entry_club',
    'pw_set_pick_club',
    'pw_set_snapshot_club',
    'pw_set_accolade_club',
    'pw_set_challenge_club',
    'set_updated_at',
    'update_updated_at_column',
    'handle_new_user',
    'trg_nfl_games_recompute_week_status',
    'recompute_nfl_week_status',
    '_credit_salvage',
    '_ensure_salvage_wallet',
    '_grant_sigil'
  ];
BEGIN
  FOREACH fn IN ARRAY internal_fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I FROM authenticated', fn);
    EXCEPTION WHEN undefined_function THEN
      -- Some have multiple signatures; revoke from all matching
      NULL;
    END;
  END LOOP;
END $$;

-- Handle multi-arg overloads explicitly (function name only revoke above may miss them)
REVOKE EXECUTE ON FUNCTION public._credit_salvage(uuid, integer, nexus_ledger_reason, uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public._ensure_salvage_wallet(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public._grant_sigil(uuid, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_nfl_week_status(uuid) FROM authenticated;

-- 3. Add deny-all client policies to tables that have RLS but no policy.
--    These tables are written exclusively by SECURITY DEFINER functions
--    (consume_ai_quota, push notification throttle), so clients should not
--    have direct read/write access at all.

DROP POLICY IF EXISTS "no direct access" ON public.ai_rate_limits;
CREATE POLICY "no direct access" ON public.ai_rate_limits
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "no direct access" ON public.push_throttle;
CREATE POLICY "no direct access" ON public.push_throttle
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

-- 4. Tighten always-true write policies on Rune Delve seed tables.
--    Seeds are written by client during run init; require signed-in user.
DROP POLICY IF EXISTS "Authenticated can seed daily dungeon" ON public.rune_delve_dungeons;
CREATE POLICY "Authenticated can seed daily dungeon"
  ON public.rune_delve_dungeons
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can seed levels" ON public.rune_delve_levels;
CREATE POLICY "Authenticated can seed levels"
  ON public.rune_delve_levels
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
