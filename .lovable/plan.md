

# Fix Chat Channel Persistence & Settings State Sync

## Problems

1. **Channel resets to General on every visit** — `selectedChannel` starts as `null` and defaults to the `is_default` channel. No memory of the last visited channel.

2. **Settings dialog shows stale data** — `ChannelSettingsDialog` initializes form fields with `useState(channel.name)` which only runs on first mount. Opening settings for a different channel shows the previous channel's values.

---

## Plan

### Step 1: Persist last-visited channel in localStorage

In `ChatPage.tsx`:
- On channel selection (`selectChannel`), save `channelId` to `localStorage` under key `last_chat_channel_id`.
- On initial load (inside `fetchChannels`), when `!selectedChannel`, check localStorage first. If a saved ID matches a fetched channel, select it instead of the default.

### Step 2: Fix ChannelSettingsDialog state sync

In `ChannelSettingsDialog.tsx`:
- Add a `useEffect` that watches the `channel` prop and resets all local state (`name`, `description`, `icon`, `categoryId`, `isDefault`) whenever the channel changes. This ensures opening settings for a different channel always shows the correct current values.

### Step 3: Ensure handleUpdateChannel awaits properly

The `handleSave` in the dialog calls `onUpdate` but doesn't `await` it, so `setSaving(false)` fires immediately. Change `onUpdate` callback to return a Promise and await it in `handleSave` so the saving indicator works correctly and the dialog closes only after persistence succeeds.

---

## Technical Details

**Files to modify:**
- `src/pages/ChatPage.tsx` — localStorage read/write for channel persistence
- `src/components/chat/ChannelSettingsDialog.tsx` — useEffect to sync state from channel prop; await onUpdate

