
-- Drop the duplicate DB trigger and function
DROP TRIGGER IF EXISTS trigger_notify_new_message ON public.messages;
DROP FUNCTION IF EXISTS public.notify_new_message();

-- Create push_throttle table for server-side throttling
CREATE TABLE public.push_throttle (
  user_id uuid NOT NULL,
  channel_id uuid NOT NULL,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel_id)
);

ALTER TABLE public.push_throttle ENABLE ROW LEVEL SECURITY;

-- Add mentions column to notification_preferences
ALTER TABLE public.notification_preferences ADD COLUMN IF NOT EXISTS mentions boolean NOT NULL DEFAULT true;
