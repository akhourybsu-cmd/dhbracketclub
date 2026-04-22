

## Rune Delve replay — fix score persistence and add replay-aware stats

### The bug (root cause)

The submit flow in `useSubmitLevelRun` (`src/hooks/useRuneDelveCampaign.ts`) is correct in principle: it reads `existing` and only overwrites when `params.score > existing.score`. But on the **Play page**, `existingRun` is fed by `useMyLevelRun(level?.id)` which is cached by React Query. Two real-world failure modes:

1. **`isNewBest` is computed from a stale `existingRun`.** After a player retries from Results → Play, the `rune-delve-level-run` cache may still hold an older `null`/lower-score row, so `isNewBest` is `true`, hero/class lifetime stats get incremented again, but the DB write *correctly* keeps the previous best — which is exactly the "I beat my old score but it didn't save" feeling (and inversely, lifetime totals double-count).
2. **Score-tie path silently drops the new run's better secondary stats.** When `existing.score >= params.score`, the function only updates `ability_used` and ignores `enemies_defeated`, `longest_chain`, `hp_remaining`, `dungeon_cleared`, etc. So a tied-score run that cleared the dungeon for the first time, or chained higher, is invisible.
3. **No replay attempt count or "best-by-stat" tracking.** The row is a single best-by-score snapshot. Players have no sense of "I beat this 4 times" or "my fastest clear was X turns."

### What this builds

**A. Fix the persistence + cache bug (smallest possible change)**
- In `useSubmitLevelRun`, always **merge each stat as a per-stat best**: the saved row should reflect (max score, max enemies_defeated, max longest_chain, max hp_remaining, **min** turns_used among clears, `dungeon_cleared = existing || new`). Score still drives `isNewBest`/XP.
- Force-invalidate `['rune-delve-level-run', level.id]` *immediately on Play page mount* (mirroring what Results already does), so a fresh `existingRun` is always the basis for `isNewBest` comparisons. Belt-and-suspenders: also re-read the row inside the mutation (already happens) and return the actual saved score so the page can trust the server's verdict.
- Compute `isNewBest` from the **mutation's returned row** (server truth), not the pre-mutation `existingRun`. This kills the stale-cache double-count of hero `lifetime_runs`/`lifetime_score`.

**B. Add replay-aware stats (new columns on `rune_delve_runs`)**
Migration adds five small columns, all with sensible defaults:
- `attempts` int default 1 — total times this level was played to completion (any outcome).
- `clears` int default 0 — total successful clears.
- `best_turns_used` int nullable — fastest clear (lower is better; only updated on clears).
- `best_hp_remaining` int default 0 — highest HP-left on any clear.
- `last_played_at` timestamptz default now() — timestamp of most recent attempt.

The submit path increments `attempts` every run, increments `clears` when `dungeon_cleared`, and updates `best_*` columns only when the new run improves them. `score`, `longest_chain`, and `enemies_defeated` continue as best-of (no regression). The existing `score`/`xp_earned`/`completed_at` semantics are preserved so all leaderboards keep working.

**C. Surface the new stats on the Results page** (mobile-first, no layout overhaul)
- Add a small **"Personal Best Tracker"** strip below the score block showing: `Best Score`, `Best Chain`, `Fastest Clear` (turns), `Attempts`, `Clears`.
- When the just-played run improves any *secondary* stat (e.g. faster clear, better chain) but not the score, show a soft chip: *"⚡ New fastest clear — 12 turns"* / *"🔗 New longest chain — 7"*. Replaces the binary "New best score!" tag with something that recognizes meaningful replay progress.
- The existing star rating + "New best score!" line keeps working unchanged.

**D. Surface replay activity on the History page**
`RuneDelveHistoryPage` already lists per-level bests. Add a small `· {clears}/{attempts}` chip next to each level row so the player sees their replay activity at a glance.

### Files touched

- **Migration**: add `attempts`, `clears`, `best_turns_used`, `best_hp_remaining`, `last_played_at` to `rune_delve_runs`. Backfill existing rows: `attempts = 1`, `clears = (dungeon_cleared ? 1 : 0)`, `best_turns_used = (dungeon_cleared ? turns_used : null)`, `best_hp_remaining = hp_remaining`, `last_played_at = completed_at`.
- **`src/hooks/useRuneDelveCampaign.ts`** — rewrite `useSubmitLevelRun` mutation to do a single merged upsert with per-stat best logic and increment `attempts`/`clears`. Return the saved row (with a `wasNewBest` flag) so callers can trust server truth.
- **`src/pages/RuneDelvePlayPage.tsx`** — (1) on mount, invalidate `['rune-delve-level-run', level.id]`; (2) after `submit.mutateAsync(...)`, derive `isNewBest` (and new "improved" flags for chain/turns) from the returned row, and only then bump hero `lifetime_runs`/`lifetime_score`. Pass the improvement flags into `endState` so Results can show them.
- **`src/pages/RuneDelveResultsPage.tsx`** — add the Personal Best Tracker strip and the secondary-improvement chip. Pull from `run` (now includes the new columns).
- **`src/pages/RuneDelveHistoryPage.tsx`** — add `clears/attempts` chip to each row; select the new columns.
- **`src/integrations/supabase/types.ts`** — auto-regenerated after migration; no manual edit.

### Why this works

- **Fixes the reported bug both ways**: the new row never silently drops a better stat, and stale cache can no longer cause phantom "new best" hero increments.
- **No regression**: `score` is still the canonical best-of; XP/leaderboards/star ratings are unchanged.
- **Adds satisfying replay loop**: attempts, clears, fastest clear, best HP — the things players naturally want to chase on a Retry — without redesigning the campaign or scoring.
- **Mobile-first**: only one new strip on Results and one chip on History; no layout overhaul.

### Manual testing checklist

- Clear level 1 with score X → return → replay and beat X → Results shows new score and "New best score!"; History row shows `2/2`.
- Clear level 1 with score X → replay and score X-100 → DB still shows X; hero `lifetime_runs` only incremented once per session, not twice.
- Clear level 1 in 18 turns → replay and clear in 12 turns at lower score → Results shows "⚡ New fastest clear — 12 turns" chip; `best_turns_used` = 12.
- Fail level 5 three times then clear → `attempts = 4`, `clears = 1`, History row reads `1/4`.
- Cross-class replay: switch class, replay a cleared level — per-class XP only updates on score improvement (existing rule preserved).

