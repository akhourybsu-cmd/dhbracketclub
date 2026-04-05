ALTER TABLE public.draft_season_standings
ADD CONSTRAINT draft_season_standings_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;