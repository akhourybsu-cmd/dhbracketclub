
-- Drop the trigger that was silently failing
DROP TRIGGER IF EXISTS on_new_message_push_notify ON public.messages;

-- Add UPDATE policy on push_subscriptions for upsert to work
CREATE POLICY "Users can update own subscriptions"
  ON public.push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);
