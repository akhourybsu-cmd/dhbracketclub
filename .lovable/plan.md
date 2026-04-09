

# Draft League System — Full Audit Report & Fix Plan

## PHASE 1 — SYSTEM INVENTORY

### Tables
| Table | Purpose |
|-------|---------|
| `drafts` | Draft metadata, status, turn state |
| `draft_participants` | Participants with `pick_order` |
| `draft_picks` | Individual picks with `pick_number`, `round` |
| `draft_results` | AI-scored results: `rank`, `total_score`, `pick_ratings`, `points_awarded` |
| `draft_seasons` | Season config: `regular_season_drafts`, `best_of`, `status` |
| `draft_season_entries` | Maps drafts to seasons with `week_number` |
| `draft_season_standings` | Per-user season stats: points, wins, podiums, avg_finish, etc. |
| `draft_playoff_matches` | Bracket matches with seeds, winners, status |

### Key Functions/Hooks
| Location | Purpose |
|----------|---------|
| `src/hooks/useDraftSeasons.ts` — `recalculateSeasonStandings()` | Client-side full standings recalc |
| `src/hooks/useDraftSeasons.ts` — `useLifetimeStats()` | Cross-season lifetime aggregation |
| `src/hooks/useDraftResults.ts` — `generateResults()` | Triggers edge function + client-side season recalc |
| `supabase/functions/rate-draft/index.ts` | AI scoring, result insertion, server-side season recalc |
| `src/lib/draftTurn.ts` | Snake-draft turn derivation |
| `src/lib/draftStats.ts` | MVP pick, streaks, timings, aggregate stats |
| `src/pages/CompetePage.tsx` | Season UI: standings, playoff bracket, history, lifetime stats |
| `src/pages/DraftDetailPage.tsx` | Draft play, start, pick removal, report trigger |
| `src/pages/DraftsListPage.tsx` | All-drafts list with cumulative user stats |
| `src/pages/ProfilePage.tsx` | Profile stats (draft points, wins, drafts rated) |

### Computed Live vs Stored
- **Stored**: `draft_results`, `draft_season_standings`, `draft_season_entries.season_points_awarded`
- **Computed live**: Turn state (`draftTurn.ts`), profile page stats, DraftsListPage stats, lifetime stats (queried on mount)

---

## PHASE 2 — DRAFT RESULT INTEGRITY

### Findings
1. **Draft completion detection** — Correct. `handleMakePick` checks `pickNumber >= totalExpected` and sets status to `complete`.
2. **Placement assignment** — The edge function re-ranks using a 5-level tiebreaker cascade (total_score → highest pick → elite count → min pick → avg → timestamp). This is sound and doesn't trust AI-assigned ranks.
3. **`points_awarded` (draft points)** — Uses `Math.max(1, numParticipants - idx)`, which for 5 players gives 5/4/3/2/1. This is the **draft points** system (distinct from season points). Correct.
4. **Duplicate prevention** — Edge function calls `DELETE` before `INSERT` on `draft_results` for the same `draft_id`. Safe for regeneration.
5. **Status gate** — Edge function checks `draft.status !== 'complete'` before proceeding. Correct.

### Issue Found: No guard against concurrent report generation
If two participants simultaneously trigger `generateResults()` (e.g., both see the draft complete), both calls hit the edge function. The DELETE+INSERT is not atomic, so there's a brief window where one could delete the other's results. **Low risk** in practice (race window is small, and results would be identical), but worth noting.

---

## PHASE 3 — SEASON PROGRESSION

### Findings
1. **Season model** — Draft-count based. `regular_season_drafts=12`, `best_of=10`. Correct.
2. **Season assignment** — Commissioner manually adds drafts via `addDraftToSeason()`. Auto-numbered with `week_number`.

### Issues Found

**BUG 1: `week_number` starts at 2, not 1**
Current data shows `week_number` values: 2, 3, 4, 5, 6, 7, 8, 9. Draft #1 was apparently removed at some point and the renumbering function didn't run, or it was added starting at 2. The `removeDraftFromSeason` function calls `renumberSeasonEntries` but there may have been a gap from the initial setup.

**Impact**: Cosmetic only — the UI shows "Draft #2 of 12" as the first entry. The season progress counter uses `completedDrafts` count (not week_number), so standings math is unaffected.

**BUG 2: Standings are stale — not reflecting all completed drafts**
The standings show 5 `drafts_played` but there are 6 completed drafts with results (Video Games, Restaurants, Comic Book Heroes, 90s Bands, Board Games, Sugar Candies). The stored standings haven't been recalculated since Board Games and Sugar Candies were rated.

Verified by SQL: true season points should be Tacooo=47, Hoosierdaddy=34, Nick Boyle=31, Alex K.=25, MGMgrandiose=25. Stored values are Tacooo=42, Hoosierdaddy=24, etc.

**Root cause**: The server-side recalc in `rate-draft` was added recently, and these drafts were either rated before the code was deployed, or the recalc failed silently. The client-side fallback also depends on the code being present at time of report generation.

