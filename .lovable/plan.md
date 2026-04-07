

# Chat Bubble Layout — Left/Right Alignment Refactor

## Overview
Transform the chat from a feed-style layout to a conversational bubble layout: current user's messages right-aligned with blue bubbles, other users' messages left-aligned with dark neutral bubbles. Preserve DH Club premium dark styling, grouping logic, and all existing features.

## Changes

### 1. MessageBubble.tsx — Bubble Layout

**Right-aligned (own messages):**
- Wrap content in a bubble with `bg-primary/20 rounded-2xl rounded-br-sm` (blue tint), `max-w-[80%]`, aligned right via `flex justify-end`
- First message of own block: show timestamp below the last message in the cluster (right-aligned, subtle)
- Follow-up messages: tighter rounded corners on the connecting side (`rounded-tr-sm`) for visual stacking
- No avatar or name shown for own messages
- Pin icon inline after text

**Left-aligned (other users):**
- Wrap content in a bubble with `bg-muted/25 rounded-2xl rounded-bl-sm`, `max-w-[80%]`, aligned left via `flex justify-start`
- First message of a sender block: avatar (28px) to the left of the bubble, display name above in sender color, timestamp next to name
- Follow-up messages: no avatar/name, indented to align with first bubble (`ml-[38px]`), tighter top-corner rounding
- Last message of block: small avatar (18px) at bottom-left

**Bubble corner logic for grouping:**
- Single message: fully rounded
- First in group: rounded top, tight bottom-corner on sender side
- Middle: tight corners on sender side
- Last in group: tight top-corner on sender side, rounded bottom

**Reactions:** Rendered below the bubble, aligned to the bubble's side (left for others, right for own).

**Action overlay:** Position above the bubble, shifted to match alignment side.

**Thread indicator:** Below bubble, aligned to bubble side.

**Swipe-to-reply:** Keep existing, works for both alignments.

### 2. MessageList.tsx — Minimal Changes

- Remove the colored top-accent line from sender blocks (no longer needed with bubbles)
- Keep existing sender grouping logic (`sameAuthor`, `nextSameAuthor`, `senderGap`)
- Keep the unread divider as-is (emerald pill — already implemented)
- Keep date separators as-is
- Pass alignment info is already available via `isOwn` prop

### 3. Visual Specs

**Own bubble colors:**
- Background: `bg-primary/15` (emerald-tinted, on brand)
- Text: `text-foreground/95`
- Border radius: `rounded-2xl` with grouped corner adjustments

**Other bubble colors:**
- Background: `bg-muted/20`
- Text: `text-foreground/90`
- Sender name: existing `getUserColor()` 

**Spacing:**
- Between different senders: `h-3` gap (existing)
- Within same sender: `py-0.5` (existing)
- Bubble internal padding: `px-3 py-2`

### 4. Images & Link Previews
- Render inside the bubble, constrained to bubble width
- Image max-width reduced to fit bubble (`max-w-[240px]`)

### 5. Edit Mode
- Edit textarea renders inside the bubble container, maintaining alignment

## Files Modified
1. **src/components/chat/MessageBubble.tsx** — Major refactor: add bubble containers, left/right alignment, grouped corner rounding, repositioned reactions/actions/threads
2. **src/components/chat/MessageList.tsx** — Minor: remove top-accent line logic if any remains, ensure grouping props pass correctly

## Summary
- **Own messages**: Right-aligned emerald-tinted bubbles, no avatar, timestamp at cluster end
- **Other messages**: Left-aligned neutral bubbles, avatar + name on first message of block
- **Grouping**: Tight stacking with connected corner rounding within blocks, larger gaps between blocks
- **Reactions/replies**: Attached below bubbles, aligned to the correct side
- **Edge cases to test**: Long messages, images, link previews, edit mode, reactions on both sides, rapid sender switching, mobile keyboard interaction

