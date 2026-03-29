
-- Drop the problematic BEFORE INSERT trigger
DROP TRIGGER IF EXISTS on_new_message_push_notify ON public.messages;

-- Recreate as AFTER INSERT so message inserts aren't blocked by push failures
CREATE TRIGGER on_new_message_push_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW
  WHEN (NEW.parent_message_id IS NULL)
  EXECUTE FUNCTION public.notify_new_message();
