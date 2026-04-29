-- Nexus Defense — Cooperative Operation (async club mode)
-- ============================================================
-- One active "Operation" per club at a time. Members run a dedicated
-- Endless mission; each completed endless run can be submitted once
-- to the active Operation, contributing kills/score/boss damage toward
-- 3 escalating phase targets. All progress is shared and visible.

-- ---------- Tables ----------

CREATE TABLE public.nexus_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  flavor text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('upcoming','active','complete')),
  current_phase smallint NOT NULL DEFAULT 1 CHECK (current_phase BETWEEN 1 AND 3),
  -- Phase 1: total enemies killed
  phase1_target integer NOT NULL DEFAULT 5000 CHECK (phase1_target > 0),
  phase1_progress integer NOT NULL DEFAULT 0 CHECK (phase1_progress >= 0),
  -- Phase 2: total score
  phase2_target integer NOT NULL DEFAULT 500000 CHECK (phase2_target > 0),
  phase2_progress integer NOT NULL DEFAULT 0 CHECK (phase2_progress >= 0),
  -- Phase 3: damage to Siege Core
  phase3_target integer NOT NULL DEFAULT 1000000 CHECK (phase3_target > 0),
  phase3_progress integer NOT NULL DEFAULT 0 CHECK (phase3_progress >= 0),
  total_runs integer NOT NULL DEFAULT 0,
  total_contributors integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- At most one active operation per club (NULL club_id allowed for global single-club app).
CREATE UNIQUE INDEX nexus_ops_one_active_per_club
  ON public.nexus_operations (COALESCE(club_id::text, '__global__'))
  WHERE status = 'active';

CREATE INDEX nexus_ops_status_idx ON public.nexus_operations (status, started_at DESC);

-- Per-player rollup of contribution to an operation.
CREATE TABLE public.nexus_operation_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES public.nexus_operations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  total_kills integer NOT NULL DEFAULT 0,
  total_score integer NOT NULL DEFAULT 0,
  total_waves integer NOT NULL DEFAULT 0,
  total_boss_damage integer NOT NULL DEFAULT 0,
  runs_submitted integer NOT NULL DEFAULT 0,
  best_score integer NOT NULL DEFAULT 0,
  best_waves integer NOT NULL DEFAULT 0,
  contribution_points integer NOT NULL DEFAULT 0,
  last_contribution_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operation_id, user_id)
);

CREATE INDEX nexus_op_contrib_op_idx
  ON public.nexus_operation_contributions (operation_id, contribution_points DESC);

-- Individual endless run submissions, linked to nexus_runs to prevent
-- double-counting. One row per (operation, run) pair.
CREATE TABLE public.nexus_operation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES public.nexus_operations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  nexus_run_id uuid REFERENCES public.nexus_runs(id) ON DELETE SET NULL,
  kills integer NOT NULL DEFAULT 0 CHECK (kills >= 0),
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0),
  waves integer NOT NULL DEFAULT 0 CHECK (waves >= 0),
  boss_damage integer NOT NULL DEFAULT 0 CHECK (boss_damage >= 0),
  duration_seconds integer NOT NULL DEFAULT 0,
  contribution_points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operation_id, nexus_run_id)
);

CREATE INDEX nexus_op_runs_op_user_idx
  ON public.nexus_operation_runs (operation_id, user_id, created_at DESC);
CREATE INDEX nexus_op_runs_op_recent_idx
  ON public.nexus_operation_runs (operation_id, created_at DESC);

-- ---------- Triggers (timestamps) ----------

CREATE TRIGGER nexus_ops_updated_at
BEFORE UPDATE ON public.nexus_operations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER nexus_op_contrib_updated_at
BEFORE UPDATE ON public.nexus_operation_contributions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- RLS ----------

ALTER TABLE public.nexus_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexus_operation_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexus_operation_runs ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can read operations & shared progress (single-club app).
CREATE POLICY "operations: signed-in users can read"
  ON public.nexus_operations FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "op contrib: signed-in users can read"
  ON public.nexus_operation_contributions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "op runs: signed-in users can read"
  ON public.nexus_operation_runs FOR SELECT
  TO authenticated USING (true);

-- Only app admins can create / update / delete operations directly
-- (the contribution RPC writes with SECURITY DEFINER privileges).
CREATE POLICY "operations: admins manage"
  ON public.nexus_operations FOR ALL
  TO authenticated
  USING (public.is_app_admin(auth.uid()))
  WITH CHECK (public.is_app_admin(auth.uid()));

