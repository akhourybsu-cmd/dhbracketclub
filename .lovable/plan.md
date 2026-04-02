

## Plan: Database Indexes & Image Optimization

Two performance improvements that won't change any UI.

---

### 1. Add Database Indexes

The following high-traffic columns currently have **no index** beyond their primary key. Adding B-tree indexes will speed up every query that filters on these columns.

| Table | Column(s) | Why |
|-------|-----------|-----|
| `messages` | `channel_id` | Every chat load queries by channel |
| `messages` | `parent_message_id` | Thread lookups |
| `messages` | `channel_id, created_at DESC` | Message ordering per channel |
| `message_reactions` | `message_id` | Loading reactions per message |
| `draft_picks` | `draft_id` | Loading picks per draft |
| `poll_votes` | `poll_id` | Tallying votes |
| `activity_feed` | `created_at DESC` | Feed pagination |
| `channel_read_states` | `user_id` | Unread badge lookups |
| `event_comments` | `event_id` | Comments per event |

Single migration, no code changes needed.

### 2. Image Optimization via `loading="lazy"` and `decoding="async"`

Images in `EnrichedItemCard`, `MessageBubble` (link previews), and `ThreadPanel` already use `loading="lazy"`. Add `decoding="async"` to all enrichment/chat images so the browser decodes them off the main thread, reducing jank during scroll. This is a tiny attribute addition — zero visual change.

---

### Files Changed

| File | Change |
|------|--------|
| New migration SQL | Add 9 indexes |
| `src/components/EnrichedItemCard.tsx` | Add `decoding="async"` to img |
| `src/components/chat/MessageBubble.tsx` | Add `decoding="async"` to images |
| `src/components/chat/ThreadPanel.tsx` | Add `decoding="async"` to images |
| `src/components/chat/LinkPreviewCard.tsx` | Add `decoding="async"` to preview image |

