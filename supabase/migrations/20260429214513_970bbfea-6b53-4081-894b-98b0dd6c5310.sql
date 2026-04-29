
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.nexus_sigil_rarity AS ENUM ('common','rare','epic','legendary');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.nexus_ledger_reason AS ENUM (
    'endless_milestone','operation_reward','operation_mvp','boost_purchase','admin_grant','admin_debit'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ SIGILS CATALOG ============
CREATE TABLE IF NOT EXISTS public.nexus_sigils (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  rarity public.nexus_sigil_rarity NOT NULL DEFAULT 'common',
  icon text NOT NULL DEFAULT 'shield',
  glow_color text NOT NULL DEFAULT '#10b981',
  source text NOT NULL DEFAULT 'endless',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nexus_sigils ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can read sigils catalog"
  ON public.nexus_sigils FOR SELECT TO authenticated USING (true);

-- ============ USER SIGIL OWNERSHIP ============
CREATE TABLE IF NOT EXISTS public.nexus_user_sigils (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sigil_id uuid NOT NULL REFERENCES public.nexus_sigils(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  is_displayed boolean NOT NULL DEFAULT false,
  source_ref text,
  UNIQUE (user_id, sigil_id)
);
CREATE INDEX IF NOT EXISTS idx_nexus_user_sigils_user ON public.nexus_user_sigils(user_id);
CREATE INDEX IF NOT EXISTS idx_nexus_user_sigils_displayed ON public.nexus_user_sigils(user_id) WHERE is_displayed;
ALTER TABLE public.nexus_user_sigils ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can read user sigils"
  ON public.nexus_user_sigils FOR SELECT TO authenticated USING (true);

-- ============ SALVAGE WALLET ============
CREATE TABLE IF NOT EXISTS public.nexus_salvage_wallet (
  user_id uuid PRIMARY KEY,
  balance integer NOT NULL DEFAULT 0,
  lifetime_earned integer NOT NULL DEFAULT 0,
  lifetime_spent integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nexus_salvage_wallet ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players can read their own wallet"
  ON public.nexus_salvage_wallet FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ SALVAGE LEDGER ============
CREATE TABLE IF NOT EXISTS public.nexus_salvage_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  delta integer NOT NULL,
  reason public.nexus_ledger_reason NOT NULL,
  ref_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nexus_salvage_ledger_user ON public.nexus_salvage_ledger(user_id, created_at DESC);
ALTER TABLE public.nexus_salvage_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players can read their own ledger"
  ON public.nexus_salvage_ledger FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ BOOSTS CATALOG ============
CREATE TABLE IF NOT EXISTS public.nexus_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  cost_tokens integer NOT NULL DEFAULT 25,
  icon text NOT NULL DEFAULT 'zap',
  effect_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nexus_boosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can read boosts catalog"
  ON public.nexus_boosts FOR SELECT TO authenticated USING (is_active = true);

-- ============ USER BOOST LOADOUT (pending) ============
CREATE TABLE IF NOT EXISTS public.nexus_user_boosts (
  user_id uuid PRIMARY KEY,
  boost_id uuid NOT NULL REFERENCES public.nexus_boosts(id) ON DELETE CASCADE,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  consumed_run_id uuid
);
ALTER TABLE public.nexus_user_boosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players can read their own boost"
  ON public.nexus_user_boosts FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ SEED: SIGILS ============
INSERT INTO public.nexus_sigils (code, name, description, rarity, icon, glow_color, source) VALUES
  ('endless_wave_10','Bronze Vanguard','Reach Wave 10 in Endless mode.','common','shield','#a16207','endless'),
  ('endless_wave_20','Silver Sentinel','Reach Wave 20 in Endless mode.','rare','shield-check','#94a3b8','endless'),
  ('endless_wave_30','Gold Bulwark','Reach Wave 30 in Endless mode.','epic','shield-plus','#f59e0b','endless'),
  ('op_participant','Operative','Contribute to a completed Operation.','common','star','#10b981','operation'),
  ('op_high_contributor','Tactician','Top-3 contributor on a completed Operation.','rare','target','#06b6d4','operation'),
  ('op_top_contributor','Strategist','#1 contributor on a completed Operation.','epic','crosshair','#8b5cf6','operation'),
  ('op_mvp_legendary','Siege Core','Crowned MVP of a completed Operation.','legendary','crown','#f59e0b','operation')
ON CONFLICT (code) DO NOTHING;

-- ============ SEED: BOOSTS ============
INSERT INTO public.nexus_boosts (code, name, description, cost_tokens, icon, effect_config) VALUES
  ('overcharge_coil','Overcharge Coil','+15% tower damage, but builds cost 20% more.',30,'zap',
    '{"towerDamageMult":1.15,"buildCostMult":1.20}'::jsonb),
  ('reinforced_plating','Reinforced Plating','+25% Nexus core HP for the run.',25,'shield',
    '{"hpMult":1.25}'::jsonb),
  ('energy_surge','Energy Surge','+20% energy regen for the entire run.',25,'battery-charging',
    '{"energyRegenMult":1.20}'::jsonb),
  ('salvage_magnet','Salvage Magnet','Earn +25% Salvage Tokens from this run.',20,'magnet',
    '{"salvageMult":1.25}'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- ============ FUNCTION: ensure wallet ============
CREATE OR REPLACE FUNCTION public._ensure_salvage_wallet(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.nexus_salvage_wallet (user_id) VALUES (_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- ============ FUNCTION: credit / debit wallet ============
CREATE OR REPLACE FUNCTION public._credit_salvage(
  _user_id uuid, _amount integer, _reason public.nexus_ledger_reason, _ref uuid, _note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _amount = 0 THEN RETURN; END IF;
  PERFORM public._ensure_salvage_wallet(_user_id);
  IF _amount > 0 THEN
    UPDATE public.nexus_salvage_wallet
       SET balance = balance + _amount,
           lifetime_earned = lifetime_earned + _amount,
           updated_at = now()
     WHERE user_id = _user_id;
  ELSE
    UPDATE public.nexus_salvage_wallet
       SET balance = GREATEST(0, balance + _amount),
           lifetime_spent = lifetime_spent + ABS(_amount),
           updated_at = now()
     WHERE user_id = _user_id;
  END IF;
  INSERT INTO public.nexus_salvage_ledger (user_id, delta, reason, ref_id, note)
  VALUES (_user_id, _amount, _reason, _ref, _note);
END;
$$;

-- ============ FUNCTION: grant sigil ============
CREATE OR REPLACE FUNCTION public._grant_sigil(_user_id uuid, _code text, _ref text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sid uuid;
  inserted boolean := false;
BEGIN
  SELECT id INTO sid FROM public.nexus_sigils WHERE code = _code;
  IF sid IS NULL THEN RETURN false; END IF;
  INSERT INTO public.nexus_user_sigils (user_id, sigil_id, source_ref)
  VALUES (_user_id, sid, _ref)
  ON CONFLICT (user_id, sigil_id) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;

-- ============ RPC: set_displayed_sigil ============
CREATE OR REPLACE FUNCTION public.set_displayed_sigil(_sigil_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  sid uuid;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  UPDATE public.nexus_user_sigils SET is_displayed = false WHERE user_id = caller;

  IF _sigil_code IS NULL OR _sigil_code = '' THEN
    RETURN;
  END IF;

  SELECT id INTO sid FROM public.nexus_sigils WHERE code = _sigil_code;
  IF sid IS NULL THEN RAISE EXCEPTION 'Unknown sigil'; END IF;

  UPDATE public.nexus_user_sigils
     SET is_displayed = true
   WHERE user_id = caller AND sigil_id = sid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You do not own that sigil';
  END IF;
END;
$$;

-- ============ RPC: purchase_boost ============
CREATE OR REPLACE FUNCTION public.purchase_boost(_boost_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  b record;
  bal integer;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO b FROM public.nexus_boosts WHERE code = _boost_code AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Boost not found'; END IF;

  PERFORM public._ensure_salvage_wallet(caller);
  SELECT balance INTO bal FROM public.nexus_salvage_wallet WHERE user_id = caller;
  IF bal < b.cost_tokens THEN
    RAISE EXCEPTION 'Insufficient salvage tokens';
  END IF;

  -- Replace any pending boost (refund unconsumed prior boost? policy: no refund, it overwrites)
  PERFORM public._credit_salvage(caller, -b.cost_tokens, 'boost_purchase', b.id, b.code);

  INSERT INTO public.nexus_user_boosts (user_id, boost_id)
  VALUES (caller, b.id)
  ON CONFLICT (user_id) DO UPDATE
    SET boost_id = EXCLUDED.boost_id,
        purchased_at = now(),
        consumed_at = NULL,
        consumed_run_id = NULL;

  RETURN jsonb_build_object('ok', true, 'boost_code', b.code, 'spent', b.cost_tokens);
END;
$$;

-- ============ RPC: consume_boost ============
CREATE OR REPLACE FUNCTION public.consume_boost(_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  pending record;
  cfg jsonb;
  code text;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT ub.*, b.code AS boost_code, b.effect_config
    INTO pending
    FROM public.nexus_user_boosts ub
    JOIN public.nexus_boosts b ON b.id = ub.boost_id
   WHERE ub.user_id = caller AND ub.consumed_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'boost_code', NULL, 'effect_config', '{}'::jsonb);
  END IF;

  UPDATE public.nexus_user_boosts
     SET consumed_at = now(), consumed_run_id = _run_id
   WHERE user_id = caller;

  RETURN jsonb_build_object('ok', true, 'boost_code', pending.boost_code, 'effect_config', pending.effect_config);
END;
$$;

-- ============ RPC: get_boost_for_run ============
CREATE OR REPLACE FUNCTION public.get_boost_for_run()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  pending record;
BEGIN
  IF caller IS NULL THEN RETURN NULL; END IF;
  SELECT b.code, b.name, b.icon, b.effect_config
    INTO pending
    FROM public.nexus_user_boosts ub
    JOIN public.nexus_boosts b ON b.id = ub.boost_id
   WHERE ub.user_id = caller AND ub.consumed_at IS NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'code', pending.code,
    'name', pending.name,
    'icon', pending.icon,
    'effect_config', pending.effect_config
  );
END;
$$;

-- ============ RPC: award_endless_rewards ============
CREATE OR REPLACE FUNCTION public.award_endless_rewards(_run_id uuid, _wave_reached integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  awarded jsonb := '[]'::jsonb;
  tokens_total integer := 0;
  tokens_step integer;
  granted boolean;
  salvage_mult numeric := 1.0;
  boost_cfg jsonb;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _wave_reached IS NULL OR _wave_reached < 1 THEN
    RETURN jsonb_build_object('sigils', awarded, 'tokens', 0);
  END IF;

  -- Apply salvage_magnet boost multiplier if it was the consumed boost for this run
  SELECT b.effect_config INTO boost_cfg
    FROM public.nexus_user_boosts ub
    JOIN public.nexus_boosts b ON b.id = ub.boost_id
   WHERE ub.user_id = caller AND ub.consumed_run_id = _run_id;
  IF boost_cfg IS NOT NULL AND (boost_cfg ? 'salvageMult') THEN
    salvage_mult := COALESCE((boost_cfg->>'salvageMult')::numeric, 1.0);
  END IF;

  IF _wave_reached >= 10 THEN
    granted := public._grant_sigil(caller, 'endless_wave_10', _run_id::text);
    tokens_step := FLOOR(10 * salvage_mult);
    IF granted THEN
      awarded := awarded || jsonb_build_object('code','endless_wave_10','first_time',true);
    END IF;
    tokens_total := tokens_total + tokens_step;
  END IF;
  IF _wave_reached >= 20 THEN
    granted := public._grant_sigil(caller, 'endless_wave_20', _run_id::text);
    tokens_step := FLOOR(20 * salvage_mult);
    IF granted THEN
      awarded := awarded || jsonb_build_object('code','endless_wave_20','first_time',true);
    END IF;
    tokens_total := tokens_total + tokens_step;
  END IF;
  IF _wave_reached >= 30 THEN
    granted := public._grant_sigil(caller, 'endless_wave_30', _run_id::text);
    tokens_step := FLOOR(40 * salvage_mult);
    IF granted THEN
      awarded := awarded || jsonb_build_object('code','endless_wave_30','first_time',true);
    END IF;
    tokens_total := tokens_total + tokens_step;
  END IF;

  IF tokens_total > 0 THEN
    PERFORM public._credit_salvage(caller, tokens_total, 'endless_milestone', _run_id, 'wave_'||_wave_reached);
  END IF;

  RETURN jsonb_build_object('sigils', awarded, 'tokens', tokens_total, 'salvage_mult', salvage_mult);
END;
$$;

-- ============ RPC: award_operation_rewards ============
CREATE OR REPLACE FUNCTION public.award_operation_rewards(_operation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

    PERFORM public._credit_salvage(contributor.user_id, base_tokens, 'operation_reward', _operation_id, op.title);
    awarded_count := awarded_count + 1;
  END LOOP;

  -- Mark distributed (idempotent flag)
  ALTER TABLE public.nexus_operations
    ADD COLUMN IF NOT EXISTS rewards_distributed_at timestamptz;
  UPDATE public.nexus_operations
     SET rewards_distributed_at = now()
   WHERE id = _operation_id;

  RETURN jsonb_build_object(
    'ok', true,
    'mvp_user_id', mvp_user,
    'contributors_rewarded', awarded_count
  );
END;
$$;

-- Add the column outside the function too so future calls are clean
ALTER TABLE public.nexus_operations
  ADD COLUMN IF NOT EXISTS rewards_distributed_at timestamptz;
