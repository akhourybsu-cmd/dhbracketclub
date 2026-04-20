DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lore_contributions_user_id_fkey') THEN
    ALTER TABLE public.lore_contributions ADD CONSTRAINT lore_contributions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lore_contributions_lore_id_fkey') THEN
    ALTER TABLE public.lore_contributions ADD CONSTRAINT lore_contributions_lore_id_fkey FOREIGN KEY (lore_id) REFERENCES public.lore_entries(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lore_reactions_user_id_fkey') THEN
    ALTER TABLE public.lore_reactions ADD CONSTRAINT lore_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lore_reactions_lore_id_fkey') THEN
    ALTER TABLE public.lore_reactions ADD CONSTRAINT lore_reactions_lore_id_fkey FOREIGN KEY (lore_id) REFERENCES public.lore_entries(id) ON DELETE CASCADE;
  END IF;
END $$;