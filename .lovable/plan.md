

## Mobile-Optimize the Long-Press Reaction Overlay

### Problem
The current overlay uses `position: absolute` within the message content div, which on mobile can clip, overflow outside the scroll container, or position awkwardly relative to the message. The backdrop is transparent (no visual dimming), making it unclear the overlay is modal. The long-press also conflicts with the swipe-to-reply drag gesture.

### Changes

**`src/components/chat/MessageBubble.tsx`**

1. **Move overlay to a fixed-position centered modal** instead of `absolute` within the message content:
   - Use `fixed inset-0 z-50` with a semi-transparent dark backdrop (`bg-black/40`) for clear visual separation
   - Center the overlay card vertically and horizontally using flexbox on the backdrop
   - This ensures it's always fully visible on mobile regardless of scroll position or message location

2. **Increase touch targets for mobile**:
   - Bump emoji buttons from `w-9 h-9` to `w-11 h-11` with `text-xl` for easier tapping
   - Increase action button padding from `py-2.5` to `py-3`
   - Make the X close button larger: `w-8 h-8`

3. **Add touch-action: none to the overlay** to prevent scroll-through while the overlay is open

4. **Prevent long-press from firing during swipe**: Cancel the long-press timer if drag movement exceeds a small threshold (already handled by `handleTouchMove`, but verify the drag gesture doesn't interfere)

5. **Add subtle backdrop blur** to the dimmed background for a polished mobile feel

6. **Show a preview of the message text** at the top of the overlay (truncated to 2 lines) so users confirm which message they're acting on

### Technical Details

The key change is moving from `absolute` positioning (which depends on parent `overflow` and can be clipped by the scroll container) to a `fixed` full-screen modal pattern. The backdrop gets `bg-black/40 backdrop-blur-sm` for visual clarity. The overlay card itself becomes `fixed` centered with `max-w-[340px] w-[calc(100%-2rem)]` to respect mobile margins. Safe-area insets are respected via existing body-level styles.

### Files Changed

| File | Change |
|------|--------|
| `src/components/chat/MessageBubble.tsx` | Convert overlay from absolute to fixed centered modal, enlarge touch targets, add dimmed backdrop, add message preview |

