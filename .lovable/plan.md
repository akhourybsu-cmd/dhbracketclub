

## Maximize Notification System — Less Intrusive, More Useful

### Problems Today
1. **Double notifications** — Both a DB trigger (`notify_new_message`) AND the client-side `supabase.functions.invoke` fire on every message, potentially sending duplicate pushes.
2. **No throttling** — Every single message in an active channel sends a push. A 10-message conversation = 10 pushes per user.
3. **No suppression when online** — Users actively viewing the chat channel still get push notifications for messages they can already see.
4. **Only chat notifications exist** — Polls, events, and drafts have preference toggles but no actual push notification triggers.
5. **Notification collapsing only in service worker** — The SW collapses by tag, but the Edge Function still sends every push (wasting bandwidth/battery).

### Plan

**1. Remove the duplicate DB trigger**
Drop the `notify_new_message` trigger on the `messages` table. The client-side invoke is sufficient and gives more control. This eliminates double-push risk.

**2. Add server-side throttling per channel per user**
In the `send-push-notification` Edge Function, before sending pushes for a chat message:
- Check a `last_push_sent` map (stored in a lightweight `push_throttle` DB table: `user_id`, `channel_id`, `last_sent_at`).
- If a push was sent to the same user for the same channel within the last **60 seconds**, skip that user (unless they were @mentioned).
- Update `last_sent_at` after sending.
- This means in a fast-moving conversation, users get at most 1 push per minute per channel, but mentions always break through.

**3. Suppress notifications for active viewers**
- Pass the sender's `channel_id` in the push payload (already done).
- In the Edge Function, check `channel_read_states` — if a user's `last_read_at` for the channel is within the last 30 seconds, skip them (they're likely viewing the channel live).

**4. Wire up push notifications for polls, events, and drafts**
- Create a generic `send-notification` action type in the Edge Function that accepts `{ type: 'poll' | 'event' | 'draft', ... }`.
- Add client-side `supabase.functions.invoke` calls in:
  - `CreatePollPage.tsx` — notify when a new poll is created
  - `EventsPage.tsx` / `EventDetailPage.tsx` — notify on new events or RSVP milestones
  - `DraftDetailPage.tsx` — notify when it's a user's turn to pick
- Filter recipients using the existing `notification_preferences` columns (`polls`, `events`, `drafts`).

**5. Smarter notification content**
- For throttled/batched channel messages, update the push body to say "X new messages in #channel" instead of showing the last message.
- For @mentions, always show the actual message content with "mentioned you" prefix.

### Technical Details

**New DB table: `push_throttle`**
```sql
CREATE TABLE push_throttle (
  user_id uuid NOT NULL,
  channel_id uuid NOT NULL,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel_id)
);
-- No RLS needed — only accessed by Edge Function via service role
ALTER TABLE push_throttle ENABLE ROW LEVEL SECURITY;
```

**Migration: Drop DB trigger**
```sql
DROP TRIGGER IF EXISTS trigger_notify_new_message ON public.messages;
DROP FUNCTION IF EXISTS public.notify_new_message();
```

**Files modified:**
- `supabase/functions/send-push-notification/index.ts` — throttle logic, active-viewer suppression, multi-type support
- `src/pages/ChatPage.tsx` — no changes needed (already invokes client-side)
- `src/pages/CreatePollPage.tsx` — add push invoke on poll creation
- `src/pages/EventDetailPage.tsx` — add push invoke on event creation
- `src/pages/DraftDetailPage.tsx` — add push invoke on draft turn
- `src/components/profile/NotificationPreferences.tsx` — add "Mentions" toggle
- `src/hooks/useNotificationPreferences.ts` — add `mentions` field
- `public/sw-push.js` — no changes needed (already collapses by tag)
- 2 new migrations (drop trigger, create throttle table)

