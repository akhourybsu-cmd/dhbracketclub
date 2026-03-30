

# Chat Feature — Next-Level Polish & Optimization

## Current State
The chat is functional with channels, messages, threads, reactions, search, pins, optimistic sends, and realtime. The core architecture is solid. What follows are the targeted improvements to make it feel like iMessage/Discord-quality.

## Changes

### 1. Composer: iOS keyboard handling & visual polish
**Problem**: On iOS, when the keyboard opens the composer can get pushed behind the bottom nav or the viewport doesn't resize correctly. The composer also lacks a typing-feel polish.
**Fix**:
- Add `visualViewport` resize listener in `MessageComposer` to ensure the composer stays visible above the keyboard on iOS
- Use `position: sticky; bottom: 0` pattern instead of relying on flex-shrink
- Add safe-area padding to the composer bottom
- In `ChatPage.tsx`, add `pb-0` override and ensure the chat container uses `100dvh` minus header only (already mostly done, but verify no bottom-nav padding leaks in)

### 2. Scroll position preservation on older message load
**Problem**: When loading older messages (`loadOlderMessages`), the scroll jumps because new content is prepended without preserving scroll position.
**Fix**: In `MessageList`, before prepending older messages, capture `scrollHeight`. After state update, use a `useLayoutEffect` or `requestAnimationFrame` to set `scrollTop = newScrollHeight - oldScrollHeight`.

### 3. Typing indicators (lightweight)
**Problem**: No feedback when someone else is typing — a basic expectation of modern chat.
**Fix**: Use Supabase Realtime `presence` on the channel to broadcast typing state. Show a subtle "User is typing..." indicator above the composer. Debounce typing broadcasts to every 2 seconds. Auto-clear after 3 seconds of inactivity.

### 4. Read receipts / "New messages" divider
**Problem**: When entering a channel with unread messages, there's no visual indicator of where new messages start.
**Fix**: When fetching messages, compare `last_read_at` timestamp. Insert a "New messages" divider line in `MessageList` between the last-read message and the first unread one.

### 5. Message grouping edge case — date boundary
**Problem**: Already handled `nextSameAuthor` with date check, but the `sameAuthor` flag doesn't check date boundaries — consecutive messages from the same user spanning midnight will incorrectly group.
**Fix**: Add date-label check to `sameAuthor` computation in `MessageList`.

### 6. Swipe-to-reply (mobile)
**Problem**: Long-press is the only way to reply on mobile. Most modern chat apps support swipe-right-to-reply for speed.
**Fix**: Add a horizontal drag gesture on `MessageBubble` using Framer Motion's `drag="x"` with constraints. When dragged past a threshold (~60px), trigger `onOpenThread`. Show a reply icon emerging during the drag. Snap back on release.

### 7. Image/media preview for URLs
**Problem**: Pasted URLs render as plain text links. Modern chat apps show link previews.
**Fix**: Detect URLs in message content. For known image extensions (.jpg, .png, .gif, .webp), render an inline `<img>` preview below the message text. This is a lightweight first step — full OpenGraph previews can come later.

### 8. Composer focus management
**Problem**: After sending a message, focus returns to the textarea, but after certain actions (closing thread, switching channels), focus isn't managed well.
**Fix**: Auto-focus the composer when selecting a channel or closing a thread panel. Expose a `focusComposer` ref callback from `MessageComposer`.

### 9. Empty channel list padding on desktop
**Problem**: On desktop, the channel sidebar scrolls but has no bottom padding — last channel can sit tight against the edge.
**Fix**: Add `pb-20` to the `ChannelList` container.

### 10. Performance: memoize MessageBubble
**Problem**: Every message re-renders when any state in the list changes (new message, reaction, etc.). With 50+ messages this causes noticeable lag.
**Fix**: Wrap `MessageBubble` in `React.memo` with a custom comparator that checks `msg.id`, `msg.content`, `msg.edited_at`, `msg.reactions`, `msg.reply_count`, `msg.is_pinned`, `editingMessageId`, and `sameAuthor`/`nextSameAuthor`.

## Files to modify
- `src/components/chat/MessageComposer.tsx` — keyboard handling, ref forwarding, focus management
- `src/components/chat/MessageList.tsx` — scroll preservation, new-messages divider, sameAuthor date fix
- `src/components/chat/MessageBubble.tsx` — React.memo, swipe-to-reply, inline image previews
- `src/components/chat/ChannelList.tsx` — bottom padding
- `src/pages/ChatPage.tsx` — typing indicator presence, focus management, pass last_read_at
- `src/components/chat/types.ts` — no changes needed

## Priority order
1. Scroll preservation on load-more (functional bug)
2. React.memo on MessageBubble (performance)
3. sameAuthor date boundary fix (visual bug)
4. Composer keyboard/focus management (mobile UX)
5. New messages divider (UX polish)
6. Inline image previews (feature)
7. Swipe-to-reply (feature)
8. Typing indicators (feature)
9. Channel list padding (minor polish)

