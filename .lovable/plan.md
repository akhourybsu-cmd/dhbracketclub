

## Rune Delve — preserve in-progress runs across app backgrounding

### What's broken

The Play page (`RuneDelvePlayPage.tsx`) keeps the entire run state in component `useState`: `grid`, `combat`, `seals`, `corruption`, `log`, `lastStandUsed`, `bonusUsedThisCycle`, `redChainCount`, `chainCountTotal`, `abilityUsedCount`, `corruptCleansedCount`, `activeRelicsSnapshot`, `defeatedArchetypesRef`, `wavesSpawnedRef`, `rngTick`. Nothing is persisted. When you switch apps and iOS/Android evicts the WebView (very common on PWAs), React remounts and the boot `useEffect` regenerates the board from `level.generation_seed` — every chain, kill, and HP loss is wiped.

Same risk on the Hero / Level Map / Shop pages, but those are stateless reads from server data so they self-restore on remount. The Play page is the only one that loses real progress.

### Fix

**A) Persist run state to `sessionStorage` on every change.**

In `RuneDelvePlayPage.tsx`, add a single effect that serializes the live run snapshot under a per-level key:

- Key: `rd-run:${user.id}:${level.id}` (scoped per user + level so stale snapshots from a different level can't bleed in).
- Payload: `{ version: 1, levelNumber, generationSeed, savedAt, grid, combat, seals: [...], corruption: { cells: [...], sources: [...] }, log, lastStandUsed, bonusUsedThisCycle, redChainCount, chainCountTotal, abilityUsedCount, corruptCleansedCount, defeatedArchetypes: [...entries], wavesSpawned, rngTick, activeRelicsSnapshot }`.
- `Set` and `Map` are converted to arrays for JSON; rehydrated on read.

**B) Rehydrate on mount before the deterministic boot effect runs.**

Restructure the existing init `useEffect` so it:
1. Looks up the snapshot by key. If present **and** `generationSeed === level.generation_seed` **and** `endState` was never reached, hydrate every state slice from the snapshot and skip the fresh-board generation entirely.
2. Otherwise, run the existing fresh-board path (current behavior).

Guard against stale shapes by checking `version === 1` and bailing to fresh-board if the schema doesn't match. Cap age at e.g. 24h so abandoned runs don't haunt forever.

**C) Clear the snapshot on terminal events.**

Delete the key when:
- A run ends (`setEndState(...)` fires for cleared/defeated/timeout).
- The user taps "Retry" or navigates to a different level number.
- Submission to `useSubmitLevelRun` resolves successfully.

**D) Visibility / persistence hooks for safety.**

Add a `visibilitychange` + `pagehide` listener that does one final flush of the current snapshot. This catches the case where the OS backgrounds the WebView before React's effect microtask runs.

**E) Small UX touch: "Resumed" toast.**

When a snapshot is rehydrated, show a one-shot toast: `↩️ Resumed your run (Turn N of M)`. Makes it obvious the game restored state instead of silently re-rendering.

### Files touched

- `src/pages/RuneDelvePlayPage.tsx` — add snapshot save/load helpers, swap the boot effect to prefer rehydration, register `visibilitychange`/`pagehide` flush, clear snapshot on `setEndState` and on submit-success.
- `src/lib/runedelve/runSnapshot.ts` *(new)* — small module exposing `saveSnapshot`, `loadSnapshot`, `clearSnapshot`, `snapshotKey(userId, levelId)`, and the JSON-safe (de)serialization for `Set` / `Map` / refs. Keeps the page file from ballooning.

No DB migration. No edge function changes. Pure client-side persistence.

### Verification

- Start Level 7, play 4 turns, kill 1 enemy, build up shield. Switch to another app for 5+ minutes (long enough for iOS to evict the WebView). Reopen the app → land back on `/rune-delve/play/7` with the exact same grid, HP, mana, shield, seals, corruption, defeated count, and combat log. A "Resumed" toast appears once.
- Force-refresh the page mid-run → same restore behavior.
- Finish or fail the run → snapshot is cleared. Visiting Play again starts a fresh board.
- Tap "Retry" on the Results page → fresh board (no rehydrate).
- Switch to Level 8 mid-run on Level 7 → Level 8 starts fresh; returning to Level 7 still shows the saved Level 7 snapshot.
- Open the app as a different user on a shared device → no cross-user bleed (key is namespaced by `user.id`).

