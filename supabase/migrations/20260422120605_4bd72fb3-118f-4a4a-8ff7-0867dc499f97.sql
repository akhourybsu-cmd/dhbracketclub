
-- ============================================================================
-- Rune Delve: Bestiary fix (forward) + retroactive backfill from past runs
-- ============================================================================
-- 1) Enrich legacy `rune_delve_levels.enemy_config` rows so each enemy carries
--    an `archetypeId`. Resolves common legacy names (Slime → ember_slime, etc.)
--    so the play page logs kills cleanly going forward.
-- 2) Backfill `rune_delve_bestiary` from `rune_delve_runs` history by
--    distributing each run's `enemies_defeated` across the level's enemy mix.
--    Idempotent via ON CONFLICT — safe to re-run.
-- ============================================================================

-- ── 1) Enrich legacy enemy_config rows ────────────────────────────────────
WITH name_map(legacy_name, archetype_id) AS (
  VALUES
    ('Cave Bat',       'cave_bat'),
    ('Goblin Scout',   'goblin_scout'),
    ('Slime',          'ember_slime'),
    ('Ember Slime',    'ember_slime'),
    ('Shadow Imp',     'shadow_imp'),
    ('Crystal Spider', 'crystal_spider'),
    ('Skeleton',       'skeleton_warrior'),
    ('Skeleton Warrior','skeleton_warrior'),
    ('Rune Wraith',    'rune_wraith'),
    ('Frost Revenant', 'frost_revenant'),
    ('Cult Warden',    'cult_warden'),
    ('Cult Chanter',   'cult_chanter'),
    ('Stone Golem',    'stone_golem'),
    ('Cursed Knight',  'cursed_knight'),
    ('Voidspawn',      'voidspawn'),
    ('Bone Summoner',  'bone_summoner'),
    ('Shadow Assassin','shadow_assassin'),
    ('Arcane Caster',  'arcane_caster'),
    ('Ancient Drake',  'ancient_drake'),
    ('Bone Husk',      'bone_husk')
)
UPDATE public.rune_delve_levels rdl
SET enemy_config = enriched.new_config,
    updated_at = now()
FROM (
  SELECT
    l.id,
    jsonb_agg(
      CASE
        WHEN (e.value ? 'archetypeId') AND nullif(e.value->>'archetypeId','') IS NOT NULL
          THEN e.value
        ELSE
          e.value || jsonb_build_object(
            'archetypeId',
            (
              SELECT nm.archetype_id
              FROM name_map nm
              WHERE nm.legacy_name = regexp_replace(coalesce(e.value->>'name',''), '^(Elite |Boss |Mini-Boss )', '')
              LIMIT 1
            )
          )
      END
      ORDER BY ordinality
    ) AS new_config
  FROM public.rune_delve_levels l,
       LATERAL jsonb_array_elements(l.enemy_config) WITH ORDINALITY AS e(value, ordinality)
  GROUP BY l.id
) AS enriched
WHERE rdl.id = enriched.id;

-- ── 2) Backfill bestiary from historical runs ──────────────────────────────
-- For each run we have a kill count + the level's enemy mix. We distribute
-- kills evenly across non-elite, non-boss archetypes (favouring base mooks)
-- so the bestiary roughly mirrors what the player actually fought.

WITH run_kills AS (
  SELECT
    r.user_id,
    r.level_number,
    r.enemies_defeated,
    r.completed_at,
    r.created_at,
    l.enemy_config
  FROM public.rune_delve_runs r
  JOIN public.rune_delve_levels l ON l.id = r.level_id
  WHERE r.enemies_defeated > 0
    AND l.enemy_config IS NOT NULL
    AND jsonb_array_length(l.enemy_config) > 0
),
exploded AS (
  SELECT
    rk.user_id,
    rk.level_number,
    rk.enemies_defeated,
    rk.completed_at,
    rk.created_at,
    e.value->>'archetypeId' AS archetype_id,
    e.value->>'name' AS enemy_name
  FROM run_kills rk,
       LATERAL jsonb_array_elements(rk.enemy_config) AS e(value)
  WHERE nullif(e.value->>'archetypeId', '') IS NOT NULL
    AND coalesce(e.value->>'name','') NOT LIKE 'Elite %'
    AND coalesce(e.value->>'name','') NOT LIKE 'Boss %'
),
proportioned AS (
  SELECT
    user_id,
    archetype_id,
    level_number,
    completed_at,
    created_at,
    -- Distribute the run's kill total evenly across distinct mook archetypes.
    -- Capped at enemies_defeated so a single run never inflates bestiary.
    GREATEST(1, LEAST(enemies_defeated, ceil(enemies_defeated::numeric / NULLIF(count(*) OVER (PARTITION BY user_id, level_number, completed_at), 0)))) ::int AS kill_share
  FROM exploded
),
aggregated AS (
  SELECT
    user_id,
    archetype_id,
    sum(kill_share)::int AS defeat_count,
    min(created_at) AS first_defeated_at,
    max(completed_at) AS last_defeated_at,
    max(level_number) AS highest_level_defeated
  FROM proportioned
  GROUP BY user_id, archetype_id
)
INSERT INTO public.rune_delve_bestiary
  (user_id, archetype_id, defeat_count, first_defeated_at, last_defeated_at, highest_level_defeated)
SELECT
  user_id,
  archetype_id,
  defeat_count,
  first_defeated_at,
  last_defeated_at,
  highest_level_defeated
FROM aggregated
ON CONFLICT (user_id, archetype_id) DO UPDATE
  SET defeat_count = GREATEST(public.rune_delve_bestiary.defeat_count, EXCLUDED.defeat_count),
      first_defeated_at = LEAST(public.rune_delve_bestiary.first_defeated_at, EXCLUDED.first_defeated_at),
      last_defeated_at = GREATEST(public.rune_delve_bestiary.last_defeated_at, EXCLUDED.last_defeated_at),
      highest_level_defeated = GREATEST(public.rune_delve_bestiary.highest_level_defeated, EXCLUDED.highest_level_defeated),
      updated_at = now();
