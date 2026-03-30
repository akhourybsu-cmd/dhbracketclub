

## Channel List Spacing & Channel Management

### 1. Add padding/whitespace to channel list container

The `ChannelList` component has no horizontal padding — the content sits flush against the edges. On mobile (where it takes the full screen width), this looks cramped.

**Fix**: Add `px-4` padding to the outer wrapper div in `ChannelList.tsx` (line 42). This gives breathing room on all sides, especially on mobile.

Also add slight top padding (`pt-2`) so the "Chat" header isn't jammed against the top edge.

### 2. Edit channel names

Add a long-press / context-menu action on each channel row in `ChannelList`:
- Show an inline edit mode (replace channel name text with an `Input` field)
- On confirm, update the channel name in the `channels` table via `supabase.from('channels').update({ name }).eq('id', ch.id)`
- Add an `onEditChannel` callback prop to `ChannelListProps` and implement the handler in `ChatPage.tsx`
- Show a small pencil icon or "..." menu on hover/long-press to trigger edit mode

### 3. Reorder channels via drag-and-drop

- Use `framer-motion`'s `Reorder` components (`Reorder.Group` + `Reorder.Item`) which are already available (framer-motion is installed)
- Wrap each category's channel list in `<Reorder.Group>` and each channel row in `<Reorder.Item>`
- On reorder complete, update the `position` column for each affected channel via a batch update
- Add an `onReorderChannels` callback prop and implement the DB update in `ChatPage.tsx`
- Add a subtle drag handle (grip dots icon) visible on the left side of each channel row when in an "edit mode" or always subtly visible

### Files to modify

| File | Change |
|------|--------|
| `src/components/chat/ChannelList.tsx` | Add `px-4 pt-2` padding, edit-in-place UI, `Reorder.Group`/`Reorder.Item` for drag reorder, new props |
| `src/pages/ChatPage.tsx` | Add `handleEditChannel` and `handleReorderChannels` handlers with Supabase update calls |
| `src/components/chat/types.ts` | No changes needed (Channel type already has `position`) |

### Technical notes

- `Reorder` from framer-motion handles drag-and-drop with smooth animations out of the box — no new dependencies needed
- Channel position updates use `Promise.all` with individual `.update()` calls for each repositioned channel
- Edit mode uses local state in `ChannelList` — toggled per channel via a small "..." dropdown or pencil icon