**BUG 3: `season_points_awarded` is empty for newer entries**
Sugar Candies and Board Games entries have `season_points_awarded: {}` despite having results. This field is only updated during `recalculateSeasonStandings()`, confirming it hasn't been called for those drafts.

**BUG 4: No automated season status transition**
Nothing in the code transitions a season from `regular_season` → `playoffs` → `complete`. This is entirely manual. When 12 drafts are completed, the UI shows "Regular Season Complete" but the season `status` column remains `regular_season`. There's no code to generate playoff matches automatically.

---

## PHASE 4 — STANDINGS / POINTS

### Findings
1. **Season points scale** — 1st:10, 2nd:7, 3rd:5, 4th:3, 5th:2, 6th+:1. Duplicated in 3 places (useDraftSeasons.ts, rate-draft edge function, seasonUtils.ts). All consistent.
2. **Best-of-N** — `recalculateSeasonStandings` sorts each user's season-point awards descending and takes the top `best_of` (10). Correct.
3. **Tie handling** — Standings rank uses simple comparison: tied season_points get same rank. `playoff_seed` uses array index (i+1), meaning ties get different seeds. This is intentional per the 5-player model.

### Issue Found

**BUG 5: Tied standings produce arbitrary seed ordering**
When two users have equal season_points (currently Alex K. and MGMgrandiose both at 25 real points), the sort is stable but has no secondary tiebreaker. Whoever appears first in the `Map` iteration gets the higher seed. The `recalculateSeasonStandings` function sorts only by `season_points` with no secondary sort criteria.

**Fix needed**: Add tiebreaker criteria to standings sort: wins → podiums → avg_finish → avg_score.

---

## PHASE 5 — PLAYOFF

### Findings
1. **Playoff bracket structure** defined in UI only (CompetePage.tsx): Play-In (4v5), Semi1 (1 vs Play-In winner), Semi2 (2v3), Championship, 3rd Place.
2. **`draft_playoff_matches`** table exists but **no code generates matches automatically**. The `usePlayoffMatches` hook just reads them.
3. **No playoff match advancement logic exists** — no code to update `winner_user_id`, advance winners to next round, or finalize championship results.

### Issues Found

**BUG 6: Playoff system is display-only — no implementation**
The playoff bracket in CompetePage shows a static visual wireframe with seed labels, but there's no flow to:
- Generate playoff match records when regular season ends
- Link a playoff draft to a match
- Record match winners
- Advance winners through the bracket
- Mark season as complete

This is a **feature gap**, not a bug per se, but it means playoff data will never populate without manual database intervention.

---

## PHASE 6 — SEASON STATS

### Findings
All per-season stats (season_points, wins, podiums, avg_finish, avg_score, best_score, worst_score, consistency) are calculated in `recalculateSeasonStandings()` and stored in `draft_season_standings`.

### Issue: Stats correct in logic but stale in practice
As documented in BUG 2, the stored standings don't reflect the latest completed drafts. The calculation logic itself is correct — verified by comparing the SQL query results against the function logic.

---

## PHASE 7 — LIFETIME STATS

### Findings
`useLifetimeStats` queries all `draft_season_standings` rows for a user across all seasons, plus playoff finals wins. It computes:
- totalSeasons, totalWins, totalPodiums, totalPlayoffs, totalChampionships, avgSeasonFinish, bestSeasonPoints

### Issues Found

**BUG 7: Lifetime stats inherit staleness from season standings**
Since lifetime stats are derived from `draft_season_standings`, they're only as accurate as the last recalculation. Currently showing wrong totals.

**BUG 8: `avgSeasonFinish` uses `rank` from standings which may be null**
The code filters `rows.filter(r => r.rank)` but since rank could be 0 (falsy), this would incorrectly exclude it. In practice ranks start at 1, so this is not currently triggered but is a latent bug.

---

## PHASE 8 — UI / DISPLAY CONSISTENCY

### Findings
1. **CompetePage standings** — Reads from `draft_season_standings`. Stale per BUG 2.
2. **ProfilePage stats** — Reads directly from `draft_results` (points_awarded, rank). These are **always fresh** since they query the source of truth. Correct.
3. **DraftsListPage stats** — Also reads directly from `draft_results`. Correct and fresh.
4. **CompetePage season progress** — Counts `entries.filter(e => !e.is_playoff && e.drafts?.status === 'complete').length`. This correctly shows 6/12 for the current data. Correct.

### Issue Found

**BUG 9: Display mismatch between pages**
ProfilePage and DraftsListPage show accurate draft-level stats (queried live from `draft_results`), but CompetePage standings show stale season-level stats. Users could see "3 wins" on their profile but different numbers on the Compete page.

---

## PHASE 9 — EDGE CASES

