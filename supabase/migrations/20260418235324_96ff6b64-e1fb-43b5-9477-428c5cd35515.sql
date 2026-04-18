
CREATE TABLE public.lore_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'quote',
  title TEXT NOT NULL,
  context TEXT NOT NULL,
  people_involved UUID[] DEFAULT '{}'::uuid[],
  tags TEXT[] DEFAULT '{}'::text[],
  image_url TEXT,
  era TEXT,
  status TEXT NOT NULL DEFAULT 'classic',
  source_message_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lore_entries_created_at ON public.lore_entries(created_at DESC);
CREATE INDEX idx_lore_entries_type ON public.lore_entries(type);
CREATE INDEX idx_lore_entries_status ON public.lore_entries(status);
CREATE INDEX idx_lore_entries_tags ON public.lore_entries USING GIN(tags);
CREATE INDEX idx_lore_entries_people ON public.lore_entries USING GIN(people_involved);

ALTER TABLE public.lore_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lore entries viewable by authenticated"
  ON public.lore_entries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can create lore entries"
  ON public.lore_entries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators or admins can update lore entries"
  ON public.lore_entries FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by OR public.is_app_admin(auth.uid()));

CREATE POLICY "Creators or admins can delete lore entries"
  ON public.lore_entries FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by OR public.is_app_admin(auth.uid()));

CREATE TRIGGER update_lore_entries_updated_at
  BEFORE UPDATE ON public.lore_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.lore_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lore_id UUID NOT NULL REFERENCES public.lore_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lore_id, user_id, reaction)
);

CREATE INDEX idx_lore_reactions_lore_id ON public.lore_reactions(lore_id);

ALTER TABLE public.lore_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lore reactions viewable by authenticated"
  ON public.lore_reactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can react"
  ON public.lore_reactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users or admins can remove reactions"
  ON public.lore_reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_app_admin(auth.uid()));
