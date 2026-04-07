

# Chat Channel List — Premium Polish Refinement

## Overview
Refine the ChannelList component to improve state differentiation, text hierarchy, surface contrast, and category polish in both dark and light modes — without changing the core layout or structure.

## Changes (single file: `src/components/chat/ChannelList.tsx`)

### 1. Channel Row States
Replace the current flat state classes with stronger differentiation:

- **Active/selected**: `bg-primary/10 border border-primary/15` — subtle green-tinted highlight with a faint border for definition
- **Unread**: `bg-muted/40` (dark) with a stronger unread dot (`w-2.5 h-2.5 bg-primary`) and slightly bolder treatment
- **Read/quiet**: No background, just `hover:bg-muted/30 active:bg-muted/40` — clearly quieter than unread
- Add `border border-transparent` to all rows so the active border doesn't cause layout shift

### 2. Preview Text Hierarchy
Differentiate between live message previews and static descriptions:

- **Last message preview**: `text-[11px] text-foreground/60` (read) or `text-foreground/70 font-medium` (unread) — feels "live"
- **Static description** (no messages): `text-[10px] text-muted-foreground/40 italic` — clearly secondary and quieter
- **Author prefix** in preview: `font-bold` instead of `font-semibold` for stronger separation from content

### 3. Emoji Icon Box
- Unread: `bg-primary/15 shadow-sm` — slightly glowing, lifted
- Active: `bg-primary/12`
- Read: `bg-muted/40` (dark) / `bg-muted/60` (light — stronger surface in light mode)
- Increase size from `w-9 h-9` to `w-10 h-10` and `rounded-xl` to `rounded-2xl` for a more premium feel

### 4. Category Section Labels
- Increase from `text-[9px]` to `text-[10px]`
- Change tracking from `tracking-[0.2em]` to `tracking-[0.15em]`
- Add a subtle left accent: `border-l-2 border-primary/20 pl-2` for premium intentionality
- Increase bottom margin from `mb-1.5` to `mb-2`

### 5. Header Polish
- Increase title from `text-xl` to `text-2xl` for more presence
- Improve subtitle: `text-[11px] text-muted-foreground/50` (slightly more readable)
- Add bottom border to header area: `border-b border-border/10 pb-4 mb-6` to separate from channel list
- Action buttons: add `hover:bg-muted/30` and `rounded-full` for a softer, more modern feel

### 6. Row Surface Separation
- Add `rounded-2xl` (was `rounded-xl`) for softer, more premium corners
- Increase row padding slightly: `px-3.5 py-3.5` (was `px-3 py-3`)
- In the active state, add a very subtle shadow: `shadow-sm` to lift the selected channel

### 7. Timestamp
- Bump from `text-[9px]` to `text-[10px]`
- Unread timestamp: `text-primary/60 font-semibold` — colored to match the unread indicator
- Read timestamp: `text-muted-foreground/50`

### 8. Spacing Between Rows
- Change `space-y-0.5` to `space-y-1` for slightly more breathing room between channel rows

## Files Modified
1. **`src/components/chat/ChannelList.tsx`** — all changes above (styling only, no logic changes)

## Summary
- **Hierarchy**: Larger header, stronger category labels with left accent, bigger emoji boxes, clearer preview text levels
- **State differentiation**: Active gets green border + shadow, unread gets stronger background + colored timestamp + larger dot, read stays quiet
- **Light mode**: Stronger emoji box backgrounds, better contrast on preview text, border definition on active row
- **Dark mode**: Subtle glow on unread emoji boxes, active row lift via shadow
- **Edge cases to test**: Many categories with mixed read/unread, channel with no messages vs. with preview, light mode vs. dark mode, very long channel names or preview text truncation

