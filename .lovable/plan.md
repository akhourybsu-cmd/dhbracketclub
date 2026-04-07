

# Chat Composer Refinement

## Overview
Polish the MessageComposer component to feel like a premium messaging app input bar — better spacing, cleaner field styling, refined send button, and improved attachment controls — without changing any existing functionality.

## Changes (single file: `src/components/chat/MessageComposer.tsx`)

### 1. Outer container
- Add a subtle top border (`border-t border-border/10`) and soft backdrop blur (`bg-background/80 backdrop-blur-xl`) to give the composer a floating, premium feel that separates it from the message feed
- Tighten vertical padding: `py-2` instead of `py-3` for a more compact bar

### 2. Input field
- Replace `bg-muted/15 border border-border/20 rounded-xl` with `bg-muted/10 border border-border/15 rounded-2xl` for a softer, rounder pill shape
- Increase vertical padding slightly (`py-3.5` for non-compact) for a more comfortable touch target
- Improve placeholder opacity: `placeholder:text-muted-foreground/35`
- Refine focus state: `focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary/25 focus:bg-muted/15` (thinner, subtler ring)
- Set `minHeight` to 46px (non-compact) for a taller, more inviting field

### 3. Send button
- Move outside the textarea container — place it as a sibling in the `flex items-end` row, to the right of the input, rather than absolutely positioned inside
- Use a 40x40 circular button (`rounded-full w-10 h-10`) with `bg-primary` when active, `bg-muted/20` when inactive
- Remove the motion AnimatePresence wrapper (simplify to a CSS transition: `transition-all duration-200`)
- Add `active:scale-90` press feedback
- Icon: white Send arrow when active, `text-muted-foreground/40` when inactive

### 4. Attach button (Plus)
- Change from `w-9 h-9 rounded-xl` to `w-10 h-10 rounded-full` to match send button sizing
- Improve inactive state: `text-muted-foreground/40 hover:text-muted-foreground/60 hover:bg-muted/15`
- Active (menu open): `bg-primary/10 text-primary`
- Align bottom with the input field baseline

### 5. Attach menu popup
- Add `backdrop-blur-lg` for frosted glass effect
- Slightly larger touch targets: `py-3 px-4` on menu items

### 6. Image preview strip
- Move inside a container with matching `rounded-2xl bg-muted/10 border border-border/10` to visually connect previews to the input
- Slightly larger thumbnails: `w-18 h-18` (72px)
- Improve remove button: `w-5 h-5` centered properly with ring styling

### 7. Mention dropdown
- Add `backdrop-blur-lg` to match attach menu
- Slightly increase row height for better touch targets

### 8. Bug fix
- Remove duplicate `return false;` on line 138

## Files Modified
1. **src/components/chat/MessageComposer.tsx** — all changes above

## Summary
- **Layout**: Composer bar gets a frosted-glass top border, send button moves outside the input as a circular action button
- **Input**: Softer pill shape, subtler focus ring, slightly taller for comfort
- **Controls**: Plus and Send buttons both circular 40px, visually balanced on either side of the input
- **Polish**: Backdrop blur on popups, smoother transitions, better inactive states
- **Edge cases to test**: Multiline expansion with external send button alignment, image preview strip with new layout, keyboard open/close on iOS and Android, mention dropdown positioning

