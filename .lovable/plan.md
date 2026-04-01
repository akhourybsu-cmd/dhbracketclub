

## Convert Overlay from Fixed Modal to Inline Bar

### Problem
The current reaction overlay is a full-screen fixed modal with backdrop dimming — the user wants it to be a compact bar that appears directly over the message bubble itself, toggled by a single tap.

### Changes — `src/components/chat/MessageBubble.tsx`

1. **Remove the portal**: Stop using `ReactDOM.createPortal` to render into `document.body`. Render the overlay inline within the message's content `div` instead.

2. **Replace the fixed modal with an absolute-positioned bar**:
   - Remove the full-screen backdrop (`fixed inset-0 bg-black/40 backdrop-blur-sm`)
   - Remove the large card layout (message preview, divider, vertical action list, X button)
   - Replace with a compact horizontal bar positioned `absolute` above the message content (e.g. `absolute -top-10 left-0 right-0 z-30`)
   - The bar contains: the emoji row (smaller, `w-8 h-8` buttons) and compact icon-only action buttons (Reply, Pin, Edit, Delete) all in a single horizontal flex row
   - Styled as a small rounded pill/card with `bg-background/95 backdrop-blur border shadow-lg rounded-xl px-2 py-1`

3. **Keep single-tap toggle**: `onClick={handleTap}` still toggles `showOverlay` on/off — tap message to show bar, tap again to dismiss. No backdrop needed since it's just a small bar.

4. **Keep `onContextMenu`** for desktop right-click.

5. **Clean up**: Remove `ReactDOM` import (no longer needed for portal).

### Result
A slim inline reaction/action bar floats directly above the tapped message — no dimming, no modal, no portal. Tap to open, tap to close.

### Files Changed

| File | Change |
|------|--------|
| `src/components/chat/MessageBubble.tsx` | Replace portal-based fixed modal with inline absolute-positioned bar over message |

