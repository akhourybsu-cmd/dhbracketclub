# Chat System Audit & Channel Management Upgrade

## Issues Found

### 1. Cross-channel message bleed

When switching channels, the old channel's messages remain visible until the new fetch completes. The `selectChannel` function resets thread/search/edit state but does **not** clear `messages`. This means for a brief moment (or longer on slow connections), users see messages from the previous channel. The realtime subscription also has a transition window where late-arriving events from the old channel could insert into the new view.

### 2. Limited channel editing

Currently channels only support **rename** and **drag-to-reorder**. There is no way to edit description, change category, set an icon/emoji, delete a channel, or manage any channel-level settings.

### 3. No channel settings/management UI

There is no settings panel or detail view for channels. Users cannot configure notifications per-channel, view member activity, clear history, archive, or perform other management tasks.

---

## Plan

### Step 1: Fix cross-channel message contamination

- In `selectChannel`, immediately call `setMessages([])` to clear the message list before the new fetch begins
- This ensures zero frames of stale content from another channel
- Also reset `hasMore` state to prevent stale "load more" triggers

### Step 2: Build a Channel Settings dialog

Create a new `ChannelSettingsDialog` component (`src/components/chat/ChannelSettingsDialog.tsx`) that opens from a gear/settings icon in both the channel list row and the message view header. It will contain:

**Edit tab:**

- Channel name (text input)
- Description (textarea)
- Emoji/icon picker (grid of common emojis to choose from)
- Category assignment (dropdown of existing categories)
- Default channel toggle (checkbox)

**Danger zone:**

- Delete channel (with confirmation dialog, cascades messages/reactions/read states)

### Step 3: Add channel header actions

In the message view header bar (the sticky bar showing channel name), add:

- A settings gear icon that opens the Channel Settings dialog
- Move the existing pin and search icons into a cleaner grouped layout

### Step 4: Update ChannelList with settings access

- Replace the pencil-only edit button with a more/settings icon that opens the full Channel Settings dialog
- Keep drag-to-reorder as-is

### Step 5: Wire up backend operations

New handler functions in `ChatPage.tsx`:

- `handleUpdateChannel(channelId, updates)` — updates name, description, icon, category_id, is_default
- `handleDeleteChannel(channelId)` — deletes channel and cascade-removes messages; navigates to default channel
- Update the `CHANNEL_EMOJI` lookup to check `channel.icon` field first, falling back to the hardcoded map

### Step 6: Category management

- Add ability to create/rename/delete categories from within the channel settings or channel list header
- Simple inline UI similar to existing channel creation

---

## Technical Details

**Files to create:**

- `src/components/chat/ChannelSettingsDialog.tsx` — full settings dialog with edit fields and delete action

**Files to modify:**

- `src/pages/ChatPage.tsx` — clear messages on channel switch; add update/delete handlers; pass settings props
- `src/components/chat/ChannelList.tsx` — replace pencil icon with settings trigger; support category management
- `src/components/chat/types.ts` — no schema changes needed (channels table already has description, icon, category_id fields)

**No database migration needed** — the `channels` table already has `name`, `description`, `icon`, `category_id`, `is_default`, and `position` columns. Deletion will cascade via existing foreign key relationships on `messages` → `channel_id`.

&nbsp;

In addition create a read only channel that updates with any fixes to the chat worth noting 