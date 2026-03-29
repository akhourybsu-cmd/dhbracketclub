
-- ═══ CHAT SYSTEM ═══

-- Channel categories
CREATE TABLE public.channel_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.channel_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories viewable by authenticated" ON public.channel_categories FOR SELECT TO authenticated USING (true);

-- Channels
CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.channel_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  icon text DEFAULT 'hash',
  position integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Channels viewable by authenticated" ON public.channels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create channels" ON public.channels FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator can update channels" ON public.channels FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Creator can delete channels" ON public.channels FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Messages
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  content text NOT NULL,
  parent_message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  is_pinned boolean NOT NULL DEFAULT false,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Messages viewable by authenticated" ON public.messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can edit own messages" ON public.messages FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own messages" ON public.messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Message reactions
CREATE TABLE public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reactions viewable by authenticated" ON public.message_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can add reactions" ON public.message_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own reactions" ON public.message_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ═══ POSTS / DISCUSSIONS ═══

CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  title text NOT NULL,
  content text NOT NULL,
  channel_id uuid REFERENCES public.channels(id) ON DELETE SET NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  reactions_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Posts viewable by authenticated" ON public.posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create posts" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can edit own posts" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  content text NOT NULL,
  parent_comment_id uuid REFERENCES public.post_comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments viewable by authenticated" ON public.post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can add comments" ON public.post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can edit own comments" ON public.post_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.post_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ═══ EVENTS / CALENDAR ═══

CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  title text NOT NULL,
  description text,
  location text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  linked_poll_id uuid REFERENCES public.polls(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events viewable by authenticated" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create events" ON public.events FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update events" ON public.events FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Creators can delete events" ON public.events FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE TABLE public.event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'going',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "RSVPs viewable by authenticated" ON public.event_rsvps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can RSVP" ON public.event_rsvps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own RSVP" ON public.event_rsvps FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can remove own RSVP" ON public.event_rsvps FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Event comments (reuse same pattern)
CREATE TABLE public.event_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.event_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Event comments viewable by authenticated" ON public.event_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can add event comments" ON public.event_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own event comments" ON public.event_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ═══ ENABLE REALTIME ═══
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_rsvps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;

-- ═══ SEED DEFAULT CHANNELS ═══
INSERT INTO public.channel_categories (id, name, position) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'General', 0),
  ('a0000000-0000-0000-0000-000000000002', 'Interests', 1),
  ('a0000000-0000-0000-0000-000000000003', 'Planning', 2);
