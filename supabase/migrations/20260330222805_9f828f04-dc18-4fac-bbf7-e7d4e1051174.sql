-- Add unique constraint to prevent duplicate locks per user per week
ALTER TABLE public.lockbox_locks ADD CONSTRAINT lockbox_locks_user_week_unique UNIQUE (user_id, week_id);