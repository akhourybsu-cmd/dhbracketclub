

## Replace Long-Press with Single-Tap Toggle for Reaction Overlay

### Changes — `src/components/chat/MessageBubble.tsx`

1. **Remove all long-press logic**: Delete `longPressTimer` ref, `handleTouchStart`, `handleTouchEnd`, `handleTouchMove` handlers, and remove `onTouchStart`/`onTouchEnd`/`onTouchMove` from the motion div.

2. **Change `onClick` to toggle the overlay**: Replace the current `handleTapTimestamp` click handler with a new handler that toggles `showOverlay` on/off (single tap opens it, another single tap closes it). The timestamp toggle can remain as a secondary behavior when overlay is not shown, or be removed for simplicity.

3. **Keep `onContextMenu`** for desktop right-click — no change needed there.

4. **Keep the overlay modal as-is** (fixed centered, X button, backdrop dismiss, emoji row, action buttons) — it already works well on mobile.

### Files Changed

| File | Change |
|------|--------|
| `src/components/chat/MessageBubble.tsx` | Remove long-press timer/handlers, change onClick to toggle overlay open/close |

