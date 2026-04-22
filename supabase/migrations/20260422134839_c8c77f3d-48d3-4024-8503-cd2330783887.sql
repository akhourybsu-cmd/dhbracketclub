DELETE FROM public.rune_delve_levels
WHERE jsonb_array_length(COALESCE(enemy_config, '[]'::jsonb)) = 0;