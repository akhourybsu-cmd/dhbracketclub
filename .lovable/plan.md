

## Ensure Chat Header & Composer Stay Fixed

### Current State

The layout is mostly correct:
- **Header**: Has `sticky top-0 z-10` and `flex-shrink-0` — should stay pinned
- **Composer**: Has `sticky bottom-0` in its container, wrapped in a `flex-shrink-0` div
- **Chat container**: Uses dynamic `chatHeight` from `visualViewport` to size the entire chat area
- **AppLayout**: Applies `overflow-hidden` for chat routes

### Potential Issue

The layout chain is: outer flex container (`height: chatHeight`, `overflow: hidden`) → inner flex column → header (`flex-shrink-0`) → middle flex area (`flex-1 min-h-0`) → message column (`flex flex-col flex-1`). 

The `sticky` classes on the header and composer are redundant here because the flex layout already pins them. But the real risk is that the inner message column (`flex flex-col flex-1 min-w-0` on line 515) doesn't constrain its overflow properly — if this column doesn't have `overflow-hidden` or equivalent, the flex children (MessageList + composer) might not behave correctly when content exceeds the viewport.

### Changes

**`src/pages/ChatPage.tsx`**:

1. **Message column** (line 515): Add `min-h-0` to ensure the flex child can shrink, and make the composer truly pinned at the bottom by ensuring the flex layout works:
   - The inner div at line 515 (`flex flex-col flex-1 min-w-0`) needs `overflow-hidden` to prevent content from pushing the composer off-screen

2. **Header** (line 473): Add `bg-background` as a fallback alongside the inline background style, ensuring the header always has an opaque background when sticky

3. **Composer wrapper** (line 573): Ensure it has `z-10` so it layers above any scrolling message content

These are small defensive additions to ensure the existing layout holds firm on all mobile browsers and keyboard states.

### Files Changed
| File | Change |
|------|--------|
| `src/pages/ChatPage.tsx` | Add `overflow-hidden` to message column div; add `z-10` to composer wrapper; ensure header background is always opaque |

