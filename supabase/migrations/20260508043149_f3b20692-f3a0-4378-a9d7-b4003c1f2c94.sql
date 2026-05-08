CREATE OR REPLACE FUNCTION public.consume_ai_quota(
  _function_name text,
  _max_requests integer,
  _window_minutes integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  win_seconds bigint := GREATEST(_window_minutes, 1) * 60;
  win_start timestamptz;
  win_end timestamptz;
  new_count integer;
  cur_count integer;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'remaining', 0, 'retry_after', win_seconds, 'count', 0);
  END IF;

  win_start := to_timestamp((floor(extract(epoch FROM now()) / win_seconds) * win_seconds));
  win_end := win_start + make_interval(secs => win_seconds);

  INSERT INTO public.ai_rate_limits (user_id, function_name, window_start, count, updated_at)
  VALUES (uid, _function_name, win_start, 1, now())
  ON CONFLICT (user_id, function_name, window_start) DO UPDATE
    SET count = public.ai_rate_limits.count + 1,
        updated_at = now()
    WHERE public.ai_rate_limits.count < _max_requests
  RETURNING count INTO new_count;

  IF new_count IS NOT NULL THEN
    RETURN jsonb_build_object('allowed', true, 'remaining', GREATEST(0, _max_requests - new_count),
      'retry_after', 0, 'count', new_count);
  END IF;

  SELECT count INTO cur_count FROM public.ai_rate_limits
   WHERE user_id = uid AND function_name = _function_name AND window_start = win_start;

  RETURN jsonb_build_object('allowed', false, 'remaining', 0,
    'retry_after', GREATEST(1, ceil(extract(epoch FROM (win_end - now())))::int),
    'count', COALESCE(cur_count, _max_requests));
END;
$$;

-- Drop the old (uuid, text, int, int) variant
DROP FUNCTION IF EXISTS public.consume_ai_quota(uuid, text, integer, integer);

REVOKE ALL ON FUNCTION public.consume_ai_quota(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(text, integer, integer) TO authenticated;