-- ============================================================
-- Nexus Defense — Co-op Balance Pass v2
-- ============================================================

-- 1) Lower the column DEFAULTS so any Operation created from now on uses
--    realistic targets for a small friend group.
ALTER TABLE public.nexus_operations
  ALTER COLUMN phase1_target SET DEFAULT 2500,    -- enemies neutralized
  ALTER COLUMN phase2_target SET DEFAULT 250000,  -- score earned
  ALTER COLUMN phase3_target SET DEFAULT 25000;   -- boss damage

-- 2) Retune the currently active Operation so it can actually be finished.
--    Only updates an active op whose progress hasn't passed the new targets.
UPDATE public.nexus_operations
   SET phase1_target = 2500,
       phase2_target = 250000,
       phase3_target = 25000
 WHERE status = 'active'
   AND phase1_progress < 2500
   AND phase2_progress < 250000
   AND phase3_progress < 25000;

-- 3) Rewrite contribution formula with anti-farming guardrails.
CREATE OR REPLACE FUNCTION public.submit_operation_contribution(
  _operation_id uuid,
  _nexus_run_id uuid,
  _kills integer,
  _score integer,
  _waves integer,
  _boss_damage integer,
  _duration_seconds integer
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  caller uuid := auth.uid();
  op record;
  run record;
  points integer;
  new_phase smallint;
  total_phases_complete boolean := false;
  prior_phase smallint;
  prior_progress integer;
  prior_target integer;
  affected_phase smallint;
  affected_amount integer;
  new_progress integer;
  -- formula vars
  k_pts numeric;
  s_pts numeric;
  w_pts numeric;
  b_pts numeric;
  -- per-run caps
  PER_RUN_POINT_CAP   constant integer := 10000;
  KILL_CAP            constant integer := 600;     -- realistic max kills per endless run
  SCORE_SOFT_CAP      constant integer := 60000;   -- diminishing returns above this
  BOSS_SOFT_CAP       constant integer := 6000;    -- ~3 bosses fully cracked
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Hard server-side clamps (sanity, anti-cheat)
  _kills           := GREATEST(0, LEAST(_kills, 50000));
  _score           := GREATEST(0, LEAST(_score, 50000000));
  _waves           := GREATEST(0, LEAST(_waves, 500));
  _boss_damage     := GREATEST(0, LEAST(_boss_damage, 50000000));
  _duration_seconds:= GREATEST(0, LEAST(_duration_seconds, 7200));

  SELECT * INTO op FROM public.nexus_operations
   WHERE id = _operation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Operation not found'; END IF;
  IF op.status <> 'active' THEN RAISE EXCEPTION 'Operation is not active'; END IF;

  IF _nexus_run_id IS NOT NULL THEN
    SELECT * INTO run FROM public.nexus_runs WHERE id = _nexus_run_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Run not found'; END IF;
    IF run.user_id <> caller THEN RAISE EXCEPTION 'Run does not belong to caller'; END IF;
    IF run.mission_id <> 100 THEN
      RAISE EXCEPTION 'Only endless runs can contribute to operations';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.nexus_operation_runs
       WHERE operation_id = _operation_id AND nexus_run_id = _nexus_run_id
    ) THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true);
    END IF;
  END IF;

  -- Anti-farming minimum-run threshold:
  --   Must reach wave 2 OR survive >=60s AND get >=5 kills.
  IF _waves < 2 AND (_duration_seconds < 60 OR _kills < 5) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Run too short to count toward the Operation. Survive longer or rack up more kills.'
    );
  END IF;

  prior_phase := op.current_phase;
  IF prior_phase = 1 THEN
    prior_progress := op.phase1_progress;
    prior_target := op.phase1_target;
    affected_amount := _kills;
  ELSIF prior_phase = 2 THEN
    prior_progress := op.phase2_progress;
    prior_target := op.phase2_target;
    affected_amount := _score;
  ELSE
    prior_progress := op.phase3_progress;
    prior_target := op.phase3_target;
    affected_amount := _boss_damage;
  END IF;
  affected_phase := prior_phase;

  -- ---- Contribution formula v2 -------------------------------------------
  -- Per-stat point pieces with soft caps & diminishing returns:
  --   * kills:    1 pt each, hard cap KILL_CAP
  --   * score:    1 pt per 100 score below soft cap; above, only 25% credit
  --   * waves:    20 pts per wave (was 25) — endurance reward, no farming edge
  --   * boss dmg: 1 pt per 50 boss damage below soft cap; above, 25% credit
  -- Then a phase-weight bonus boosts the metric the active phase needs.
  -- Final per-run point cap prevents single runs from dominating.
  k_pts := LEAST(_kills, KILL_CAP);
  IF _score <= SCORE_SOFT_CAP THEN
    s_pts := _score / 100.0;
  ELSE
    s_pts := (SCORE_SOFT_CAP / 100.0) + ((_score - SCORE_SOFT_CAP) / 400.0);
  END IF;
  w_pts := _waves * 20;
  IF _boss_damage <= BOSS_SOFT_CAP THEN
    b_pts := _boss_damage / 50.0;
  ELSE
    b_pts := (BOSS_SOFT_CAP / 50.0) + ((_boss_damage - BOSS_SOFT_CAP) / 200.0);
  END IF;

  -- Phase-aware weight: +20% bonus on the metric the current phase needs,
  -- so playstyle matters but every stat still contributes.
  IF prior_phase = 1 THEN k_pts := k_pts * 1.2;
  ELSIF prior_phase = 2 THEN s_pts := s_pts * 1.2;
  ELSE b_pts := b_pts * 1.2;
  END IF;

  points := LEAST(PER_RUN_POINT_CAP, FLOOR(k_pts + s_pts + w_pts + b_pts)::integer);

  INSERT INTO public.nexus_operation_runs
    (operation_id, user_id, nexus_run_id, kills, score, waves, boss_damage,
     duration_seconds, contribution_points)
  VALUES
    (_operation_id, caller, _nexus_run_id, _kills, _score, _waves, _boss_damage,
     _duration_seconds, points);

  IF op.current_phase = 1 THEN
    UPDATE public.nexus_operations
       SET phase1_progress = LEAST(phase1_target, phase1_progress + _kills),
           total_runs = total_runs + 1
     WHERE id = _operation_id RETURNING * INTO op;
    new_progress := op.phase1_progress;
    IF op.phase1_progress >= op.phase1_target THEN new_phase := 2; END IF;
  ELSIF op.current_phase = 2 THEN
    UPDATE public.nexus_operations
       SET phase2_progress = LEAST(phase2_target, phase2_progress + _score),
           total_runs = total_runs + 1
     WHERE id = _operation_id RETURNING * INTO op;
    new_progress := op.phase2_progress;
    IF op.phase2_progress >= op.phase2_target THEN new_phase := 3; END IF;
  ELSE
    UPDATE public.nexus_operations
       SET phase3_progress = LEAST(phase3_target, phase3_progress + _boss_damage),
           total_runs = total_runs + 1
     WHERE id = _operation_id RETURNING * INTO op;
    new_progress := op.phase3_progress;
    IF op.phase3_progress >= op.phase3_target THEN total_phases_complete := true; END IF;
  END IF;

  IF total_phases_complete THEN
    UPDATE public.nexus_operations
       SET status = 'complete', completed_at = now()
     WHERE id = _operation_id RETURNING * INTO op;
  ELSIF new_phase IS NOT NULL THEN
    UPDATE public.nexus_operations
       SET current_phase = new_phase
     WHERE id = _operation_id RETURNING * INTO op;
  END IF;

  INSERT INTO public.nexus_operation_contributions
    (operation_id, user_id, total_kills, total_score, total_waves,
     total_boss_damage, runs_submitted, best_score, best_waves,
     contribution_points, last_contribution_at)
  VALUES
    (_operation_id, caller, _kills, _score, _waves, _boss_damage, 1,
     _score, _waves, points, now())
  ON CONFLICT (operation_id, user_id) DO UPDATE
    SET total_kills        = nexus_operation_contributions.total_kills + EXCLUDED.total_kills,
        total_score        = nexus_operation_contributions.total_score + EXCLUDED.total_score,
        total_waves        = nexus_operation_contributions.total_waves + EXCLUDED.total_waves,
        total_boss_damage  = nexus_operation_contributions.total_boss_damage + EXCLUDED.total_boss_damage,
        runs_submitted     = nexus_operation_contributions.runs_submitted + 1,
        best_score         = GREATEST(nexus_operation_contributions.best_score, EXCLUDED.best_score),
        best_waves         = GREATEST(nexus_operation_contributions.best_waves, EXCLUDED.best_waves),
        contribution_points= nexus_operation_contributions.contribution_points + EXCLUDED.contribution_points,
        last_contribution_at = now();

  UPDATE public.nexus_operations
     SET total_contributors = (
       SELECT count(*) FROM public.nexus_operation_contributions
        WHERE operation_id = _operation_id
     )
   WHERE id = _operation_id RETURNING * INTO op;

  RETURN jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'points_awarded', points,
    'phase', op.current_phase,
    'status', op.status,
    'phase1_progress', op.phase1_progress,
    'phase2_progress', op.phase2_progress,
    'phase3_progress', op.phase3_progress,
    'phase1_target', op.phase1_target,
    'phase2_target', op.phase2_target,
    'phase3_target', op.phase3_target,
    'affected_phase', affected_phase,
    'affected_amount', affected_amount,
    'prior_progress', prior_progress,
    'new_progress', new_progress,
    'prior_target', prior_target,
    'phase_advanced', (new_phase IS NOT NULL),
    'operation_complete', total_phases_complete
  );
END;
$function$;