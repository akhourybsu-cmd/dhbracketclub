

# Chat Refinements — Hard Pass

## Issues Found

1. **Delete has no confirmation** — Tapping delete immediately removes the message with no undo or confirm dialog. Accidental deletes are permanent.

2. **Thread reply has no optimistic update** — Thread replies wait for the DB round-trip before appearing, unlike main messages which have optimistic inserts.

3. **Search input doesn't clear on close** — Closing search via the X button clears state but reopening shows stale results briefly due to the 300ms debounce race.

4. **Channel header back button misaligned on desktop** — The `lg:hidden` back chevron disappears on desktop but there's no way to switch channels from the message view on large screens (no sidebar).

5. **Grouped message timestamp has no left padding** — When `sameAuthor` is true, the message content has no `pl-[38px]` indent to align with the avatar above, making grouped messages look flush left while first messages are indented.

6. **Edit mode uses single-line Input** — Editing a multi-line message forces it into a single-line `<Input>`, losing content visibility. Should use the same auto-growing textarea pattern as the composer.

7. **No haptic feedback on long-press** — Mobile long-press opens the bottom sheet but doesn't trigger device vibration, making it feel less native.

8. **Pinned messages panel has no unpin action** — The pinned messages view shows messages but offers no way to unpin them directly; user must find them in the feed.

9. **Thread panel doesn't show on mobile when opening** — On mobile (`hidden lg:flex` logic on line 485), opening a thread hides the message list but the thread panel itself needs explicit mobile visibility handling.

10. **No message link/URL detection** — Plain URLs in messages are rendered as text with no clickable links.

## Plan

### 1. Delete confirmation dialog
Add a confirmation step before deleting a message. Use a simple `AlertDialog` that asks "Delete this message?" with Cancel/Delete buttons. Apply to both desktop hover actions and mobile bottom sheet.

### 2. Edit with auto-growing textarea
Replace the `<Input>` in the edit mode section of `MessageBubble.tsx` with a `<textarea>` using the same auto-resize pattern from `MessageComposer`. This preserves multi-line content during editing.

### 3. Optimistic thread replies
Mirror the main chat optimistic pattern: immediately append a local reply with `_optimistic: true` to `threadMessages`, then replace it when the realtime event arrives.

### 4. URL auto-linking in messages
Parse message content for URLs (http/https) and render them as clickable `<a>` tags with `target="_blank"`. Use a simple regex replacement, styled with `text-primary underline`.

### 5. Haptic feedback on long-press
Add `navigator.vibrate?.(10)` when the long-press timer fires, giving a subtle tactile cue on supported devices.

### 6. Unpin from pinned panel
Add a small unpin button to each pinned message card in the pinned messages view, calling the existing `togglePin` function.

### 7. Desktop channel sidebar
On `lg:` breakpoints, show the channel list as a persistent left sidebar alongside the message view, instead of hiding it entirely. This gives desktop users quick channel switching without the back button.

### 8. Mobile thread panel visibility
Fix the `hidden lg:flex` conditional so that when `threadParent` is set on mobile, the thread panel is shown full-screen (hiding the message list), matching how pinned messages already work.

## Files to modify
- `src/components/chat/MessageBubble.tsx` — delete confirmation, edit textarea, URL linking, haptic feedback
- `src/pages/ChatPage.tsx` — optimistic thread replies, unpin from pinned panel, desktop sidebar layout, mobile thread fix
- `src/components/chat/ThreadPanel.tsx` — minor adjustment for mobile full-screen display

