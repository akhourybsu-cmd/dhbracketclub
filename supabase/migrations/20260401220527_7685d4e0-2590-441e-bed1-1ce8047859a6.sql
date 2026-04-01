
CREATE TABLE public.draft_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rank integer NOT NULL,
  total_score numeric NOT NULL DEFAULT 0,
  pick_ratings jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text,
  points_awarded integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_id, user_id)
);

ALTER TABLE public.draft_results ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view results
CREATE POLICY "Draft results viewable by authenticated"
  ON public.draft_results
  FOR SELECT
  TO authenticated
  USING (true);

-- Draft creator can insert results (used by edge function via service role, or creator directly)
CREATE POLICY "Draft creator can insert results"
  ON public.draft_results
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.drafts
      WHERE drafts.id = draft_results.draft_id
        AND drafts.created_by = auth.uid()
    )
  );

-- Draft creator can update results (for regeneration)
CREATE POLICY "Draft creator can update results"
  ON public.draft_results
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.drafts
      WHERE drafts.id = draft_results.draft_id
        AND drafts.created_by = auth.uid()
    )
  );

-- Draft creator can delete results (for regeneration)
CREATE POLICY "Draft creator can delete results"
  ON public.draft_results
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.drafts
      WHERE drafts.id = draft_results.draft_id
        AND drafts.created_by = auth.uid()
    )
  );

-- Index for fast lookups
CREATE INDEX idx_draft_results_draft_id ON public.draft_results(draft_id);
