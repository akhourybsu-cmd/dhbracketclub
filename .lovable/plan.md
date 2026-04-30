## Audit Findings — Endless Mode + Co-op Operations

I reviewed the full pipeline (engine → run record → operation submit → leaderboard → completion rewards) and pulled the live database. There are **three real bugs** plus a couple of polish items. The visual surfaces are wired correctly — the underlying data is the problem.

### Bug 1 — Kills never reach the database (CRITICAL)

`NexusBattlePage.tsx` computes:
```ts
const totalKills = (state.towers ?? []).reduce((sum, t) => sum + (t.kills || 0), 0);
```

But `src/lib/nexus/engine.ts` never increments `tower.kills` on enemy death. It only increments a global `state.killedThisRun`. Result in production right now:

```
nexus_operation_contributions  →  total_kills = 0 for every player
nexus_operations                →  phase1_progress = 0 / 2500
```

Phase 1 of the live operation literally cannot advance. The leaderboard shows "0 kills" for everyone.

**Fix:** use `state.killedThisRun` as the kill count submitted to the operation (and recorded on the run row).

### Bug 2 — Operation completion would crash (CRITICAL)

`award_operation_rewards` references `op.title`, but the column is `name`:
```sql
PERFORM public._credit_salvage(... , op.title);   -- column does not exist
```
The first time anyone tries to complete an operation, this throws `column op.title does not exist`. Nobody gets sigils or salvage and the op is left in a half-finished state.

**Fix:** rewrite `award_operation_rewards` to use `op.name`. Also remove the runtime `ALTER TABLE ... ADD COLUMN IF NOT EXISTS rewards_distributed_at` inside the SECURITY DEFINER function — that column already exists, and DDL inside an RPC is a footgun.

### Bug 3 — Recorded run kills are 0 too

`recordNexusRun` doesn't accept a kill count today, so `nexus_runs` has no kill column populated even where it should. Telemetry/balance pages will under-report kill volume. Same root cause and same fix (pass `state.killedThisRun`).

### Polish — Operation submission edge cases

- **Re-submission after restore:** if a player's run is restored from `battlePersist` and then completes, we already guard against duplicates via `nexus_operation_runs (operation_id, nexus_run_id)`. Verified safe.
- **No active op + endless run:** results panel handles this with the "No active Operation" headline. Verified.
- **Run too short:** server returns `ok:false` with the friendly message; client shows it via `toast.message`. Verified.
- **Phase advance toast:** firing correctly off `phaseAdvanced` flag from RPC. Verified.
- **Realtime updates on Operation Hub:** `useActiveOperation` subscribes to all three tables. Verified.

### Visual surfaces — confirmed wired

| Surface | Source | Status |
|---|---|---|
| Operation Hub phase bar | `nexus_operations.phaseN_progress / phaseN_target` | OK |
| Leaderboard rows | `nexus_operation_contributions` (sorted by points) | OK (kills will populate after Bug 1 fix) |
| Recent activity feed | `nexus_operation_runs` last 20 | OK |
| Results page contribution panel | `sessionStorage.nexus_run_<id>` (`opSummary`) | OK |
| Home page co-op card | `useActiveOperation` | OK |
| Real-time refresh | Supabase channel on 3 tables | OK |

### Live DB snapshot (proof)

```
operation: Defense of Sector I — phase 1 of 3
  phase1_progress: 0 / 2500     ← stuck at 0 because of Bug 1
  phase2_progress: 0 / 250000
  phase3_progress: 0 / 25000
  total_runs: 3
  total_contributors: 2

contributions:
  user A: 2 runs, kills=0, score=32494, boss_dmg=18460, points=1396
  user B: 1 run,  kills=0, score=16247, boss_dmg=6842,  points=686
```

Boss damage and score are flowing fine — only kills are broken.

---

## Plan

### Step 1 — Fix kill tracking (client)

In `src/pages/NexusBattlePage.tsx`:
- Replace the `totalKills` derivation to use `state.killedThisRun` instead of summing `tower.kills`.
- Pass that count to both `recordNexusRun` (new optional `kills` param) and `submitOperationContribution`.

### Step 2 — Add kills column on `nexus_runs` (migration)

- Add `kills integer NOT NULL DEFAULT 0` to `public.nexus_runs` if not already present.
- Update `recordNexusRun` in `src/hooks/useNexusProgress.ts` to insert it.

### Step 3 — Fix `award_operation_rewards` (migration)

- `CREATE OR REPLACE FUNCTION public.award_operation_rewards(...)` that:
  - Uses `op.name` instead of `op.title`.
  - Removes the inline `ALTER TABLE` (column already exists per live schema).
  - Keeps the existing reward logic (participant sigil, top‑3 sigils, MVP sigil, salvage tokens, `rewards_distributed_at` flag).

### Step 4 — Backfill / sanity check

- Optional one-off `UPDATE` in the migration to back-credit kills onto the **active** operation's existing contributions and `phase1_progress`, derived from each contribution's `total_waves` (cannot reconstruct exactly; safer to skip and let Phase 1 fill from new runs). Keep it skipped — the operation has only 3 historical runs and Phase 1 will fill quickly once the bug is fixed.

### Step 5 — Verify

- Manual sanity check via SQL after a test run that `phase1_progress` is now > 0 and `nexus_operation_contributions.total_kills` > 0.

### Files touched

- `src/pages/NexusBattlePage.tsx` — kill source
- `src/hooks/useNexusProgress.ts` — `recordNexusRun` accepts kills
- `supabase/migrations/<new>.sql` — `nexus_runs.kills` column + corrected `award_operation_rewards`

### Out of scope (not changing)

- The contribution formula (already retuned in v2 migration).
- Phase target tuning (already lowered for friend-group scale).
- Battle persistence — verified working as designed.
- Visual layout of any page.
