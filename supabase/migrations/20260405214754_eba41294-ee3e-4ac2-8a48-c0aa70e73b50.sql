-- Add regular_season_drafts column to draft_seasons
ALTER TABLE public.draft_seasons
ADD COLUMN IF NOT EXISTS regular_season_drafts integer NOT NULL DEFAULT 12;

-- Update existing season to use 12 drafts and best-of-10
UPDATE public.draft_seasons
SET regular_season_drafts = 12, best_of = 10
WHERE id = 'c62ab880-19f3-4a36-bf60-ba6a3e6318bb';