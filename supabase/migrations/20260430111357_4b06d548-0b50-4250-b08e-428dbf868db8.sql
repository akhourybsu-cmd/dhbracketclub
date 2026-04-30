-- ============================================================
-- Nexus Defense — Endless / Co-op tracking fixes
-- ============================================================

-- 1) Persist kills on the per-run record so telemetry & contribution
--    submissions have a real number to work with.
ALTER TABLE public.nexus_runs
  ADD COLUMN IF NOT EXISTS kills integer NOT NULL DEFAULT 0;

-- 2) Repair award_operation_rewards.
--    Previously it referenced op.title (column does not exist) and tried to
--    ALTER TABLE inside a SECURITY DEFINER function. Both removed.
CREATE OR REPLACE FUNCTION public.award_operation_rewards(_operation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  op record;
  caller uuid := auth.uid();
  contributor record;
  rank_n integer;
  total_contributors integer;
  base_tokens integer;
  mvp_user uuid;
  mvp_points integer;
  awarded_count integer := 0;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO op FROM public.nexus_operations WHERE id = _operation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Operation not found'; END IF;
  IF op.status <> 'complete' THEN
    RAISE EXCEPTION 'Operation is not complete';
  END IF;
  IF op.rewards_distributed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_distributed', true);
  END IF;

  -- Restrict trigger: caller must be a contributor or admin
  IF NOT (
    EXISTS (SELECT 1 FROM public.nexus_operation_contributions
             WHERE operation_id = _operation_id AND user_id = caller)
    OR public.is_app_admin(caller)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT count(*) INTO total_contributors
    FROM public.nexus_operation_contributions WHERE operation_id = _operation_id;

  -- MVP = highest contribution_points
  SELECT user_id, contribution_points INTO mvp_user, mvp_points
    FROM public.nexus_operation_contributions
   WHERE operation_id = _operation_id
   ORDER BY contribution_points DESC, last_contribution_at ASC
   LIMIT 1;

  rank_n := 0;
  FOR contributor IN
    SELECT user_id, contribution_points
      FROM public.nexus_operation_contributions
     WHERE operation_id = _operation_id
     ORDER BY contribution_points DESC, last_contribution_at ASC
  LOOP
    rank_n := rank_n + 1;
    base_tokens := 30; -- participation
    PERFORM public._grant_sigil(contributor.user_id, 'op_participant', _operation_id::text);

    IF rank_n = 1 THEN
      PERFORM public._grant_sigil(contributor.user_id, 'op_top_contributor', _operation_id::text);
      base_tokens := base_tokens + 50;
    ELSIF rank_n <= 3 THEN
      PERFORM public._grant_sigil(contributor.user_id, 'op_high_contributor', _operation_id::text);
      base_tokens := base_tokens + 25;
    END IF;

    IF contributor.user_id = mvp_user THEN
      PERFORM public._grant_sigil(contributor.user_id, 'op_mvp_legendary', _operation_id::text);
      base_tokens := base_tokens + 50;
    END IF;

    -- Use op.name (real column) — was previously op.title which does not exist.
    PERFORM public._credit_salvage(contributor.user_id, base_tokens, 'operation_reward', _operation_id, op.name);
    awarded_count := awarded_count + 1;
  END LOOP;

  -- Mark distributed (idempotent flag).  Column already exists in schema —
  -- no inline DDL needed here.
  UPDATE public.nexus_operations
     SET rewards_distributed_at = now()
   WHERE id = _operation_id;

  RETURN jsonb_build_object(
    'ok', true,
    'mvp_user_id', mvp_user,
    'contributors_rewarded', awarded_count
  );
END;
$function$;