1. **Abandoned/cancelled drafts** — Only `complete` drafts get results. Edge function gates on `status !== 'complete'`. Safe.
2. **Draft with removed picks** — `handleRemovePick` correctly renumbers and rewinds draft state. If a complete draft has a pick removed, it goes back to `in_progress`. Existing results would become stale but this is an intentional design choice (commissioner can regenerate report).
3. **Duplicate submission** — Edge function's DELETE-then-INSERT pattern handles regeneration. Safe.
4. **Player missing a draft** — Season standings only count drafts where the user has results. A user who skips a draft simply has fewer entries. With best-of-10, this is naturally handled.
5. **Multiple rapid drafts** — No issues; each draft is independent.

### Edge Case Issue

**BUG 10: Deleting a draft doesn't trigger season standings recalc**
`handleDelete` in DraftDetailPage deletes `draft_season_entries` but doesn't call `recalculateSeasonStandings()`. If a season-eligible draft is deleted, standings remain stale until the commissioner manually removes/re-adds another draft.

---

## PHASE 10 — FIX PLAN

### Priority 1: Fix stale standings (BUG 2, 3, 7, 9)
- **One-time data fix**: Run `recalculateSeasonStandings` for the current season to bring standings up to date.
- **Code fix**: The server-side recalc in `rate-draft` is already in place. Add a safeguard: on CompetePage mount, if standings `drafts_played` < count of completed season entries with results, trigger a recalc.

### Priority 2: Fix week_number gap (BUG 1)
- Run `renumberSeasonEntries` for the current season to close the gap (2,3,4... → 1,2,3...).

### Priority 3: Add standings tiebreaker (BUG 5)
- In `recalculateSeasonStandings` (both client-side and edge function), add secondary sort: `wins desc → podiums desc → avg_finish asc → avg_score desc` before assigning playoff seeds.

### Priority 4: Fix draft deletion not recalcing (BUG 10)
- After deleting `draft_season_entries` in `handleDelete`, call `recalculateSeasonStandings` for the season.

### Priority 5: Prevent concurrent report generation race
- Add a check at the start of `generateResults`: if results already exist after a brief re-fetch, skip calling the edge function.

### Not fixing (feature gaps, not bugs):
- Playoff match generation/advancement — this is unbuilt functionality, not broken logic. Would require a separate feature request.
- Automated season status transitions — same; currently commissioner-managed.

---

## FINAL SUMMARY

### 1. Current Stat Tracking Inventory
- **Draft-level**: rank, total_score, pick_ratings, points_awarded, summary — stored in `draft_results`
- **Season-level**: season_points, drafts_played, wins, podiums, avg_finish, avg_score, best/worst_score, consistency, rank, playoff_seed — stored in `draft_season_standings`
- **Per-entry**: season_points_awarded — stored in `draft_season_entries`
- **Lifetime**: Computed live from `draft_season_standings` + `draft_playoff_matches`
- **Profile/list stats**: Computed live from `draft_results`

### 2. Issues Found
1. **Stale standings** — Standings haven't been recalculated for 2 completed drafts (Board Games, Sugar Candies). All season-derived stats are wrong.
2. **Week numbering gap** — Entries start at week 2 instead of 1.
3. **No standings tiebreaker** — Tied users get arbitrary seed ordering.
4. **Draft deletion doesn't recalc** — Deleting a season draft leaves standings stale.
5. **Playoff system is unimplemented** — Bracket display exists but no match generation, winner recording, or advancement logic.
6. **Possible concurrent report race** — Two participants can trigger report generation simultaneously.

### 3. Fixes to Implement
1. Trigger one-time standings recalculation for current season (data fix)
2. Renumber season entries to start at 1
3. Add multi-factor tiebreaker to standings sort in both `recalculateSeasonStandings` and `rate-draft` edge function
4. Add standings recalc call after draft deletion
5. Add auto-recalc guard on CompetePage when stored standings appear stale
6. Add early-exit check in `generateResults` when results already exist

### 4. Remaining Concerns
- Playoff match generation/advancement is completely unbuilt — will need a dedicated feature pass
- Season status transitions (regular_season → playoffs → complete) are manual
- The season points scale is duplicated in 3 places — could be consolidated but low risk

### 5. Manual Testing Checklist
- [ ] Open Compete page → verify standings show 6 drafts played with correct points (Tacooo: 47, Hoosierdaddy: 34, Nick Boyle: 31)
- [ ] Verify week numbers display as #1 through #8 (not #2 through #9)
- [ ] Complete "Best Sandwiches" draft → verify standings auto-update to 7 drafts
- [ ] Delete a test draft that's in a season → verify standings recalculate
- [ ] Check ProfilePage stats match DraftsListPage stats
- [ ] Verify tied users (Alex K. and MGMgrandiose) have deterministic seed ordering

### 6. Readiness Assessment
The draft scoring engine and AI report system are **solid and correct**. The core logic for calculating standings is also correct — the problem is exclusively about **when recalculation happens**. The fixes above address the timing/staleness issues with minimal changes. After applying them, the stat-tracking system will be accurate and self-healing. The playoff system remains a known feature gap that doesn't affect regular-season integrity.

