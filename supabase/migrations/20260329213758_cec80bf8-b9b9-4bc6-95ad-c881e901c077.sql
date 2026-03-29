CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  payload jsonb;
  supabase_url text;
  service_role_key text;
BEGIN
  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'messages',
    'record', jsonb_build_object(
      'id', NEW.id,
      'channel_id', NEW.channel_id,
      'user_id', NEW.user_id,
      'content', NEW.content,
      'parent_message_id', NEW.parent_message_id,
      'created_at', NEW.created_at
    )
  );

  SELECT decrypted_secret
  INTO supabase_url
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_URL'
  LIMIT 1;

  SELECT decrypted_secret
  INTO service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
  LIMIT 1;

  IF supabase_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING 'notify_new_message skipped: required secrets are missing';
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := payload
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'notify_new_message push call failed but message insert preserved: % (%)', SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$function$;