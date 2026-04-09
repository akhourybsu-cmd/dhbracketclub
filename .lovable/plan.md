

# Auto-Update Season Standings When Drafts Complete

## Problem
When a season-eligible draft finishes and gets rated, **season standings are never automatically recalculated**. The `recalculateSeasonStandings` function is only called when the commissioner manually adds/removes a draft from the season on the Compete page. This means standings, points, wins, podiums, and averages go stale until someone triggers a manual refresh.

## Root Cause
- The `rate-draft` edge function inserts `draft_results` rows but has no knowledge of seasons
- The `useDraftResults.generateResults()` callback in DraftDetailPage calls the edge function and fetches results, but never checks if the draft belongs to a season
- The DraftsListPage fetches stats from `draft_results` directly but doesn't refresh season standings
- The CompetePage standings hooks (`useSeasonStandings`, `useSeasonEntries`) only fetch once on mount with no realtime or event-driven refresh

## Fix

### 1. Auto-recalculate standings after results are generated (DraftDetailPage)
In `useDraftResults.ts`, after `generateResults()` successfully fetches new results, check if the draft belongs to a season entry. If so, call `recalculateSeasonStandings` automatically.

### 2. Auto-recalculate standings in the edge function itself (rate-draft)
Add season-awareness to the `rate-draft` edge function: after inserting `draft_results`, check if the draft has a `draft_season_entries` row. If so, run the standings recalculation server-side using the service role client. This ensures standings update even if the client-side call is interrupted.

### 3. Refresh standings on CompetePage mount and after navigation
Make `useSeasonStandings` and `useSeasonEntries` re-fetch when the user navigates to the Compete page (they currently only fetch once due to empty dependency arrays effectively). Add a refetch on visibility/focus.

## Technical Details

**`supabase/functions/rate-draft/index.ts`** — After inserting draft_results (line ~284), add:
```typescript
// Check if this draft is part of a season
const { data: seasonEntry } = await admin
  .from('draft_season_entries')
  .select('season_id')
  .eq('draft_id', draft_id)
  .maybeSingle();

if (seasonEntry?.season_id) {
  // Recalculate season standings server-side
  // (inline the recalculation logic using the admin client)
}
```

**`src/hooks/useDraftResults.ts`** — After `fetchResults()` succeeds in `generateResults`, check season membership and trigger client-side recalc as a fallback:
```typescript
// After fetchResults()
const { data: entry } = await supabase
  .from('draft_season_entries')
  .select('season_id')
  .eq('draft_id', draftId)
  .maybeSingle();
if (entry?.season_id) {
  await recalculateSeasonStandings(entry.season_id);
}
```

**`src/pages/CompetePage.tsx`** — Call `refetchStandings()` and `refetchEntries()` on page focus/visibility change so returning to the page always shows fresh data.

## Files Modified
1. **`supabase/functions/rate-draft/index.ts`** — Add server-side season standings recalculation after results insertion
2. **`src/hooks/useDraftResults.ts`** — Add client-side season recalc after generating results
3. **`src/pages/CompetePage.tsx`** — Add visibility-based refetch for standings and entries

