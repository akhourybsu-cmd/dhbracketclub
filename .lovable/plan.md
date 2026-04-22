

## Playoffs — auto-advance when matches finish, polish completion graphics

### What works today

- **Draft → match → next round chain** is correctly implemented in `advance-playoffs`: when a playoff draft flips to `complete`, the function reads `draft_results`, picks the highest `total_score` as winner, sets `winner_user_id` + `status = 'complete'` on the match, then generates the next round (Semis after QF, Finals G1 + 3rd Place after Semis, additional Finals games until best-of-3 clinch), then flips season → `complete` on series clinch.
- **Bracket UI** in `PlayoffPicture` already renders trophies on winners, "Final" badges on completed matches, a series score for the Bo3 final, and a champion banner with gold gradient.
- **3rd-place game** auto-spawns when both Semis are decided and is shown in its own bronze section.
- **Topic picker UI** is wired and gated to the higher seed.

### The actual gaps

1. **Auto-advance is only triggered on the Compete page.** `advancePlayoffs(season.id)` runs in a `useEffect` on `CompetePage` mount/visibility. When a playoff draft completes on the Draft Detail page (where it actually finishes), nothing kicks off match scoring or next-round generation. The match sits in `pending` with no `winner_user_id` and the bracket doesn't progress until someone happens to open `/compete`.

2. **Match status doesn't reflect `in_progress`.** When a draft starts (`drafts.status` → `in_progress`), the linked `draft_playoff_matches` row stays at `pending`, so the bracket card shows "Pending" instead of "Live" until the draft is fully complete (then it jumps straight to "Final"). Minor but confusing.

3. **No champion confetti / season-complete celebration on the Draft Detail page.** When the deciding Finals game completes, the user who wins the championship currently sees the standard draft-complete report. No "🏆 Season Champion!" framing on the draft page itself, even though the bracket banner exists on `/compete`.

4. **`is_eliminated` flag never set on standings.** `draft_season_standings.is_eliminated` exists in the schema but `advance-playoffs` never updates it. After a match completes the loser should be flagged so leaderboard/UI can grey them out. (Currently nothing reads this either, so this is a smaller cleanup.)

### Fix

**A) Auto-trigger advance from the Draft Detail page when a playoff draft completes.** In `src/pages/DraftDetailPage.tsx`:
- After `generateResults()` finishes (or whenever `draft.status === 'complete' && isPlayoffDraft && hasResults`), call `advancePlayoffs(season.id)` exactly once. Add a small `useEffect` keyed on `[draft?.status, isPlayoffDraft, hasResults, season?.id]` with a `playoffsAdvanced` ref guard. This is idempotent server-side, so safe to call on any visit.
- Also fire a one-shot `advancePlayoffs` immediately after the local `setStatus('complete')` write in the pick-completion block (`line 384`) so the next round is queued before the user even sees the report.

**B) Sync match status to `in_progress` when its draft starts.** Two surgical updates in `advance-playoffs/index.ts` Phase 2 loop: when iterating matches that have a `draft_id`, also handle the case where `draftRow.status === 'in_progress'` and `m.status === 'pending'` → update match to `in_progress`. The existing `complete` path stays. Bracket cards now correctly read "Live" while the draft is being played.

**C) Mark losers eliminated.** In Phase 2 of `advance-playoffs`, right after writing the winner, also update the loser's `draft_season_standings.is_eliminated = true`. Pure data hygiene; the UI already has space for it but doesn't render it yet — out of scope to add the styling, just write the flag so it's available.

**D) Champion celebration on the Draft Detail page.** In `DraftDetailPage`, when `isDraftComplete && isPlayoffDraft && hasResults`:
- Look up the corresponding `draft_playoff_matches` row by `draft_id`. If `round === 'final'` and that win clinches the series (winner has 2 final wins), render a gold "🏆 Season Champion!" banner above the report header with the winner's name and trigger `<Confetti>` once.
- For non-clinching playoff drafts, show a smaller "Round Won — advancing to [Semis/Finals/3rd Place]" badge.
- Use the existing `Confetti` component already imported on this page.

**E) Backfill safety for the live Season 1 Play-In.** Once the auto-advance from DraftDetailPage is in place, the current QF awaiting topic flows naturally: MGMgrandiose picks topic → `start-playoff-match` creates draft → both play → on completion, advance fires immediately and Semis are generated on the spot.

### Files touched

- `src/pages/DraftDetailPage.tsx` — add `advancePlayoffs` import, post-completion auto-advance effect + immediate call after the final pick, champion banner + confetti when applicable.
- `supabase/functions/advance-playoffs/index.ts` — extend Phase 2 to (a) flip `pending` → `in_progress` when draft is `in_progress`, and (b) write `is_eliminated = true` for the losing user when scoring a complete match.
- Deploy `advance-playoffs`. No DB migration; `is_eliminated` column already exists.

### Verification

- Open the Season 1 QF (once MGMgrandiose picks a topic and the play-in draft starts) — bracket card shows "Live" while picks are being made, not "Pending".
- Finish that play-in draft on the Draft Detail page — within seconds, the QF row gets `winner_user_id` + `status = 'complete'`, both Semis appear in the bracket awaiting topics, and the loser's standings row has `is_eliminated = true`. No need to navigate to Compete.
- Win the deciding Finals game — Draft Detail page shows a gold "🏆 Season Champion!" banner with confetti, and the season auto-flips to `complete`.
- Lose the deciding Finals game — see "Round Won — Series 2-1" style framing on the winner's screen, normal report on the loser's screen.
- Calling `advance-playoffs` repeatedly on the same season is still safe (all writes remain idempotent).

