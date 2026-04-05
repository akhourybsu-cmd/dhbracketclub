

# Commissioner Controls for Season-Eligible Drafts

## What We're Building
A commissioner role for the Draft League that gives you (the logged-in user who created the season) authority to mark any draft as "season-eligible" — meaning it counts toward the 12 regular-season drafts. Drafts not marked season-eligible still track stats normally but don't count toward season standings.

Currently, drafts get manually assigned to a season via the `draft_season_entries` table, but there's no UI for a commissioner to manage this. There are 3 drafts in setup right now (Best Animated Films, Best Board Games, Best Mortal Kombat) with no season assignment.

## Data Model

**Add `commissioner_user_id` column to `draft_seasons`**
- UUID referencing who controls the season
- Set to your user ID for the current Spring 2026 season
- The commissioner is the user who can assign/unassign drafts to the season

**No other schema changes needed.** The existing `draft_season_entries` table already serves as the link between drafts and seasons — the commissioner UI simply controls which drafts get rows in that table.

## Commissioner Logic

- Commissioner = `draft_seasons.commissioner_user_id`
- Only the commissioner can:
  - Mark a draft as season-eligible (insert into `draft_season_entries`)
  - Remove a draft from the season (delete from `draft_season_entries`)
  - The draft number (`week_number`) is auto-assigned sequentially based on existing entries
- All users can still create drafts freely — they just aren't season-eligible until the commissioner says so

## UI Changes

### 1. Commissioner Panel on CompetePage (League tab)
Below the Season Hero banner, if the current user is the commissioner, show a "Commissioner" section with:
- A list of **unassigned drafts** (drafts not in `draft_season_entries` for this season) — each with a button to "Add to Season"
- A count of how many season slots remain (e.g., "7 of 12 slots filled")
- Ability to remove a draft from the season from the Draft History section

### 2. Season-Eligible Badge on DraftDetailPage
- If a draft is part of the current season, show a gold "Season Draft #X" badge
- If the user is the commissioner and the draft is NOT in the season, show an "Add to Season" button
- If the user is the commissioner and the draft IS in the season, show a "Remove from Season" option in the more menu

### 3. DraftsListPage Indicator
- Show a small gold dot or "S" badge on drafts that are season-eligible

## Implementation Steps

1. **Migration**: Add `commissioner_user_id` to `draft_seasons`, set it to your user ID for Spring 2026
2. **Hook**: Add `useIsCommissioner()` helper that checks if current user is the commissioner for the active season
3. **CompetePage**: Add commissioner panel showing unassigned drafts with "Add to Season" / "Remove" controls
4. **DraftDetailPage**: Add season badge + commissioner add/remove actions
5. **DraftsListPage**: Add season-eligible indicator
6. **Auto-numbering**: When commissioner adds a draft, auto-assign the next sequential `week_number`

## Key Rules
- Only completed official drafts count toward season standings (existing logic preserved)
- Canceled/abandoned drafts can be removed by commissioner
- Playoff drafts are separate (existing `is_playoff` flag)
- All draft scoring/AI reports work identically regardless of season eligibility
- Stats are always tracked — season eligibility only affects season standings