-- Contribution rollup & op runs are written exclusively by the
-- submit_operation_contribution RPC (SECURITY DEFINER). No direct
-- user writes.

-- ---------- RPC: submit a finished endless run to the active op ----------

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
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  op record;
  run record;
  points integer;
  new_phase smallint;
  total_phases_complete boolean := false;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Sanity-clamp inputs to defend against tampered clients.
  _kills := GREATEST(0, LEAST(_kills, 5000));
  _score := GREATEST(0, LEAST(_score, 5000000));
  _waves := GREATEST(0, LEAST(_waves, 500));
  _boss_damage := GREATEST(0, LEAST(_boss_damage, 5000000));
  _duration_seconds := GREATEST(0, LEAST(_duration_seconds, 7200));

  -- Lock operation row to prevent races on phase advancement.
  SELECT * INTO op FROM public.nexus_operations
   WHERE id = _operation_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operation not found';
  END IF;
  IF op.status <> 'active' THEN
    RAISE EXCEPTION 'Operation is not active';
  END IF;

  -- Validate the linked run belongs to caller. The run must exist and be
  -- the user's own (anti-spoof). Allow run to be null only for retries
  -- where the original was already trimmed (we still dedupe on (op,run)).
  IF _nexus_run_id IS NOT NULL THEN
    SELECT * INTO run FROM public.nexus_runs WHERE id = _nexus_run_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Run not found';
    END IF;
    IF run.user_id <> caller THEN
      RAISE EXCEPTION 'Run does not belong to caller';
    END IF;
    -- Idempotency: if this run was already submitted, return current totals.
    IF EXISTS (
      SELECT 1 FROM public.nexus_operation_runs
       WHERE operation_id = _operation_id AND nexus_run_id = _nexus_run_id
    ) THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true);
    END IF;
  END IF;

  -- Contribution score: weighted blend so all play styles matter.
  -- 1 pt per kill, 1 pt per 100 score, 25 pt per wave, 1 pt per 100 boss dmg.
  points := _kills
          + (_score / 100)
          + (_waves * 25)
          + (_boss_damage / 100);

  -- Insert run row (UNIQUE(op, run) provides idempotency lock).
  INSERT INTO public.nexus_operation_runs
    (operation_id, user_id, nexus_run_id, kills, score, waves, boss_damage,
     duration_seconds, contribution_points)
  VALUES
    (_operation_id, caller, _nexus_run_id, _kills, _score, _waves, _boss_damage,
     _duration_seconds, points);

  -- Apply progress to current phase only — keeps each phase distinct.
  IF op.current_phase = 1 THEN
    UPDATE public.nexus_operations
       SET phase1_progress = LEAST(phase1_target, phase1_progress + _kills),
           total_runs = total_runs + 1
     WHERE id = _operation_id RETURNING * INTO op;
    IF op.phase1_progress >= op.phase1_target THEN
      new_phase := 2;
    END IF;
  ELSIF op.current_phase = 2 THEN
    UPDATE public.nexus_operations
       SET phase2_progress = LEAST(phase2_target, phase2_progress + _score),
           total_runs = total_runs + 1
     WHERE id = _operation_id RETURNING * INTO op;
    IF op.phase2_progress >= op.phase2_target THEN
      new_phase := 3;
    END IF;
  ELSE
    UPDATE public.nexus_operations
       SET phase3_progress = LEAST(phase3_target, phase3_progress + _boss_damage),
           total_runs = total_runs + 1
     WHERE id = _operation_id RETURNING * INTO op;
    IF op.phase3_progress >= op.phase3_target THEN
      total_phases_complete := true;
    END IF;
  END IF;

  -- Advance phase or complete the operation atomically.
  IF total_phases_complete THEN
    UPDATE public.nexus_operations
       SET status = 'complete', completed_at = now()
     WHERE id = _operation_id RETURNING * INTO op;
  ELSIF new_phase IS NOT NULL THEN
    UPDATE public.nexus_operations
       SET current_phase = new_phase
     WHERE id = _operation_id RETURNING * INTO op;
  END IF;

  -- Upsert per-player contribution rollup.
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

  -- Refresh contributor count cheaply.
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
    'phase3_progress', op.phase3_progress
  );
END;
$$;

-- Realtime support so the progress hub can show live updates.
ALTER PUBLICATION supabase_realtime ADD TABLE public.nexus_operations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nexus_operation_contributions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nexus_operation_runs;