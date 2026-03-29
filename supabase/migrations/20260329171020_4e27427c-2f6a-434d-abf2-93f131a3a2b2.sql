CREATE TABLE public.invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read codes (needed for validation during sign-up before auth)
CREATE POLICY "Anyone can validate invite codes"
  ON public.invite_codes FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only authenticated users can update (mark as used)
CREATE POLICY "Authenticated users can claim codes"
  ON public.invite_codes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed a few invite codes for the group
INSERT INTO public.invite_codes (code) VALUES
  ('DH-2026'),
  ('DRYHORSE'),
  ('DH-CLUB-VIP');
