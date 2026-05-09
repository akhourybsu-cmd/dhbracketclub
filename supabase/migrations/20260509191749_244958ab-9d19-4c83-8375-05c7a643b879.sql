-- Extend clubs table
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'invite_only',
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clubs_visibility_check'
  ) THEN
    ALTER TABLE public.clubs
      ADD CONSTRAINT clubs_visibility_check
      CHECK (visibility IN ('invite_only','private','public'));
  END IF;
END $$;

-- Helper: club manager (club admin OR app admin)
CREATE OR REPLACE FUNCTION public.is_club_manager(_user uuid, _club uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_club_admin(_user, _club) OR public.is_app_admin(_user)
$$;

-- app_feature_flags
CREATE TABLE IF NOT EXISTS public.app_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  rollout jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_feature_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feature flags readable by authenticated" ON public.app_feature_flags;
CREATE POLICY "feature flags readable by authenticated"
  ON public.app_feature_flags FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "feature flags writable by app admin" ON public.app_feature_flags;
CREATE POLICY "feature flags writable by app admin"
  ON public.app_feature_flags FOR ALL TO authenticated
  USING (public.is_app_admin(auth.uid()))
  WITH CHECK (public.is_app_admin(auth.uid()));
DROP TRIGGER IF EXISTS trg_app_feature_flags_updated ON public.app_feature_flags;
CREATE TRIGGER trg_app_feature_flags_updated
  BEFORE UPDATE ON public.app_feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  published_at timestamptz,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "announcements readable when published" ON public.announcements;
CREATE POLICY "announcements readable when published"
  ON public.announcements FOR SELECT TO authenticated
  USING (
    public.is_app_admin(auth.uid())
    OR (published_at IS NOT NULL AND published_at <= now()
        AND (expires_at IS NULL OR expires_at > now()))
  );
DROP POLICY IF EXISTS "announcements writable by app admin" ON public.announcements;
CREATE POLICY "announcements writable by app admin"
  ON public.announcements FOR ALL TO authenticated
  USING (public.is_app_admin(auth.uid()))
  WITH CHECK (public.is_app_admin(auth.uid()));
DROP TRIGGER IF EXISTS trg_announcements_updated ON public.announcements;
CREATE TRIGGER trg_announcements_updated
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- admin_notes
CREATE TABLE IF NOT EXISTS public.admin_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL CHECK (subject_type IN ('user','club','system')),
  subject_id uuid,
  body text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin notes app admin only" ON public.admin_notes;
CREATE POLICY "admin notes app admin only"
  ON public.admin_notes FOR ALL TO authenticated
  USING (public.is_app_admin(auth.uid()))
  WITH CHECK (public.is_app_admin(auth.uid()));
DROP TRIGGER IF EXISTS trg_admin_notes_updated ON public.admin_notes;
CREATE TRIGGER trg_admin_notes_updated
  BEFORE UPDATE ON public.admin_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- admin_audit_log (insert + select only for admins)
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit log readable by app admin" ON public.admin_audit_log;
CREATE POLICY "audit log readable by app admin"
  ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.is_app_admin(auth.uid()));
DROP POLICY IF EXISTS "audit log insert by app admin" ON public.admin_audit_log;
CREATE POLICY "audit log insert by app admin"
  ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notes_subject ON public.admin_notes (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_announcements_published ON public.announcements (published_at DESC);
