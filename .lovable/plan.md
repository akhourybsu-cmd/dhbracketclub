

# Chat Optimization Plan

## Issues Found

1. **Header not sticky** — The channel header (title, search, pin buttons) scrolls with content instead of staying fixed at the top
2. **No scroll-to-bottom button** — When scrolled up reading history, no way to jump back to latest messages
3. **Composer input is basic** — Single-line `<input>` with no multi-line support; long messages get clipped
4. **No empty-state for search results** — Searching with no matches shows a blank area with no feedback
5. **Mobile action sheet positioning** — Long-press menu renders below the message with `translate-y-full`, which can overflow off-screen for messages near the bottom
6. **Channel list has no pull-to-refresh or visual loading indicator on re-entry** — Feels static when returning to the channel list
7. **Thread panel has no reactions or actions** — Thread replies are plain text with no ability to react, edit, or delete
8. **Timestamp visibility on grouped messages** — Hover-only timestamp (`group-hover:text-muted-foreground/70`) is invisible on mobile for grouped messages — no way to see when a message was sent
9. **No typing/sending indicator** — No visual feedback that a message is being sent (the optimistic message just appears at 60% opacity with no label)
10. **Keyboard doesn't auto-focus composer** — Entering a channel on mobile doesn't focus the input, requiring an extra tap

## Plan

### 1. Sticky channel header
Move the header `div` (lines 447-466) outside the scrollable area and ensure it uses `sticky top-0 z-20` positioning so the channel name, search, and pin buttons stay locked to the top during scroll.

### 2. Scroll-to-bottom FAB
Add a floating "jump to bottom" button in `MessageList` that appears when `autoScroll` is false (user has scrolled up). Clicking it scrolls to `messagesEndRef` and hides the button. Show an unread count badge on it if new messages arrived while scrolled up.

### 3. Multi-line composer
Replace the `<Input>` in `MessageComposer` with a `<textarea>` that auto-grows (1-4 lines). Send on Enter, newline on Shift+Enter. This allows longer messages without horizontal clipping.

### 4. Search empty state
In `MessageList`, when `searchResults` is an array with 0 items, show a "No messages found" empty state instead of blank space.

### 5. Mobile action sheet — render as bottom sheet
Instead of positioning the action menu relative to the message (which overflows), render it as a fixed bottom sheet (`fixed bottom-0 inset-x-0`) with a backdrop overlay. This is the standard mobile pattern and avoids clipping.

### 6. Tap-to-show timestamp on mobile
For grouped messages (same author), make the hidden timestamp visible on tap (not just hover). Add an `onClick` toggle so mobile users can tap a message to briefly reveal its timestamp.

### 7. Search results count indicator
When search is active and results are loaded, show a small pill like "3 results" below the search input to give feedback.

### 8. Optimistic message indicator
Replace the plain `opacity-60` on optimistic messages with a subtle "Sending..." label or a small spinner next to the message, so users know it's in-flight.

### 9. Auto-focus composer on channel entry
In `MessageComposer`, add an `autoFocus` prop and set it when the channel view mounts, so the keyboard is ready for input immediately.

## Files to modify
- `src/pages/ChatPage.tsx` — sticky header structure, search empty state handling, auto-focus prop
- `src/components/chat/MessageList.tsx` — scroll-to-bottom FAB, search empty state UI
- `src/components/chat/MessageComposer.tsx` — textarea replacement, auto-grow, autoFocus
- `src/components/chat/MessageBubble.tsx` — bottom sheet action menu, tap-to-show timestamp, optimistic indicator

