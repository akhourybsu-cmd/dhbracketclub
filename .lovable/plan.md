

## Issue: Reaction overlay doesn't reliably appear on tap

### Root causes (from inspecting `MessageBubble.tsx`)

1. **Drag swallowing tap** — outer `motion.div` has `drag="x"` for swipe-to-reply. Framer Motion's drag gesture often suppresses the synthetic `onClick` even on micro-movements (especially on mobile where finger jitter triggers a tiny drag). The tap is registered as a drag end, `onClick` never fires → overlay never opens.

2. **Each bubble owns its own `showOverlay` state** — tapping bubble B while bubble A's overlay is open doesn't close A. Then tapping A again toggles it shut. If user taps rapidly across bubbles, overlays appear stuck or unresponsive.

3. **Overlay clipping** — `absolute -top-11` places the bar 44px above the bubble. For the topmost visible message (just under the sticky chat header), the overlay renders behind/under the header and looks like nothing happened.

4. **Tap target conflict on links/images** — clicking inside a bubble that contains a link calls `e.stopPropagation()` on the anchor, which is correct, but the bubble's own `onClick` still triggers when tapping near (not on) the link. Edge taps near interactive children sometimes don't bubble as expected.

### Fix plan

**A. Decouple tap from drag using `onTap` + drag threshold**
- Replace `onClick={handleTap}` with Framer Motion's `onTap` handler, which correctly distinguishes tap vs drag.
- Add `dragMomentum={false}` and bump drag activation so accidental drags don't fire.

**B. Lift overlay state to a single source of truth**
- In `MessageList.tsx`, track `openOverlayMessageId: string | null`.
- Pass `isOverlayOpen` and `onToggleOverlay(msgId)` props to each `MessageBubble`. Bubble removes its local `showOverlay` state.
- Result: opening one overlay automatically closes any other.

**C. Smart overlay positioning**
- Detect available space: if bubble's top is within 56px of viewport top (or the chat header), render overlay **below** bubble (`-bottom-11`) instead of above.
- Use a simple `useLayoutEffect` measurement when overlay opens, or a CSS-only approach: render overlay above, but add `style={{ top: 'auto', bottom: '-44px' }}` when bubble's `getBoundingClientRect().top < HEADER_OFFSET`.

**D. Add `pointer-events-auto` and ensure `z-30` beats sticky header**
- Header likely has `z-20`; raise overlay to `z-50` to guarantee visibility.

### Files to edit

- `src/components/chat/MessageBubble.tsx` — switch to `onTap`, remove local `showOverlay` state (accept from props), add adaptive positioning
- `src/components/chat/MessageList.tsx` — add `openOverlayMessageId` state, pass handlers down

### Out of scope

- Don't change reaction pill positioning (already approved iMessage style)
- Don't change swipe-to-reply behavior
- No new dependencies

