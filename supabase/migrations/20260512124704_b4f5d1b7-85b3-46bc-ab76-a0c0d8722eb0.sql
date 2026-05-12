SELECT cron.unschedule('lockbox-daily-reminder');
SELECT cron.unschedule('finalize-lockbox-day');

SELECT cron.schedule(
  'lockbox-daily-reminder',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url:='https://wnurxuvwljjbwmtoeqnm.supabase.co/functions/v1/lockbox-daily-reminder',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndudXJ4dXZ3bGpqYndtdG9lcW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MjYwNzIsImV4cCI6MjA4OTIwMjA3Mn0.XH-Bjn-RuCC7q2YJI-F9m4McBwE5aSZyRJcZMzI0vuc',
      'x-cron-secret','OnT01uMGTfWoFyGX_AAGB6iA0qf6pnZcR32yMX6G82kLdwJ7BQpz8kQfZAYXCcQw'
    ),
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'finalize-lockbox-day',
  '5 0 * * *',
  $$
  SELECT net.http_post(
    url:='https://wnurxuvwljjbwmtoeqnm.supabase.co/functions/v1/finalize-lockbox-day',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndudXJ4dXZ3bGpqYndtdG9lcW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MjYwNzIsImV4cCI6MjA4OTIwMjA3Mn0.XH-Bjn-RuCC7q2YJI-F9m4McBwE5aSZyRJcZMzI0vuc',
      'x-cron-secret','OnT01uMGTfWoFyGX_AAGB6iA0qf6pnZcR32yMX6G82kLdwJ7BQpz8kQfZAYXCcQw'
    ),
    body:='{}'::jsonb
  ) AS request_id;
  $$
);