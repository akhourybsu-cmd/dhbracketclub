CREATE POLICY "Draft creators can update participants"
ON public.draft_participants
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM drafts
  WHERE drafts.id = draft_participants.draft_id
  AND drafts.created_by = auth.uid()
));