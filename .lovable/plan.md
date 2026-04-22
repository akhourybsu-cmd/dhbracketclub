

## Rune Delve — Replay scores not updating (root cause + fix)

### What's actually broken

Every row in `rune_delve_runs` has `attempts = 1` and the `last_played_at` either matches `created_at` exactly or carries an old bulk-touch timestamp from a prior migration. The merge logic in `useSubmitLevelRun` is correct — but the writes never land.

**Root cause:** The `rune_delve_runs` table has SELECT and INSERT RLS policies but **no UPDATE policy**. When a user replays a level:
1. The mutation finds the existing row (`existing` is non-null).
2. It builds the correct `merged` payload (max score, ticked attempts, etc.).
3. It runs `.update(merged).eq('id', existing.id)` — RLS silently filters the row out, the update affects 0 rows, **PostgREST does not throw**, and the cache invalidates with no actual change.

This is the only Rune Delve table missing an UPDATE policy — every sibling table (`rune_delve_progress`, `rune_delve_heroes`, `rune_delve_bestiary`, `rune_delve_class_progress`, `rune_delve_loadouts`, `rune_delve_wallets`) has one. So replay scores, longest-chain bumps, fastest-clear improvements, attempts/clears counters, and the "best HP remaining" tracker have all been silently failing since launch.

### Fix

**1) Add the missing UPDATE policy** on `public.rune_delve_runs`:
```sql
CREATE POLICY "Users can update own runs"
  ON public.rune_delve_runs
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**2) Harden the submit mutation** so a future RLS regression can't silently swallow writes again. In `useRuneDelveCampaign.ts → useSubmitLevelRun`:
- After the `.update(...).select().maybeSingle()` call, if the returned row's `score`/`attempts` don't reflect `merged` (i.e. the update was filtered), throw a clear error so the toast surfaces it instead of pretending success.
- Add a one-line console warning when a known-exist