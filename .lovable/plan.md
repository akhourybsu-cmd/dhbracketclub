

# Chat Bubble Color System & Visual Hierarchy Refinement

## Overview
Replace the green-tinted own-message bubbles with a blue-based treatment, improve incoming bubble contrast in both modes, and refine spacing/timestamp/composer contrast — all without changing the chat structure.

## Changes

### 1. CSS Custom Properties (`src/index.css`)

Add new chat-specific tokens to `:root`/`.dark` and `.light` blocks:

**Dark mode (`:root` and `.dark`):**
```css
--chat-own: 215 65% 50%;        /* Strong blue */
--chat-own-bg: 215 65% 50% / 0.18;  /* Blue bubble bg */
--chat-incoming: 160 8% 16%;    /* Darker neutral — lifted from bg */
```

**Light mode (`.light`):**
```css
--chat-own: 215 55% 48%;
--chat-own-bg: 215 55% 48% / 0.14;
--chat-incoming: 0 0% 100%;     /* White bubbles */
```

### 2. MessageBubble.tsx — Bubble Colors

Replace the current bubble color classes:

**Own messages** (line ~258):
- Change `bg-primary/15` → `bg-[hsl(var(--chat-own-bg))]`
- This gives a blue tint instead of green

**Incoming messages** (line ~259):
- Change `bg-muted/20` → `bg-[hsl(var(--chat-incoming))]`
- Dark mode: distinct raised surface. Light mode: clean white

Add a subtle border to incoming bubbles for light mode separation:
- `border border-border/10` (invisible in dark, slight definition in light)

### 3. MessageBubble.tsx — Reactions Stay Green

Keep reactions using `border-primary/25 bg-primary/8 text-primary` — green remains the accent for interactive elements like reactions, which is correct per the plan.

### 4. MessageBubble.tsx — Timestamp Refinements

**Own messages (last in block):** Change from `text-[9px]` to `text-[10px]`, keep `text-muted-foreground/40`, add `mt-1` (was `mt-0.5`).

**Other users (first in block):** Bump timestamp from `text-[10px] text-muted-foreground/40` to `text-[10px] text-muted-foreground/45` for slightly better visibility.

### 5. MessageList.tsx — Spacing Refinements

**Sender gap:** Change from `h-3` (12px) → `h-4` (16px) for better visual separation between sender blocks.

**Within-group spacing:** Keep `py-[1px]` — already tight.

### 6. MessageComposer.tsx — Light Mode Contrast

**Input field:** Change `bg-muted/10 border border-border/15` to `bg-muted/15 border border-border/25` — more visible border in light mode while still subtle in dark.

**Send button inactive:** Change `bg-muted/20 text-muted-foreground/40` to `bg-muted/30 text-muted-foreground/50` — more visible in light mode.

**Send button active:** Keep `bg-primary` (green) — the send button accent stays green, matching brand.

### 7. Unread Divider — Stays Green

The unread divider already uses `bg-primary/10 text-primary/80` (emerald). This is correct — green as accent for system UI. No change needed.

### 8. Mentions — Stay Green

`@mention` highlights use `bg-primary/20 text-primary`. Correct — green accent. No change.

## Files Modified
1. **`src/index.css`** — Add `--chat-own`, `--chat-own-bg`, `--chat-incoming` tokens to dark and light blocks
2. **`src/components/chat/MessageBubble.tsx`** — Swap bubble bg classes, adjust timestamp sizing/spacing, add border to incoming bubbles
3. **`src/components/chat/MessageList.tsx`** — Increase sender gap from `h-3` to `h-4`
4. **`src/components/chat/MessageComposer.tsx`** — Increase input border/bg opacity for light mode visibility, boost inactive send button contrast

## Summary
- **Own bubbles**: Green → blue-tinted (`hsl(215 65% 50% / 0.18)` in dark, lighter in light)
- **Incoming bubbles**: Neutral lifted surface in dark, white with subtle border in light
- **Green preserved for**: Reactions, mentions, unread divider, send button, sender name accents
- **Spacing**: Larger gaps between sender blocks, slightly more prominent timestamps
- **Composer**: Better contrast in light mode for input field and inactive send button
- **Edge cases to test**: Both dark and light mode, long messages, reactions on blue bubbles, mention highlights inside blue bubbles

