

## Chat Optimization Plan

### Overview
Polish the chat to feel snappier, more responsive, and more fun — without breaking existing functionality. Six targeted improvements across performance, micro-interactions, and visual refinement.

---

### 1. Stabilize callback references to prevent unnecessary re-renders

**Problem**: In `ChatPage.tsx`, handler functions like `toggleReaction`, `togglePin`, `deleteMessage`, `startEditing`, and `openThread` are recreated every render because they lack `useCallback`. Since `MessageList` passes these to memoized `MessageBubble` components, the memo comparator doesn't check function refs — but the parent still does unnecessary work diffing.

**Fix**: Wrap `toggleReaction`, `togglePin`, `deleteMessage`, `startEditing`, `openThread`, and `handleSaveEdit` in `useCallback` with proper dependency arrays. This ensures the functions are stable across renders.

---

### 2. Virtualize the message list for large channels

**Problem**: Channels with hundreds of messages render every `MessageBubble` DOM node, causing layout thrash on scroll and slow initial paint.

**Fix**: Replace the plain `.map()` in `MessageList` with a lightweight virtualization approach. Rather than adding a heavy library, use `content-visibility: auto` CSS on each message wrapper `div`. This lets the browser skip layout/paint for offscreen messages natively — zero dependencies, big wins on long channels.

**Files**: `MessageList.tsx` — add `style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 60px' }}` to each message wrapper div.

---

### 3. Debounce scroll handler and use passive listener

**Problem**: The `onScroll` handler in `MessageList` fires on every scroll frame, calling `setState` (for `autoScroll`) on each tick.

**Fix**:
- Add `{ passive: true }` via `useEffect` with `addEventListener` instead of the JSX `onScroll` prop (passive listeners can't be set via React's synthetic events).
- Throttle the handler to ~60ms using `requestAnimationFrame` guard so state updates batch naturally.

---

### 4. Add micro-interaction polish

Small touches that make the chat feel alive:

| Element | Enhancement |
|---------|------------|
| **Send button** | Add a spring scale animation on press (`active:scale-90 transition-transform`) and a brief success pulse after sending |
| **Message appear** | Add a subtle `initial={{ opacity: 0, y: 6 }}` fade-up on new messages only (not on initial load or pagination) via a flag |
| **Reaction tap** | Add `active:scale-90` spring on reaction emoji buttons for tactile feedback |
| **Channel switch** | Cross-fade messages with a quick `opacity` transition instead of an instant swap |

**Files**: `MessageComposer.tsx`, `MessageBubble.tsx`, `MessageList.tsx`

---

### 5. Improve composer feel

**Problem**: The composer textarea feels flat — no visual feedback on focus beyond a ring, and the send button transition is basic.

**Fix**:
- Add a subtle background color shift on focus (`focus:bg-muted/25`)
- Animate the send button entrance/exit with `framer-motion` scale+opacity when `value.trim()` toggles
- Add a brief `scale(0.92)` press animation on the send button via Tailwind `active:scale-[0.92]`
- Show a subtle gradient border on the textarea when focused

**Files**: `MessageComposer.tsx`

---

### 6. Optimize realtime handler to avoid profile fetches for known users

**Problem**: Every incoming message from another user triggers a `supabase.from('profiles').select()` query to get their display name and avatar. For active channels this means redundant network requests.

**Fix**: Maintain a `profileCache` ref (`Map<string, Profile>`) in `ChatPage.tsx`. Before fetching, check the cache. Populate it from the `members` array on load. This eliminates most profile fetches during active conversation.

**Files**: `ChatPage.tsx`

---

### Files to modify

| File | Changes |
|------|---------|
| `src/pages/ChatPage.tsx` | Wrap handlers in `useCallback`; add profile cache for realtime |
| `src/components/chat/MessageList.tsx` | `content-visibility` on message wrappers; passive throttled scroll; new-message fade-in animation |
| `src/components/chat/MessageComposer.tsx` | Focus background shift; animated send button; press feedback |
| `src/components/chat/MessageBubble.tsx` | `active:scale-90` on reaction buttons; keep existing memo intact |

