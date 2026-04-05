ALTER TABLE public.draft_seasons 
ADD COLUMN commissioner_user_id uuid REFERENCES public.profiles(id);

UPDATE public.draft_seasons 
SET commissioner_user_id = '4fba7a48-825b-4690-8e3e-804c574ab960' 
WHERE id = 'c62ab880-19f3-4a36-bf60-ba6a3e6318bb';