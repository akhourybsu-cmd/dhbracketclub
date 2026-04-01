

## Fix Shared Media Duplicates and Add Management

### Problems Identified
1. **Duplicate inserts**: Links get inserted into `message_link_previews` in two places — once in `ChatPage.tsx` on send, and again in `LinkPreviewCard.tsx` when the preview renders. This causes 2-9x duplicates per link.
2. **No delete capability**: The RLS policy only allows deleting previews for the message author. There's no UI to remove items from the shared list.
3. **New channels work fine** for link detection (the code is channel-agnostic), but the duplicate issue makes it appear broken.

### Plan

#### 1. Database: Add unique constraint and clean up duplicates
- Add a migration with a unique constraint on `(message_id, url)` to prevent future duplicates
- Before adding the constraint, delete duplicate rows keeping only the most complete one (with title/description)
- Add an UPDATE RLS policy so users can manage previews on their own messages
- Add a broader DELETE policy so any authenticated user can remove shared media entries

#### 2. Prevent duplicate inserts in code
**`src/pages/ChatPage.tsx`**: Remove the fire-and-forget insert calls for YouTube/Spotify/image previews on send. The `LinkPreviewCard` component already handles fetching and caching previews when they render — this is the authoritative source.

**`src/components/chat/LinkPreviewCard.tsx`**: Add `ON CONFLICT DO NOTHING` (via `.upsert()` with `onConflict`) to all insert calls, so even if something slips through, no duplicates are created.

#### 3. Deduplicate in SharedMediaPage query
**`src/pages/SharedMediaPage.tsx`**: After fetching, deduplicate results by `(url, message_id)` client-side as a safety net. Also add a delete button (trash icon) on each media card that calls `supabase.from('message_link_previews').delete().eq('id', item.id)` and removes it from local state.

#### 4. Add swipe-to-delete or trash icon on MediaItemCard
**`src/pages/SharedMediaPage.tsx`**: Add a small trash button on each card. On tap, delete the preview row and remove from the list. Wrap the card content so the external link still works but the delete button is separate.

### Files Changed
| File | Change |
|------|--------|
| Migration SQL | Deduplicate existing rows, add unique constraint on `(message_id, url)`, add DELETE policy for all authenticated users |
| `src/pages/ChatPage.tsx` | Remove duplicate link preview inserts on message send |
| `src/components/chat/LinkPreviewCard.tsx` | Use upsert with `onConflict: 'message_id,url'` instead of plain insert |
| `src/pages/SharedMediaPage.tsx` | Client-side dedup + add delete button on each media card |

