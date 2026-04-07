

# Chat Message Layout Refinement

## Overview
Refine the existing MessageBubble and MessageList components to improve sender grouping, visual separation, unread markers, and overall feed readability — without redesigning the chat system.

## Changes

### 1. MessageList.tsx — Spacing & Unread Divider

**Sender block spacing**: Replace the uniform `space-y-0.5` with dynamic margins controlled by the `sameAuthor` flag already computed per message. Between different senders: `mt-5` (~20px). Within same sender: `mt-0.5` (~2px).

**Unread divider upgrade**: The current divider exists but is minimal. Enhance it:
- Show unread count: "3 New Messages" (computed from `filtered.length - 1 - unreadDividerAfterIdx`)
- Use a pill-style label centered on a horizontal rule
- Color: `bg-primary/15 text-primary` (emerald tint, on-brand) instead of current destructive red
- Add subtle top/bottom padding for breathing room

**Date separators**: Keep existing but reduce visual weight slightly — thinner text, more spacing from message blocks.

### 2. MessageBubble.tsx — Sender Grouping & Visual Treatment

**Remove the 3px colored left border** on every message. Replace with:
- **First message of a sender block**: Show a subtle colored top-accent line (2px, sender color, rounded, ~40px wide) above the author line, plus the avatar + name + timestamp
- **Follow-up messages**: No accent, no avatar/name — just the content indented to align with the first message's text. Keep the hover-timestamp behavior.
- **Last message of a block**: Show the mini-avatar (existing `showGroupedAvatar` logic) at 18px

**Author line refinement**:
- Name: `text-[13px] font-semibold` (slightly larger, more prominent)
- Timestamp: `text-[10px] text-muted-foreground/50` (more subdued)
- Remove pin icon from author line, move it inline after message text

**Own-message treatment**: Keep the subtle `bg-primary/[0.04]` background but extend it to cover the entire sender block visually.

### 3. Reactions Spacing
- Increase `mt-1.5` to `mt-2` on the reactions row
- Add `mb-1` so reactions don't crowd into the next sender block
- Keep existing reaction badge styling

### 4. Thread Indicator
- Keep as-is, the current treatment is clean

### 5. Content Indentation
- All messages (first and follow-up) will have text at `pl-[38px]` (already the case)
- This creates a consistent left-aligned text column that's easy to scan

## Files Modified
1. **src/components/chat/MessageBubble.tsx** — Remove left border, add sender-block top accent on first message, refine author line typography, adjust reactions spacing
2. **src/components/chat/MessageList.tsx** — Dynamic inter-block spacing, enhanced unread divider with count and on-brand styling, minor date separator refinement

## Summary of Changes
- **Sender grouping**: Consecutive messages grouped with tight spacing; avatar+name only on first message; larger gap between different senders
- **Unread divider**: Emerald pill showing "X New Messages" on a subtle horizontal rule
- **Spacing hierarchy**: 20px between sender blocks, 2px within; reactions get extra bottom margin
- **Accent treatment**: Colored left border replaced with a short top-accent on the first message of each block — cleaner, less busy

## Edge Cases to Test
- Single-message sender blocks (should still show avatar + accent)
- Very long message threads with many senders switching rapidly
- Unread divider with 0 unread (should not show)
- Messages with images, link previews, and reactions together
- Dark mode and light mode appearance

