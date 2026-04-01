
-- Fix 1: Drop the broken UPDATE policy that allows any user to edit any message
DROP POLICY "Users can edit own messages" ON public.messages;

-- Create strict owner-only UPDATE policy
CREATE POLICY "Users can update own messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create security-definer function for pinning (any authenticated user can pin/unpin)
CREATE OR REPLACE FUNCTION public.toggle_message_pin(p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.messages
  SET is_pinned = NOT is_pinned
  WHERE id = p_message_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
END;
$$;
