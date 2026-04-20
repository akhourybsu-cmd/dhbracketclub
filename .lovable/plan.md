

## Rune Delve — focused QA & polish pass

### Issues found

**1. End-of-run overlay flicker (real bug)**
In `RuneDelvePlayPage`, `finalize()` calls `setEndState()` to show the outcome overlay, then awaits `submit.mutateAsync()` which invalidates `rune-delve-my-run`. The refetch returns the just-created row, which makes the early-return guard `if (myRun)` (line 53) re-render the page as the "You've delved today" card, blowing away the overlay before the 2.5s navigate timeout fires. The user briefly sees the overlay → then a stale "View Results" card flash → then results page.

**2. "Run Complete" label on results page is misleading**
`RuneDelveResultsPage` only labels the run as "Dungeon Cleared" or generic "Run Complete" — it never tells the user whether they were defeated or ran out of turns, even though the data is in `run` (`hp_remaining === 0` vs `turns_used === max_turns`). The play-page overlay distinguishes these; the results screen should too.

**3. Leaderboard preview on Home shows account name, not hero name**
Home page (line 207) renders `r.profile.display_name` for top‑3 rows. The full Leaderboard page correctly prefers `hero?.hero_name`. Inconsistent — and the whole point of the persistent‑hero pass is to surface the hero identity everywhere.

**4. Stats grid title says "HP Left" but value can be 0 on defeat with no context**
Minor — paired with fix #2, showing "Defeated" badge on the results header makes the 0 HP self‑explanatory.

**5. Empty viewport polish on Home loading state**
When `dungeon` resolves but `hero` is still loading, the user sees only two grey skeletons with no header/back‑link — feels like a broken page. Adding the back link inside the skeleton is a 2‑line fix.

### Fixes (smallest clean changes)

| File | Change |
|---|---|
| `src/pages/RuneDelvePlayPage.tsx` | Move the `if (myRun)` early-return so it does NOT trigger while `endState` is showing. Concretely: `if (myRun && !endState) { …existing card… }`. The overlay then stays mounted through navigation. |
| `src/pages/RuneDelveResultsPage.tsx` | Compute `outcome` from run data: `cleared` → "Dungeon Cleared" 🏆 / `hp_remaining === 0` → "Defeated" 💀 / else "Out of Turns" ⏳. Replace the generic label/emoji block (lines 64‑67) with the three‑way display. Tint accent border red for defeat. |
| `src/pages/RuneDelveHomePage.tsx` | In top‑3 leaderboard preview (line 207) prefer `r.hero?.hero_name ?? r.profile.display_name`, matching the full leaderboard page. |
| `src/pages/RuneDelveHomePage.tsx` | Loading-state JSX (line 110‑112) — add the `back-link` to `/compete` above the skeletons so the user can always escape. |

### Out of scope (verified working)

- Hero creation, naming (2–24 chars), class pick — DB row confirms persistence (`Ephrahim Cloudsinger`, mage, lvl 1, xp 21, streak 1, last_run_date populated).
- XP/streak/level math (`levelFromXp`, `xpForRun`, streak rollover via `last_run_date === yesterday`) — correct and idempotent.
- Combat engine — `endTurn` properly decrements turns on killing‑blow, no off‑by‑one. Diagonal `isAdjacent` correct.
- Gravity/refill in `boardEngine.resolveBoard` — verified bottom‑survivor stays at bottom, refill from top.
- Daily uniqueness — DB UNIQUE on `(user_id, dungeon_id)` plus client guard.
- Leaderboard fairness — no level‑gated stat boosts in scoring or combat; titles are cosmetic only (`titleForLevel`).
- How‑to‑Play sheet — accurate, dynamic per class, first‑visit auto‑open works.
- Mobile sizing — board cell auto-fits container down to 40px min, well within 411px viewport.

### Manual testing checklist

- Finish a run by HP → 0 → overlay reads "Defeated", results header reads "Defeated".
- Finish a run by clearing all enemies → overlay reads "Dungeon Cleared", confetti, results header matches.
- Finish a run by exhausting turns → overlay reads "Out of Turns", results header matches.
- Refresh `/rune-delve/play` after submitting → still routes back cleanly to "You've delved today" card.
- Home top‑3 leaderboard preview shows hero names (matching the full leaderboard).
- Home page during initial load → back link is visible.

