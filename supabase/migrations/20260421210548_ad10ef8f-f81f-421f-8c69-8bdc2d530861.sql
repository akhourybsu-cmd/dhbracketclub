ALTER TABLE public.rune_delve_relic_unlocks
  ADD COLUMN IF NOT EXISTS rank smallint NOT NULL DEFAULT 1;

ALTER TABLE public.rune_delve_relic_unlocks
  DROP CONSTRAINT IF EXISTS rune_delve_relic_unlocks_rank_check;

ALTER TABLE public.rune_delve_relic_unlocks
  ADD CONSTRAINT rune_delve_relic_unlocks_rank_check CHECK (rank BETWEEN 1 AND 5);