
-- Table to store parsed link/media metadata for messages
CREATE TABLE public.message_link_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  url text NOT NULL,
  content_type text NOT NULL DEFAULT 'link',
  title text,
  description text,
  image_url text,
  site_name text,
  embed_type text,
  embed_id text,
  fetched_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast lookup by message
CREATE INDEX idx_message_link_previews_message_id ON public.message_link_previews(message_id);

-- Index for repository browsing (newest first, by content type)
CREATE INDEX idx_message_link_previews_content_type ON public.message_link_previews(content_type, created_at DESC);

-- Enable RLS
ALTER TABLE public.message_link_previews ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view previews
CREATE POLICY "Link previews viewable by authenticated"
  ON public.message_link_previews FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert previews for their own messages
CREATE POLICY "Users can insert link previews"
  ON public.message_link_previews FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.messages
      WHERE messages.id = message_link_previews.message_id
      AND messages.user_id = auth.uid()
    )
  );

-- Cascading delete handles cleanup, but allow users to delete their own
CREATE POLICY "Users can delete own link previews"
  ON public.message_link_previews FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages
      WHERE messages.id = message_link_previews.message_id
      AND messages.user_id = auth.uid()
    )
  );
