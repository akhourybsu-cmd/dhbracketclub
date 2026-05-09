-- Onboarding rebuild: extend club_requests with needs_info/cancelled, single-active-request guarantee, and SECURITY DEFINER RPCs.

ALTER TABLE public.club_requests
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS user_note text;

-- Drop old check, allow expanded statuses
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.club_requests'::regclass AND contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.club_requests DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.club_requests
  ADD CONSTRAINT club_requests_status_chk
  CHECK (status IN ('pending','needs_info','approved','rejected','cancelled'));

-- One active request per user (pending or needs_info)
CREATE UNIQUE INDEX IF NOT EXISTS club_requests_one_active_per_user
  ON public.club_requests (requested_by)
  WHERE status IN ('pending','needs_info');

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_club_requests_updated_at ON public.club_requests;
CREATE TRIGGER trg_club_requests_updated_at
BEFORE UPDATE ON public.club_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Single entry-point RPC: create or update the caller's active/rejected request.
CREATE OR REPLACE FUNCTION public.upsert_club_request(
  _proposed_name text,
  _reason text,
  _user_note text
) RETURNS public.club_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  existing public.club_requests;
  result public.club_requests;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _proposed_name IS NULL OR length(trim(_proposed_name)) = 0 THEN
    RAISE EXCEPTION 'Club name required';
  END IF;

  -- Find a row to update: active (pending/needs_info) OR most recent rejected
  SELECT * INTO existing FROM public.club_requests
   WHERE requested_by = uid
     AND status IN ('pending','needs_info','rejected')
   ORDER BY (status = 'rejected') ASC, created_at DESC
   LIMIT 1;

  IF existing.id IS NOT NULL THEN
    UPDATE public.club_requests
       SET proposed_name = trim(_proposed_name),
           reason = NULLIF(trim(coalesce(_reason,'')), ''),
           user_note = NULLIF(trim(coalesce(_user_note,'')), ''),
           status = 'pending',
           review_notes = CASE WHEN existing.status = 'rejected' THEN NULL ELSE review_notes END,
           reviewed_by = CASE WHEN existing.status = 'rejected' THEN NULL ELSE reviewed_by END,
           reviewed_at = CASE WHEN existing.status = 'rejected' THEN NULL ELSE reviewed_at END
     WHERE id = existing.id
     RETURNING * INTO result;
  ELSE
    INSERT INTO public.club_requests (requested_by, proposed_name, reason, user_note, status)
    VALUES (uid, trim(_proposed_name),
            NULLIF(trim(coalesce(_reason,'')), ''),
            NULLIF(trim(coalesce(_user_note,'')), ''),
            'pending')
    RETURNING * INTO result;
  END IF;

  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_club_request()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.club_requests
     SET status = 'cancelled'
   WHERE requested_by = uid
     AND status IN ('pending','needs_info');
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_request_needs_info(
  _request_id uuid,
  _admin_note text
) RETURNS public.club_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  result public.club_requests;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.is_platform_owner(uid) OR public.is_app_admin(uid)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.club_requests
     SET status = 'needs_info',
         review_notes = NULLIF(trim(coalesce(_admin_note,'')), ''),
         reviewed_by = uid,
         reviewed_at = now()
   WHERE id = _request_id
   RETURNING * INTO result;
  IF result.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  RETURN result;
END $$;

GRANT EXECUTE ON FUNCTION public.upsert_club_request(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_club_request() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_request_needs_info(uuid,text) TO authenticated;