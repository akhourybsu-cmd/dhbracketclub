-- Rune Delve currency, relics, and loadouts

-- Wallet: per-user shard balance + slot count
CREATE TABLE public.rune_delve_wallet (
  user_id UUID PRIMARY KEY,
  shards INTEGER NOT NULL DEFAULT 0,
  lifetime_shards_earned INTEGER NOT NULL DEFAULT 0,
  slots_unlocked INTEGER NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rune_delve_wallet ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own wallet"
  ON public.rune_delve_wallet FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own wallet"
  ON public.rune_delve_wallet FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own wallet"
  ON public.rune_delve_wallet FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_rune_delve_wallet_updated_at
  BEFORE UPDATE ON public.rune_delve_wallet
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Relic ownership
CREATE TABLE public.rune_delve_relic_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  relic_id TEXT NOT NULL,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acquired_at_level INTEGER NOT NULL DEFAULT 1,
  UNIQUE (user_id, relic_id)
);

CREATE INDEX idx_rune_delve_relic_unlocks_user ON public.rune_delve_relic_unlocks(user_id);

ALTER TABLE public.rune_delve_relic_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own relics"
  ON public.rune_delve_relic_unlocks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own relics"
  ON public.rune_delve_relic_unlocks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Per-class loadout (one row per user+class)
CREATE TABLE public.rune_delve_loadouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  class TEXT NOT NULL CHECK (class IN ('warrior','mage','rogue','cleric')),
  slot_1 TEXT,
  slot_2 TEXT,
  slot_3 TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, class)
);

CREATE INDEX idx_rune_delve_loadouts_user ON public.rune_delve_loadouts(user_id);

ALTER TABLE public.rune_delve_loadouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own loadouts"
  ON public.rune_delve_loadouts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own loadouts"
  ON public.rune_delve_loadouts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own loadouts"
  ON public.rune_delve_loadouts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_rune_delve_loadouts_updated_at
  BEFORE UPDATE ON public.rune_delve_loadouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Failure reward tracker (drives diminishing returns per level)
CREATE TABLE public.rune_delve_failure_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  level_number INTEGER NOT NULL,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, level_number)
);

CREATE INDEX idx_rune_delve_failure_rewards_user ON public.rune_delve_failure_rewards(user_id);

ALTER TABLE public.rune_delve_failure_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own failure rewards"
  ON public.rune_delve_failure_rewards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own failure rewards"
  ON public.rune_delve_failure_rewards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own failure rewards"
  ON public.rune_delve_failure_rewards FOR UPDATE
  USING (auth.uid() = user_id);