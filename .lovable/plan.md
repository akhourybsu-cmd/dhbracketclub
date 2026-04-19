

Refining the prior plan based on this new direction.

### Change
Instead of free-text topic entry, the higher seed picks from **3 AI-generated topic options**.

### Flow per match (QF, SF, each Finals game)
1. Match created by `advance-playoffs` with `status = 'awaiting_topic'`, `topic_picker_user_id` = higher seed, no draft yet.
2. Higher seed opens the match card → frontend invokes new `suggest-playoff-topics` edge function → returns 3 fresh AI-generated topic options (filtered against prior season topics for variety).
3. Picker taps one of the 3 chips → frontend invokes `start-playoff-match` with `{ matchId, topic }` → creates draft + participants (snake order randomized) → links `draft_id` → match status flips to `pending`.
4. Both players play. `advance-playoffs` scores winners and progresses rounds.

### Finals best-of-3
- `match_number` 1, 2, 3 in `round = 'final'`.
- Topic-picker rotation: M1 = higher overall seed, M2 = lower seed, M3 = higher seed.
- Each finals game gets its own 3 AI suggestions for that picker.
- Series winner = first to 2 match wins. Skip M3 if 2-0 sweep.
- Champion = series winner.

### Files

**Edge functions**
- DELETE `generate-playoff-draft` (auto-gen no longer fits the flow).
- NEW `suggest-playoff-topics`: input `{ seasonId, matchId }`. Pulls prior season topics + already-used playoff topics, asks Gemini for 3 fresh, fun "Top 5 ___" topic options, returns `{ topics: [string, string, string] }`. Does NOT persist.
- NEW `start-playoff-match`: input `{ matchId, topic }`. Verifies caller = `topic_picker_user_id`. Creates competition + draft (`num_rounds: 5`, `status: 'setup'`), inserts both users as `draft_participants` with Fisher-Yates random `pick_order`, links `draft_id`, sets match status to `pending`.
- UPDATE `advance-playoffs`: stop calling generate. Create matches in `awaiting_topic` state with `topic_picker_user_id` set. Add finals best-of-3 progression logic (count series wins, create next game with rotating picker, mark champion at 2 wins).

**Migration**
- Add column `topic_picker_user_id uuid` to `draft_playoff_matches` (nullable, references `auth.users`).

**Frontend**
- `useDraftSeasons.ts`: add `suggestPlayoffTopics(matchId)` and `startPlayoffMatch(matchId, topic)` helpers.
- `CompetePage.tsx` `PlayoffPicture`:
  - Match cards in `awaiting_topic` state:
    - If current user = picker: "Choose your matchup topic" CTA → opens dialog → on open, fetches 3 AI suggestions (with skeleton loader + "Regenerate" button to re-fetch) → tap a chip → confirm → calls `startPlayoffMatch` → triggers `advancePlayoffs`.
    - Otherwise: "Waiting for {pickerName} to choose topic" pill.
  - Finals column: stack up to 3 game cards with "Series 1–0" pill and clear which game is which.
  - Champion banner triggers when series clinched.

### Out of scope
- No free-text topic override.
- No category enforcement.
- No QF/SF format change (still single match each).

### QA
- QF auto-creates with #4 as picker → #4 sees 3 topic chips → picks one → draft starts.
- SF1 created with higher of {#1, QF winner} as picker → 3 chips → pick → play.
- Finals M1 picker = higher overall seed; M2 picker = lower seed; M3 (if needed) picker = higher seed.
- 2-0 sweep ends series, no M3, season → `complete`, champion recorded.
- 1-1 split creates M3, winner of M3 = champion.
- AI suggestions feel fresh (no repeat of season's regular drafts or prior playoff topics).

