

# Chat Feature Optimization Plan

## Current State

The chat system is a **927-line monolith** (`ChatPage.tsx`) with channels, threading, reactions, pinning, search, editing, and unread tracking. It works, but has several performance, UX, and code quality issues worth addressing.

## Key Issues Found

1. **`channel_read_states` table is untyped** — the table exists in the database but is missing from the generated types, forcing `(supabase as any)` casts everywhere
2. **Full message refetch on every reaction** — any reaction change triggers a complete `fetchMessages()` reload instead of updating locally
3. **No message pagination** — hardcoded `.limit(200)`, no infinite scroll for older messages
4. **Client-side-only search** — filters already-loaded messages rather than querying the database
5. **Realtime misses edits from others** — only `INSERT` and `DELETE` events are handled; if another user edits a message, it won't update
6. **No optimistic message sending** — the message doesn't appear until the database round-trip completes
7. **927-line monolith** — channel list, message view, thread panel, and all logic live in one file
8. **Mobile action UX** — the floating action bar uses `hover:` which doesn't work on mobile; the only mobile path is the reaction picker button

## Plan

### Step 1 — Fix `channel_read_states` typing
Run a no-op migration or regenerate types so `channel_read_states` appears in the Supabase types. Remove all `as any` casts related to this table.

### Step 2 — Optimistic message sending
When a user sends a message, immediately append it to the local `messages` array with a temporary ID and the user's profile. If the insert fails, remove it and show an error toast. This makes chat feel instant.

### Step 3 — Granular reaction updates
Replace the full `fetchMessages()` call on reaction events with a targeted local state update. When a reaction `INSERT`/`DELETE` event arrives, update only the affected message's reaction array in state.

### Step 4 — Handle realtime `UPDATE` events
Subscribe to `UPDATE` events on the messages table so edits from other users appear in real time without a page refresh.

### Step 5 — Infinite scroll / pagination
Load the most recent 50 messages initially. Add a "load older" trigger (scroll-to-top detection) that fetches the next batch. This improves initial load time for busy channels.

### Step 6 — Mobile long-press actions
Add a long-press gesture on messages (mobile) that opens the action menu (react, reply, pin, edit, delete) since hover-based toolbars don't work on touch devices.

### Step 7 — Component decomposition
Split `ChatPage.tsx` into focused components:
- `ChannelList.tsx` — channel sidebar/list with categories and unread badges
- `MessageList.tsx` — scrollable message feed with date separators
- `MessageBubble.tsx` — single message with reactions, actions, thread indicator
- `MessageComposer.tsx` — input + send button
- `ThreadPanel.tsx` — thread sidebar with replies
- `ChatPage.tsx` — orchestrator that wires state and routing between components

### Step 8 — Database-side search
Replace client-side `filter()` with a Supabase query using `.ilike('content', '%query%')` so search works across all messages, not just the loaded 50.

## What This Does NOT Change
- No changes to navigation, routing, or business logic
- No changes to the channel/category data model
- No visual redesign — preserves the current DH premium look
- No new database tables (except ensuring `channel_read_states` is properly typed)

## Priority Order
Steps 1-4 are high-impact, low-effort fixes. Steps 5-8 are larger improvements. I recommend implementing in the order listed.

