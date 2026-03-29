

# Mobile Overflow Fix — Chat & Global Bounds Check

## Problem
On mobile (411x734 viewport), chat content extends beyond screen bounds. The root cause is the negative margin pattern (`-mx-4 sm:-mx-5`) used in `ChatPage.tsx` to break out of the `AppLayout` padding, combined with elements inside (message bubbles, headers, composers) that don't properly constrain their width. The `MessageBubble` also uses `-mx-2.5` which can push content further out.

## Key overflow sources

1. **MessageBubble `-mx-2.5`** (line 99) — negative horizontal margin on every message row can push content beyond the scroll container
2. **ChatPage container** uses `-mx-4 sm:-mx-5 -mt-5` to counteract AppLayout's `px-4 sm:px-5 py-5` padding, but this creates a fragile relationship where any inner padding mismatch causes overflow
3. **Floating action bar** (MessageBubble line 197) — positioned `right-0` with no overflow containment, can extend past container edge
4. **Reaction picker** and **emoji row** in mobile action sheet — `overflow-x-auto` on emoji row but the sheet itself is `fixed left-0 right-0`, which should be fine but the inner content may overflow
5. **ChannelList** has no `overflow-hidden` on its root, and channel names with long text could push width
6. **ThreadPanel** on mobile takes `w-full` but its parent div (line 620) has no `overflow-hidden`

## Plan

### 1. Add `overflow-hidden` to the chat root containers
In `ChatPage.tsx`, add `overflow-hidden` to both the channel-list view (line 470) and the message view (line 492) root `div`s. This prevents any child from pushing the container wider than the viewport.

### 2. Remove negative margin on MessageBubble
Replace `-mx-2.5` on line 99 of `MessageBubble.tsx` with `mx-0`. The left accent border and padding already handle spacing — the negative margin is unnecessary and causes horizontal overflow.

### 3. Constrain floating action bar
Add `overflow-hidden` to the `pl-[38px]` content div (line 121) so the absolute-positioned hover toolbar doesn't extend beyond bounds. Also ensure the toolbar uses `right-2` instead of `right-0` for some breathing room.

### 4. Add `overflow-x-hidden` to MessageList scroll container
On `MessageList.tsx` line 89, add `overflow-x-hidden` alongside `overflow-y-auto` to prevent any horizontal scroll from message content or reactions.

### 5. Global mobile bounds safety
In `AppLayout.tsx`, add `overflow-x-hidden` to the `<main>` element (line 89) to act as a final safety net preventing any page from exceeding the viewport width.

### 6. Truncate long channel names
In `ChannelList.tsx`, the channel name span (line 103) already has `truncate` — verify the parent has `min-w-0` (it does via `min-w-0 flex-1` on line 101). No change needed here.

## Files to modify
- `src/pages/ChatPage.tsx` — add `overflow-hidden` to root containers
- `src/components/chat/MessageBubble.tsx` — remove `-mx-2.5`, adjust toolbar position
- `src/components/chat/MessageList.tsx` — add `overflow-x-hidden`
- `src/components/AppLayout.tsx` — add `overflow-x-hidden` to main

