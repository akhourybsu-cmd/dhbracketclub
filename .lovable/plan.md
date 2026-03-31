

## Fix: Mobile Chat Scroll & Keyboard Behavior

### Problems
1. **Channel entry doesn't reliably scroll to bottom** — the 50ms timeout is a guess and often fires before messages render, leaving the user mid-scroll.
2. **Keyboard opens and pushes content up unpredictably** — the `visualViewport` resize recalculates the container height, but the message list doesn't re-anchor to the bottom, so the user has to manually scroll down again.
3. **Multiple scrolls required** — the ResizeObserver on the message list container fires but `scrollIntoView` without `block: 'end'` can be inconsistent; combined with the height animation, the user ends up needing to scroll more than once.

### Root Cause
The outer container height (`chatHeight`) changes when the keyboard opens/closes, which resizes the MessageList scroll container. The ResizeObserver fires and calls `scrollIntoView()`, but there's a race between the height animation and the scroll command. Additionally, on channel switch, a single 50ms delay isn't robust enough — messages may not be in the DOM yet.

### Plan

#### 1. `src/pages/ChatPage.tsx` — Stabilize viewport height updates
- Use `requestAnimationFrame` inside the `visualViewport` resize handler to ensure the DOM has painted before setting `chatHeight`, eliminating the frame where the container is the wrong size.
- After setting height when keyboard opens, trigger a scroll-to-bottom event that MessageList can respond to (pass a `scrollToBottomTrigger` counter prop or use a ref callback).

#### 2. `src/components/chat/MessageList.tsx` — Robust auto-scroll on channel entry & keyboard
- **Channel entry**: Replace the 50ms `setTimeout` with a two-phase approach: use `requestAnimationFrame` + `scrollIntoView` after the initial render, then a `MutationObserver` on the scroll container that fires once when child nodes are added (messages loaded), scrolls to bottom, then disconnects. This guarantees we scroll after messages are actually in the DOM.
- **Keyboard resize**: Update the `ResizeObserver` callback to always call `scrollIntoView({ block: 'end' })` (not just when `autoScroll` is true), and add a short `requestAnimationFrame` wrapper so the scroll happens after the layout reflow from the height change.
- **Eliminate double-scroll**: After any programmatic scroll-to-bottom (channel switch, keyboard open, new message), immediately set `autoScroll = true` so subsequent resize events continue anchoring.

#### 3. `src/components/chat/MessageComposer.tsx` — Prevent composer from detaching
- Add `position: sticky; bottom: 0` CSS to the composer wrapper (it's currently just `flex-shrink-0`), ensuring it stays pinned to the bottom of the flex column regardless of intermediate layout states.
- On the textarea focus event (mobile), dispatch a small delay scroll-to-bottom to the parent to counteract any iOS scroll adjustment.

### Files
| File | Change |
|------|--------|
| `src/pages/ChatPage.tsx` | Wrap `visualViewport` handler in rAF; pass scroll trigger prop |
| `src/components/chat/MessageList.tsx` | Replace setTimeout with MutationObserver for channel entry; improve ResizeObserver with rAF; always re-anchor on resize |
| `src/components/chat/MessageComposer.tsx` | Minor: ensure sticky bottom positioning, focus-triggered scroll |

### Result
Entering a channel scrolls to the very last message every time. Opening the keyboard resizes the container and immediately re-anchors to the bottom — no extra scrolling. The composer stays flush against the keyboard at all times.

