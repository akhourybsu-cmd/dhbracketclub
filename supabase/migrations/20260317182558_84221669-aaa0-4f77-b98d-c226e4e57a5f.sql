
-- Fix: Allow any authenticated user to join a draft (not just the creator)
DROP POLICY "Draft creators can manage participants" ON public.draft_participants;

CREATE POLICY "Users can join drafts"
ON public.draft_participants
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
);

-- Also allow the draft creator to update status to in_progress
-- (already handled by drafts UPDATE policy)
