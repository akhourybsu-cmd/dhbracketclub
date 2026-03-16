
-- Clean up duplicate unique constraint on standings (both standings_pool_id_user_id_key and standings_pool_user_unique exist)
ALTER TABLE public.standings DROP CONSTRAINT IF EXISTS standings_pool_user_unique;

-- Clean up duplicate unique constraint on game_external_mappings
ALTER TABLE public.game_external_mappings DROP CONSTRAINT IF EXISTS game_external_mappings_provider_external_id_key;
