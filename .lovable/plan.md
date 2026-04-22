

## Rune Delve — Levels 23+ are unplayable (root cause + fix)

### What's actually happening

The drag mechanic is **not broken** — it's the levels themselves. The bulk-seed migration that pre-populated levels 1–150 inserted `enemy_config: '[]'` and `modifiers: '{}'` for every brand-new row (23–150). The 22 pre-existing rows were preserved by `ON CONFLICT DO NOTHING` and still have real enemies.

The client-side `hydrateLegacy()` helper in `useRuneDelveCampaign.ts` was supposed to overlay generator output onto sparse rows, but it only fills `enemy_config` when the level has a **boss** (`bossKindForLevel(n) !== null`). For non-boss levels (23, 24, 26, 27…), it leaves `enemy_config` as `[]`.

What players actually see on L23+:
- Empty enemy area at the top of the screen.
- Drag/chain works fine, but `combat.enemies = []` makes `isRunOver` report `cleared = true` after the first chain (an `[].every(...)` is vacuously true).
- The level "ends" instantly with 0 damage, ~0 score, and a clear stamp — which then advances `highest_unlocked_level` and pushes them straight into the next equally-broken level.

This perfectly matches the "can't drag the tiles properly" complaint — the chain registers, but the result feels broken because there's nothing to fight.

What IS working (verified, no changes needed):
- `RuneBoard` pointer-down + document-level `pointermove` + `elementFromPoint` chain capture is correct on iOS Safari.
- `touchAction: 'none'` on cells + container properly disables scroll-jacking during drag.
- `isValidChain` adjacency, sealed/corruption guards, and `applyChain` math are all sound.
- L1–L22 still play fine because their `enemy_config` was seeded properly the old way.

### Fix

**1) SQL migration — repopulate enemy_config + modifiers for the broken rows.** A PL/pgSQL block that walks levels 23..150, regenerates each row's deterministic shape using the same constants the client-side `generateLevel()` uses (board_size 5, generation_seed = `n*9301+49297`, turn_limit by tier, `chapter`, `difficulty_tier`), and **only updates rows where `enemy_config` is empty** — so any future hand-tuned levels are left alone.

Since enemy generation logic lives in TypeScript (`generateLevel` → `rosterPoolForLevel` → roster definitions), the cleanest path is to keep the SQL migration minimal and instead **delete-and-let-rehydrate** the busted rows: levels 23–150 with empty enemy_config get deleted, then the client's `useLevel` hook re-seeds them properly on first visit using the now-fixed `INSERT` policy. No `rune_delve_runs` rows reference these levels yet (verified — `MAX(level_number) = 22`), so there's no FK fallout.

```sql
DELETE FROM public.rune_delve_levels
WHERE jsonb_array_length(enemy_config) = 0;
```

**2) Harden `hydrateLegacy` so this class of bug can't reappear.** In `src/hooks/useRuneDelveCampaign.ts`:

- Treat an empty `enemy_config` (`[]`) as "missing" — when detected, overlay the generator's full `enemy_config` regardless of boss status.
- Treat an empty `modifiers` (`{}`) the same way — overlay the generator's `modifiers` block (mechanics, secondary_objective, boss_rule, boss_kind, waves) so legacy rows always get the current shape.
- Preserve any custom hand-tuned fields when present (existing safety belt for `mechanics`).

**3) Verify drag mechanic is healthy after fix.** With the levels rehydrated, drag-to-chain on L23+ will behave identically to L1–L22 (enemies render, chains land, runs progress turn-by-turn).

### Verification

- DB check: `SELECT COUNT(*) FROM rune_delve_levels WHERE jsonb_array_length(enemy_config) = 0` returns 0 after the migration + first-visit hydration cycle.
- Open L23 → see real enemies in the enemy area, drag a chain → damage applies, turn ticks, level continues normally to completion.
- L10/L20/L25/L50/L75/L100 (boss/mini-boss levels) still show their boss portraits and rules — nothing about boss handling changes.
- L1–L22 continue to play exactly as before (untouched by the migration).
- No `transient-*` ids appear in `rune_delve_runs`, no broken instant-clears, no phantom XP.

### Files touched

- New SQL migration — deletes empty-config rows so the hardened client can reseed them with correct shape.
- `src/hooks/useRuneDelveCampaign.ts` — `hydrateLegacy` treats empty `enemy_config` and empty `modifiers` as needing overlay, not just boss levels.

