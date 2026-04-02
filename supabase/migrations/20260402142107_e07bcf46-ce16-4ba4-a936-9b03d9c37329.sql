
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON public.messages (channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_parent_message_id ON public.messages (parent_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_id_created_at ON public.messages (channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON public.message_reactions (message_id);
CREATE INDEX IF NOT EXISTS idx_draft_picks_draft_id ON public.draft_picks (draft_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON public.poll_votes (poll_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_created_at ON public.activity_feed (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_channel_read_states_user_id ON public.channel_read_states (user_id);
CREATE INDEX IF NOT EXISTS idx_event_comments_event_id ON public.event_comments (event_id);
