

## Fix: Composer Overlapping Messages + Auto-Scroll on Channel Entry

### Root Causes

**1. Composer overlap:** The chat container height is `calc(100dvh - 4.5rem - env(safe-area-inset-bottom))` — but AppLayout now adds `padding-top: env(safe-area-inset-top)` to the outer shell. The chat container doesn't subtract that top inset, so it's taller than the available space, pushing the composer below the visible area and overlapping messages.

**2. No auto-scroll on channel switch:** `MessageList` initializes `autoScroll = true` but never resets it when the channel changes. If a user scrolled up in one channel, `autoScroll` stays `false` when they switch to another channel.

### Fixes

#### 1. `src/pages/ChatPage.tsx` — Subtract top safe area from container height

Change the height calc on both the channel list view (line 604) and message view (line 628) from:
```
calc(100dvh - 4.5rem - env(safe-area-inset-bottom, 0px))
```
to:
```
calc(100dvh - 4.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))
```

This ensures the chat container fits exactly in the space between the top safe area and the bottom nav.

#### 2. `src/components/chat/MessageList.tsx` — Reset auto-scroll when channel changes

Add a `useEffect` that resets `autoScroll` to `true` and scrolls to bottom when `selectedChannel` changes. This ensures entering any channel always shows the latest messages.

### Files
| File | Change |
|------|--------|
| `src/pages/ChatPage.tsx` | Update height calc to include safe-area-inset-top (2 lines) |
| `src/components/chat/MessageList.tsx` | Add effect to reset autoScroll on channel change (~5 lines) |

