

## Plan: Delete & Repick for Duplicate Draft Picks

### Problem

Green Day was picked at #5 (Hoosierdaddy) and again at #9 (Alex K.) — the duplicate slipped through before the hard block was deployed. There's currently no way for anyone to undo a bad pick. The user wants the draft creator or the picker to be able to delete a pick and let the affected person repick.

### How It Works (User-Facing)

1. Each pick card during a live draft gets a small **trash icon** visible only to the **draft creator** or the **person who made that pick**
2. Tapping it opens a confirmation dialog: *"Remove this pick? [Player] will get to repick."*
3. On confirm:
   - The pick is deleted from the database (along with its enrichment)
   - All subsequent picks are renumbered (pick_number decremented)
   - The draft's `current_pick_number`, `current_round`, and `current_pick_user_id` are recalculated to point to the person who lost their pick — it becomes their turn again
   - A toast confirms: *"Pick removed. It's now [Player]'s turn to repick."*
4. The realtime subscription fires, all participants see the updated board instantly

For **completed drafts**: the creator can still remove a pick, but no repick slot opens — it simply deletes the entry and renumbers.

### Immediate Data Fix

Delete Alex K.'s duplicate Green Day pick (#9) and recalculate the draft state so it becomes Alex K.'s turn at pick #9 again.

---

### Technical Details

**Database changes:**
- Add an RLS UPDATE policy on `draft_picks` so the creator or picker can update `pick_number` (needed for renumbering)
- Add a DELETE policy for the picker themselves (currently only the creator can delete picks)

**Migration SQL:**
```sql
-- Let the picker delete their own picks
CREATE POLICY "Users can delete own picks"
ON public.draft_picks FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Let creator or picker update pick numbers (for renumbering)
CREATE POLICY "Creator or picker can update picks"
ON public.draft_picks FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM drafts WHERE drafts.id = draft_picks.draft_id AND drafts.created_by = auth.uid())
);
```

**DraftDetailPage.tsx changes:**
- Add `handleRemovePick(pick)` function that:
  1. Deletes the pick's enrichment from `item_enrichments`
  2. Deletes the pick from `draft_picks`
  3. Renumbers all subsequent picks (decrement `pick_number`, recalculate `round`)
  4. Updates the draft's `current_pick_number`, `current_round`, `current_pick_user_id` to give the affected user their turn back
  5. Calls `fetchData()` to refresh
- Add a confirmation AlertDialog for pick removal
- Add a trash icon button on each `EnrichedItemCard` (visible to creator or the picker, only during in-progress drafts)

**Data fix:**
- Delete the duplicate Green Day pick (id: `54ca0d7f-5934-44fe-9a17-1db1c1d40141`)
- Update the draft state: `current_pick_number = 9`, recalculate `current_pick_user_id` to Alex K.

### Files Changed

| File | Change |
|------|--------|
| New migration SQL | Add DELETE + UPDATE RLS policies on `draft_picks` |
| `src/pages/DraftDetailPage.tsx` | Add remove-pick handler, confirmation dialog, trash button on pick cards |
| Database data fix | Delete duplicate Green Day pick, reset draft turn state |

