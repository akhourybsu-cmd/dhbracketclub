
Goal: make the “who’s picking” indicator automatically show the correct next picker on the home screen and on the draft detail page, even when the stored draft row is stale.

What I found
- The database confirms the draft row is wrong for some active drafts:
  - “Best Comic Book Heroes” currently stores Hoosierdaddy, but based on 14 picks and the participant order, pick #15 should be Nick Boyle.
  - The same mismatch exists for “Top Sit Down Chain Restaurants” and “Top Video Game Franchises”.
- That means the root issue is not just UI refresh. The persisted `drafts.current_pick_user_id` is drifting behind the real turn order.
- The app already has a shared derived-turn helper in `src/lib/draftTurn.ts`, and Dashboard/Drafts List partially use it.
- `DraftDetailPage.tsx` still uses its own local turn math (`getExpectedPicker`, `currentRound`, `picks.length + 1`) instead of the shared helper.
- `CompetePage.tsx` still reads `current_pick_user_id` directly from the draft row, so it will definitely show stale names whenever the draft row is behind.
- The likely backend cause is that a pick can be inserted successfully, but the follow-up `drafts` update may not actually persist for some users; the current code does not verify that the draft row was truly updated.

Implementation plan
1. Make derived turn state the single source of truth in the UI
- Expand `getDerivedDraftTurn` slightly so it returns everything the UI needs consistently:
  - `current_pick_user_id`
  - `current_pick_profiles`
  - `current_pick_number`
  - `current_round`
  - optional convenience flags like `is_complete`
- Treat this derived result as authoritative for all in-progress draft displays.

2. Fix the home screen to never fall back to stale draft-row turn data
- In `DashboardPage.tsx`, keep hydrating drafts from `draft_participants` + `draft_picks`.
- Tighten the behavior so that for `in_progress` drafts:
  - if participant/pick hydration succeeds, show only the derived picker
  - do not display the stale `drafts.current_pick_*` values as a fallback
  - if hydration is not ready yet, temporarily hide the picker line rather than showing the wrong person

3. Replace Draft Detail’s duplicate math with the shared helper
- In `DraftDetailPage.tsx`, remove the local `getExpectedPicker` / `currentRound` logic as the display source.
- Compute the banner state from `getDerivedDraftTurn(draft, participants, picks.length)`.
- Use the derived values for:
  - “Your Turn”
  - “Waiting for [name]”
  - round number
  - pick number
  - turn ownership (`isMyTurn`)
- This guarantees the draft page and home screen use identical logic.

4. Fix any remaining draft surfaces still reading stale draft-row fields
- Update `CompetePage.tsx` to use the same derived hydration pattern instead of `current_pick_user_id` directly from `drafts`.
- Keep `DraftsListPage.tsx` aligned with the same no-stale-fallback behavior so every list/card says the same name.

5. Audit the pick submission path so the stored draft row stays in sync
- Review `handleMakePick` in `DraftDetailPage.tsx` and verify the post-pick `drafts` update is actually succeeding for all participants.
- If the current client-side update is not reliable, move that turn-advance step to a secure backend path so:
  - insert pick
  - compute next picker
  - update draft state
  all happen consistently together.
- Also add a stronger success check instead of assuming `update()` worked just because it returned no error.

6. Validate the delete/repick flow against the same source of truth
- Keep deletions and repicks using the same serpentine calculation as the shared helper.
- Ensure the banner and list cards immediately reflect the corrected picker after a removed pick.

Technical details
- Shared logic should be based on:
  - `totalPicks = count(draft_picks)`
  - participants ordered by `pick_order`
  - serpentine rule by round parity
- For example, with 5 participants and 14 picks:
  - next slot is pick #15
  - round index = `floor(14 / 5) = 2`
  - position in round = `14 % 5 = 4`
  - round 3 is forward order
  - participant index 4 = Nick Boyle
- Affected files:
  - `src/lib/draftTurn.ts`
  - `src/pages/DashboardPage.tsx`
  - `src/pages/DraftDetailPage.tsx`
  - `src/pages/DraftsListPage.tsx`
  - `src/pages/CompetePage.tsx`
- If the stored draft row is indeed failing to update for non-host pickers, I will also plan a backend-safe fix so the database stays correct instead of relying only on client derivation.

Expected result
- Home screen draft cards show the true next picker.
- Draft detail banner shows the same true next picker.
- No surface shows Hoosierdaddy when the real next turn belongs to Nick Boyle.
- The indicator updates automatically after each pick, deletion, or repick without manual refresh.
