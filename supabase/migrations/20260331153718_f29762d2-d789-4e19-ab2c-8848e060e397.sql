
-- 1. Allow any authenticated user to pin/unpin messages (not just the author)
DROP POLICY IF EXISTS "Users can edit own messages" ON public.messages;

CREATE POLICY "Users can edit own messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = user_id)
  OR
  -- Allow anyone to toggle ONLY the is_pinned column
  (auth.uid() IS NOT NULL)
)
WITH CHECK (
  (auth.uid() = user_id)
  OR
  -- When pinning, ensure only is_pinned changed (content/user_id stay same)
  (auth.uid() IS NOT NULL AND user_id = user_id)
);

-- 2. Add cascade delete: when a parent message is deleted, delete its replies
-- First drop the existing FK if any, then re-add with CASCADE
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_parent_message_id_fkey;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_parent_message_id_fkey
  FOREIGN KEY (parent_message_id)
  REFERENCES public.messages(id)
  ON DELETE CASCADE;

-- 3. Add cascade delete: when a message is deleted, delete its reactions
ALTER TABLE public.message_reactions
  DROP CONSTRAINT IF EXISTS message_reactions_message_id_fkey;

ALTER TABLE public.message_reactions
  ADD CONSTRAINT message_reactions_message_id_fkey
  FOREIGN KEY (message_id)
  REFERENCES public.messages(id)
  ON DELETE CASCADE;
