DROP POLICY IF EXISTS "Creator or admin can update participants" ON public.draft_participants;
CREATE POLICY "Creator or admin can update participants" ON public.draft_participants
FOR UPDATE TO authenticated
USING (
  is_app_admin(auth.uid()) OR (EXISTS (
    SELECT 1 FROM drafts WHERE drafts.id = draft_participants.draft_id AND drafts.created_by = auth.uid()
  ))
)
WITH CHECK (
  is_app_admin(auth.uid()) OR (EXISTS (
    SELECT 1 FROM drafts WHERE drafts.id = draft_participants.draft_id AND drafts.created_by = auth.uid()
  ))
);