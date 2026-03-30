

## Fix Chat Message Overlap & Suppress Actions During Edit

### Problem 1: Messages overlap the composer bar
The `MessageList` scrollable area and the composer both live in a flex column, but the scroll-to-bottom FAB uses `fixed` positioning with a hardcoded `bottom-24`. When the composer grows (multi-line input) or the keyboard opens, messages at the bottom can sit behind the composer. The core layout is correct (flex column with `flex-1` for messages and `flex-shrink-0` for composer), but the FAB needs to be positioned relative to the scroll container, not the viewport.

**Fix in `MessageList.tsx`:**
- Change the scroll-to-bottom button from `fixed` to `sticky` positioning at the bottom of the scroll container, or use `absolute` inside a `relative` wrapper so it floats above the composer naturally.
- Specifically: wrap the scroll area in `relative`, make the FAB `absolute bottom-4 right-4` so it stays inside the message pane and never overlaps the composer.

### Problem 2: Reaction bar appears while editing a message
The desktop hover action bar (`group-hover:flex`) and the mobile long-press handler both activate regardless of whether the message is currently being edited. This means hovering or long-pressing an in-edit message shows reactions/actions that obscure the edit textarea.

**Fix in `MessageBubble.tsx`:**
- Gate the desktop hover action bar: only render it when `editingMessageId !== msg.id`. One simple condition wrapping the bar div.
- Gate the mobile long-press: in `handleTouchStart`, bail out early if `editingMessageId === msg.id` so the action sheet never opens while editing.
- Also disable swipe-to-reply drag when editing (set `drag={editingMessageId === msg.id ? false : "x"}`).

### Files to modify

| File | Change |
|------|--------|
| `src/components/chat/MessageList.tsx` | Change FAB from `fixed` to `absolute` inside a `relative` container so it stays within the message pane |
| `src/components/chat/MessageBubble.tsx` | Hide hover action bar and disable long-press/swipe when the message is being edited |

