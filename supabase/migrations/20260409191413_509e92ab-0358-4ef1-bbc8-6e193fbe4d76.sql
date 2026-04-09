CREATE TABLE public.draft_pick_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL,
  pick_id uuid NOT NULL,
  user_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.draft_pick_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Disputes viewable by authenticated" ON public.draft_pick_disputes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create disputes" ON public.draft_pick_disputes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin can update disputes" ON public.draft_pick_disputes FOR UPDATE TO authenticated USING (is_app_admin(auth.uid()));
CREATE POLICY "Admin can delete disputes" ON public.draft_pick_disputes FOR DELETE TO authenticated USING (is_app_admin(auth.uid()));