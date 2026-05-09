
ALTER TABLE public.drafts
  ADD COLUMN IF NOT EXISTS ai_context text,
  ADD COLUMN IF NOT EXISTS ai_context_override text,
  ADD COLUMN IF NOT EXISTS ai_context_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_context_updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.drafts
  ADD CONSTRAINT drafts_ai_context_len CHECK (ai_context IS NULL OR char_length(ai_context) <= 1000),
  ADD CONSTRAINT drafts_ai_context_override_len CHECK (ai_context_override IS NULL OR char_length(ai_context_override) <= 1000);
