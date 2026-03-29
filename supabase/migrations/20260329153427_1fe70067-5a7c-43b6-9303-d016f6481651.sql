-- Allow creators to delete their own rankings
CREATE POLICY "Creators can delete own rankings"
ON public.rankings
FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

-- Allow creators to delete their own drafts
CREATE POLICY "Creators can delete own drafts"
ON public.drafts
FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

-- Allow creators to delete ranking items when ranking is deleted
CREATE POLICY "Creators can delete ranking items via ranking"
ON public.ranking_items
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM rankings
  WHERE rankings.id = ranking_items.ranking_id
    AND rankings.created_by = auth.uid()
));

-- Allow creators to delete draft participants
CREATE POLICY "Creators can delete draft participants"
ON public.draft_participants
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM drafts
  WHERE drafts.id = draft_participants.draft_id
    AND drafts.created_by = auth.uid()
));

-- Allow creators to delete draft picks (cascade cleanup)
CREATE POLICY "Creators can delete draft picks"
ON public.draft_picks
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM drafts
  WHERE drafts.id = draft_picks.draft_id
    AND drafts.created_by = auth.uid()
));

-- Allow poll creators to delete poll votes (cascade cleanup)
CREATE POLICY "Poll creators can delete votes"
ON public.poll_votes
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM polls
  WHERE polls.id = poll_votes.poll_id
    AND polls.created_by = auth.uid()
));

-- Allow poll creators to delete poll options (for editing)
CREATE POLICY "Poll creators can update options"
ON public.poll_options
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM polls
  WHERE polls.id = poll_options.poll_id
    AND polls.created_by = auth.uid()
));