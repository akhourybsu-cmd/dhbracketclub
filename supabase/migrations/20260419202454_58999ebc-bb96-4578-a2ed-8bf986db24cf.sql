ALTER TABLE public.draft_playoff_matches
ADD COLUMN IF NOT EXISTS topic_picker_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;