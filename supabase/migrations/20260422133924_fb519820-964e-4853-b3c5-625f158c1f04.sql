-- 1) Open INSERT to any authenticated user (deterministic generation = safe)
DROP POLICY IF EXISTS "Admins can insert levels" ON public.rune_delve_levels;
DROP POLICY IF EXISTS "Authenticated can seed levels" ON public.rune_delve_levels;
CREATE POLICY "Authenticated can seed levels"
  ON public.rune_delve_levels
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 2) Bulk pre-seed L1–L150 (mirrors generateLevel()'s minimal shape; client hydrateLegacy overlays the rest)
INSERT INTO public.rune_delve_levels (
  level_number,
  chapter,
  difficulty_tier,
  generation_seed,
  board_size,
  turn_limit,
  objective_type,
  objective_target,
  enemy_config,
  modifiers
)
SELECT
  n AS level_number,
  GREATEST(1, CEIL(n::numeric / 50))::int AS chapter,
  CASE
    WHEN n <= 10 THEN 1
    WHEN n <= 25 THEN 2
    WHEN n <= 50 THEN 3
    WHEN n <= 100 THEN 4
    ELSE 5
  END AS difficulty_tier,
  (n * 9301 + 49297) AS generation_seed,
  5 AS board_size,
  CASE
    WHEN n <= 15 THEN 12
    WHEN n <= 30 THEN 11
    WHEN n <= 60 THEN 10
    WHEN n <= 100 THEN 9
    ELSE 8
  END AS turn_limit,
  'defeat_all' AS objective_type,
  0 AS objective_target,
  '[]'::jsonb AS enemy_config,
  '{}'::jsonb AS modifiers
FROM generate_series(1, 150) AS n
ON CONFLICT (level_number) DO NOTHING;