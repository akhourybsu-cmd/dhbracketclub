

## Replace Reaction Bar with Long-Press Overlay

### Problem
The current chat has multiple overlapping reaction UIs: a desktop hover toolbar, an inline SmilePlus picker below reactions, and a mobile bottom-sheet action menu. These feel intrusive and redundant. The user wants a single, unified **press-and-hold** interaction that opens a reaction/action overlay directly on top of the message.

### Design

**New interaction model:**
- **Long-press (mobile) or right-click (desktop)** on any message opens an overlay panel that appears directly over/beside the message bubble
- The overlay contains: a row of quick emoji reactions, plus action buttons (Reply, Pin, Edit, Delete)
- A visible **X button** in the top-right corner of the overlay to dismiss it
- Tapping the backdrop also dismisses
- Selecting a reaction auto-dismisses the overlay

**Removed elements:**
- Desktop hover action bar (the floating bar that appears on `group-hover` above messages)
- Inline SmilePlus button after existing reaction badges (the `+` emoji picker button in the reactions row)
- Separate inline reaction picker (`reactionOpen` state and its popover)
- Bottom-sheet mobile action menu (replaced by the new overlay)

**Kept:**
- Existing reaction badge row (showing counts of reactions already placed — tapping these still toggles your reaction directly)
- Swipe-to-reply gesture
- Thread indicator
- Delete confirmation dialog
- Edit mode

### Changes

**`src/components/chat/MessageBubble.tsx`**
1. Remove `reactionOpen` state and the inline reaction picker (`AnimatePresence` block with `reactionRef`)
2. Remove the desktop hover action bar (`group-hover:flex` div with z-30)
3. Replace the bottom-sheet mobile action menu with a new **overlay card** that:
   - Is positioned absolutely over the message bubble (centered, with a semi-transparent backdrop)
   - Contains emoji row + action buttons in a compact card layout
   - Has an X button in the corner
   - Uses the same `showMobileActions` state (triggered by long-press on mobile, or right-click/context-menu on desktop)
4. Remove the SmilePlus button from the reactions row (keep only the reaction count badges)
5. Add `onContextMenu` handler for desktop right-click to open the same overlay
6. Clean up unused refs (`reactionRef`) and state (`reactionOpen`)

**`src/components/chat/types.ts`** — No changes needed

### Files Changed
| File | Change |
|------|--------|
| `src/components/chat/MessageBubble.tsx` | Replace hover bar + bottom sheet + inline picker with single long-press/right-click overlay card with X button |

