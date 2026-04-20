-- Rune Delve mechanic-progression reset
-- Wipes generated levels and runs so future seeds carry mechanic tags in modifiers.
-- Heroes (rune_delve_heroes) are preserved.
TRUNCATE TABLE public.rune_delve_levels CASCADE;
UPDATE public.rune_delve_progress
   SET highest_unlocked_level = 1,
       highest_completed_level = 0,
       total_levels_cleared = 0,
       current_chapter = 1;