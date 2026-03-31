

## Image Selection for Draft Picks

### What This Does
When a draft pick is enriched, the system will fetch **multiple image candidates** from APIs instead of just the first result. Users can then:
1. **After picking**: See a selection dialog to confirm/choose the right image
2. **Post-draft**: Tap any pick's image to swap it from the available alternatives

### Plan

#### 1. Edge Function: Return multiple image candidates
**File**: `supabase/functions/enrich-draft-picks/index.ts`

- Modify `enrichFromiTunes`, `enrichFromDeezer`, `enrichFromMusicBrainz`, `enrichFromSportsDB`, `enrichFromOpenLibrary`, and `enrichFromWikipedia` to collect up to 5 alternative images (from the `limit=3` results already fetched, plus cross-source results)
- Store alternatives in `metadata.image_candidates` as an array: `[{ url, thumbnail, source, label }]`
- The primary image stays as-is (first/best match), but alternatives are preserved for user selection

#### 2. New Component: `ImagePickerDialog`
**File**: `src/components/draft/ImagePickerDialog.tsx` (new)

- A dialog/sheet showing a grid of image thumbnails from `enrichment.metadata.image_candidates`
- User taps one to select it as the primary image
- On confirm, updates the `item_enrichments` row with the chosen `image_url` and `thumbnail_url`
- Shows the current pick name and selected image highlighted

#### 3. Draft Detail Page: Wire up image tapping
**File**: `src/pages/DraftDetailPage.tsx`

- Add state for `imagePickerPick` (the pick being edited)
- Pass an `onClick` handler to `EnrichedItemCard` for picks that have `image_candidates` in their enrichment metadata
- When user selects a new image in the dialog, update the enrichment in the database and refresh local state
- Show a small camera/swap icon overlay on images that have alternatives available

#### 4. EnrichedItemCard: Visual indicator for swappable images
**File**: `src/components/EnrichedItemCard.tsx`

- When `onClick` is provided and enrichment has `image_candidates`, show a subtle swap icon overlay on hover/tap on the image thumbnail

### Database
No schema changes needed — `image_candidates` fits in the existing `metadata` JSONB column. The existing UPDATE RLS policy already allows draft pick owners to update their enrichments.

### Files
| File | Change |
|------|--------|
| `supabase/functions/enrich-draft-picks/index.ts` | Collect multiple image candidates from each API source |
| `src/components/draft/ImagePickerDialog.tsx` | New dialog for choosing from image alternatives |
| `src/pages/DraftDetailPage.tsx` | Add image picker state and wire onClick to enriched cards |
| `src/components/EnrichedItemCard.tsx` | Add swap icon overlay when alternatives exist |

