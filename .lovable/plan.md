
# Fix Wall-E Enrichment + Admin Edit Access on Drafts

## Overview
Two changes: (1) fix the mismatched enrichment for the "Wall-e" draft pick so it shows the correct Pixar movie, and (2) add a frontend `isAppAdmin` check to `DraftDetailPage.tsx` so Alex K gets full edit/management access on all drafts — matching the RLS policies that already grant this at the database level.

## Changes

### 1. Fix Wall-E Enrichment (database migration)

The pick text is already "Wall-e" but the enrichment matched "Westler: East of the Wall" (wrong TMDB movie). Run a migration to reset this enrichment so re-enrichment picks up the correct movie:

```sql
UPDATE item_enrichments
SET matched_name = NULL, image_url = NULL, thumbnail_url = NULL,
    status = 'pending', metadata = '{}'::jsonb, confidence = 0
WHERE id = 'c5c0332d-c7e9-429f-b1e2-46fb415ea566';
```

After migration, trigger a re-enrich from the UI (or automatically) to fetch the correct WALL-E (2008 Pixar) images from TMDB.

### 2. Add `isAppAdmin` Check to DraftDetailPage.tsx

**Add state + fetch** (after `isCreator` declaration around line 154):
- Add `const [isAppAdmin, setIsAppAdmin] = useState(false);`
- Add a `useEffect` that calls `supabase.rpc('is_app_admin', { _user_id: user.id })` and sets the state
- Define `const canManage = isCreator || isAppAdmin;`

**Replace all `isCreator` UI gates with `canManage`**:
- Line 193: `handleStartDraft` guard
- Line 338: `handleDelete` guard  
- Line 386: `handleRemovePick` canRemove check
- Line 519: Re-enrich button visibility
- Line 537: More menu (edit/delete) visibility
- Line 674: Start draft button visibility
- Line 834: Pick remove button visibility
- Lines 1058, 1132: Regenerate results and pick remove in results view

This gives Alex K (who has the `admin` role in `user_roles`) full frontend access to edit topics, delete drafts, remove picks, re-enrich, start drafts, and regenerate reports on any draft — matching the existing RLS policies.

## Files Modified
1. **Database migration** — Reset the Wall-E enrichment to `pending`
2. **`src/pages/DraftDetailPage.tsx`** — Add `isAppAdmin` RPC check, replace `isCreator` with `canManage` across all UI gates

## Summary
- The Wall-E pick enrichment gets reset and can be re-enriched to show the correct Pixar movie
- Alex K gains full draft management access in the UI, consistent with the database-level admin permissions already in place
- No new tables or RLS changes needed — the `is_app_admin` function already exists
