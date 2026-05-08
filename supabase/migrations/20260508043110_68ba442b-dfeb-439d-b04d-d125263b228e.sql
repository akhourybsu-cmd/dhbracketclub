-- ai_rate_limits: lightweight per-user, per-function, per-window counter
CREATE TABLE public.ai_rate_limits (
  user_id uuid NOT NULL,
  function_name text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, function_name, window_start)
);

CREATE INDEX idx_ai_rate_limits_window ON public.ai_rate_limits (window_start);

ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;

-- No client policies: only SECURITY DEFINER RPC may read/write.
-- (Service role bypasses RLS for cleanup.)

-- Atomic consume RPC. Buckets are aligned to fixed windows of `window_minutes`
-- (epoch-anchored), so all callers within the same window contend on the same row.
CREATE OR REPLACE FUNCTION public.consume_ai_quota(
  _user_id uuid,
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
  win_seconds bigint := GREATEST(_window_minutes, 1) * 60;
  win_start timestamptz;
  win_end timestamptz;
  new_count integer;
  cur_count integer;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'remaining', 0, 'retry_after', win_seconds, 'count', 0);
  END IF;

  -- Align to a fixed bucket starting at epoch
  win_start := to_timestamp((floor(extract(epoch FROM now()) / win_seconds) * win_seconds));
  win_end := win_start + make_interval(secs => win_seconds);

  -- Atomic insert-or-increment-only-if-below-limit
  INSERT INTO public.ai_rate_limits (user_id, function_name, window_start, count, updated_at)
  VALUES (_user_id, _function_name, win_start, 1, now())
  ON CONFLICT (user_id, function_name, window_start) DO UPDATE
    SET count = public.ai_rate_limits.count + 1,
        updated_at = now()
    WHERE public.ai_rate_limits.count < _max_requests
  RETURNING count INTO new_count;

  IF new_count IS NOT NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', GREATEST(0, _max_requests - new_count),
      'retry_after', 0,
      'count', new_count
    );
  END IF;

  -- Limit reached — fetch current count for response
  SELECT count INTO cur_count
    FROM public.ai_rate_limits
   WHERE user_id = _user_id AND function_name = _function_name AND window_start = win_start;

  RETURN jsonb_build_object(
    'allowed', false,
    'remaining', 0,
    'retry_after', GREATEST(1, ceil(extract(epoch FROM (win_end - now())))::int),
    'count', COALESCE(cur_count, _max_requests)
  );
END;
$$;

-- Allow authenticated users to call the RPC (it self-gates by _user_id parameter,
-- but edge functions invoke it via service role anyway).
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(uuid, text, integer, integer) TO authenticated, service_role;