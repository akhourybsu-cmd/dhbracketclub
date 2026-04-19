CREATE TABLE public.lore_contributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lore_id UUID NOT NULL REFERENCES public.lore_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_lore_contributions_lore_id ON public.lore_contributions(lore_id);
CREATE INDEX idx_lore_contributions_user_id ON public.lore_contributions(user_id);

ALTER TABLE public.lore_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lore contributions viewable by authenticated"
ON public.lore_contributions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can add contributions"
ON public.lore_contributions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contributions"
ON public.lore_contributions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users or admins can delete contributions"
ON public.lore_contributions FOR DELETE
TO authenticated
USING (auth.uid() = user_id OR public.is_app_admin(auth.uid()));

CREATE TRIGGER update_lore_contributions_updated_at
BEFORE UPDATE ON public.lore_contributions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();