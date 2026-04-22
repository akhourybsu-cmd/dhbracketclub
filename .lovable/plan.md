

## Rune Delve — Players blocked at Level 23 (admin-only level seeding)

### What's happening

`rune_delve_levels` has only **22 rows** seeded. Its INSERT policy is admin-only (`is_app_admin(auth.uid())`). Both Alex (admin) and Tacooo top out at level 22/23 because that's all that exists in the DB, and any non-admin who tries to play L23+ hits this chain:

1. `useLevel(23)` queries `rune_delve_levels` → no row found.
2. Client tries to INSERT a generated row → **RLS denies** (only admins can insert) → returns no row, no error code 23505.
3. Falls through to a **transient row** with `id: "transient-23"`.
4. Play page's `useMyLevelRun` is **disabled** for transient ids (`enabled: !levelId.startsWith('transient-')`), so "best run" never loads.
5. `useSubmitLevelRun` writes `level_id: "transient-23"` to `rune_delve_runs.level_id` — the column is a UUID FK, the insert **fails**, and `useAdvanceProgress` (which fires on success) **never runs**.
6. Player is permanently stuck — `highest_unlocked_level` never advances past whatever the admin last seeded.

So yes — **as it stands today, no non-admin can progress past a level the admin (or someone with admin role) hasn't already created the DB row for.** That's the bug.

Note: the play-page lock guard (`levelNumber > progress.highest_unlocked_level`) is fine and not the cause. The cause is that submissions silently fail on transient levels, so progress never advances.

### Fix

**1) Allow any authenticated user to seed canonical level rows** — generation is fully deterministic from `level_number` (Fisher-Yates on a fixed seed via `generateLevel()`), so two players seeding the same level produce identical rows. The unique constraint on `level_number` already prevents duplicates.

New migration:
```sql
DROP POLICY IF EXISTS "Admins can insert levels" ON public.rune_delve_levels;
CREATE POLICY "Authenticated can seed levels"
  ON public.rune_delve_levels
  FOR INSERT TO authenticated
  WITH CHECK (true);
-- UPDATE/DELETE remain admin-only — only seeding is opened up.
```

**2) Pre-seed levels 1–150 in bulk** so first-touch latency disappears for everyone (and the Level Map preview shows real rows immediately). Done as a one-time SQL migration that calls a small PL/pgSQL loop generating each level's deterministic shape (mirroring `generateLevel()`'s output: chapter, difficulty_tier, generation_seed = `level_number * 9301 + 49297`, board_size, turn_limit, default `objective_type='defeat_all'`, empty `enemy_config: []`, empty `modifiers: {}`). The client-side `hydrateLegacy()` already overlays the rich generator output (enemies, mechanics, boss_kind, waves) on rows missing those fields, so empty seeds are perfectly safe and require no app changes.

**3) Defensive client hardening in `useLevel` (`src/hooks/useRuneDelveCampaign.ts`)** — even with the policy fix, never write to `rune_delve_runs` with a transient id:
- After the insert attempt, if no row came back **and** the error wasn't a unique-violation, do one extra `SELECT` round-trip before falling back to transient. Belt-and-suspenders against any future RLS regression.
- Log a clear `console.warn` when we return a `transient-*` row, so this kind of regression surfaces fast.

### Verification

- Hoosierdaddy and Nick Boyle (non-admins) can clear L3 → progress advances to L4, then L5… all the way through, without Alex needing to visit those levels first.
- DB check: `SELECT COUNT(*) FROM rune_delve_levels` returns 150 after migration.
- DB check: `SELECT MAX(level_number) FROM rune_delve_runs` can exceed 22.
- No `transient-*` `level_id` values ever appear in `rune_delve_runs`.

### Files touched

- New SQL migration — open INSERT policy + bulk-seed L1–L150.
- `src/hooks/useRuneDelveCampaign.ts` — defensive re-fetch + transient warning in `useLevel`.

