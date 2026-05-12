
-- Phase 4: Unified audit logging RPC

-- 1) Replace the permissive INSERT policy with deny-all (writes must go through RPC)
DROP POLICY IF EXISTS "audit log insert by app admin" ON public.admin_audit_log;
CREATE POLICY "Deny direct insert on admin_audit_log"
  ON public.admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- 2) SECURITY DEFINER RPC: stamps actor_id from auth.uid(), enforces admin-only,
--    truncates oversized metadata, returns the inserted row id
CREATE OR REPLACE FUNCTION public.log_admin_action(
  _action text,
  _target_type text DEFAULT NULL,
  _target_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  caller uuid := auth.uid();
  meta jsonb;
  new_id uuid;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (public.is_app_admin(caller) OR public.is_platform_owner(caller)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _action IS NULL OR length(trim(_action)) = 0 THEN
    RAISE EXCEPTION 'Action required';
  END IF;
  IF length(_action) > 128 THEN
    RAISE EXCEPTION 'Action too long';
  END IF;

  meta := COALESCE(_metadata, '{}'::jsonb);
  -- Cap metadata at ~16KB to prevent log-bloat / abuse
  IF length(meta::text) > 16384 THEN
    meta := jsonb_build_object('_truncated', true, 'preview', left(meta::text, 1024));
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, metadata)
  VALUES (caller, trim(_action), NULLIF(trim(coalesce(_target_type,'')), ''), _target_id, meta)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- 3) Lock down execute grants: only authenticated callers, anon revoked
REVOKE EXECUTE ON FUNCTION public.log_admin_action(text, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_admin_action(text, text, uuid, jsonb) TO authenticated;
