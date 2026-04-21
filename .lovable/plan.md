

# Rune Delve — Optimization & Cleanup Pass

After combing the module, here's what I found and the cleanups I'd make. **No gameplay or balance changes** — this is purely dead-code removal, fixing promised-but-broken features, and small polish.

## 1. Dead code (safe deletes)

### A. Entire legacy daily-dungeon hook file — `src/hooks/useRuneDelve.ts` (185 lines)

This file exports `useTodayDungeon`, `useMyTodayRun`, `useSubmitRun`, `useDailyLeaderboard`, `useRunHistory` — relics from the original "daily run" prototype before the campaign system. **Zero importers anywhere in the codebase.** Replaced long ago by `useRuneDelveCampaign.ts`. Delete the whole file.

### B. Unused relic-effect helpers — `src/lib/runedelve/relicEffects.ts`

Seven exported helpers that are never imported by the play loop:
- `computeChainMods` + `ChainContext` + `ChainMods` types
- `abilityFreeFirstUse`
- `getTelegraphReadyEarly`
- `getSealedTilesSpeedup`
- `bossRuleSoften`
- `shrineWardTurn1Mult`
- `momentumScoreBonusMult`

Either delete them (option 1, quickest) **or** wire them up (option 2, fixes broken relics — see §2 below). I recommend option 2 because deleting them silently leaves the relics broken in the shop.

## 2. Broken relics — silently doing nothing in combat

This is the most important finding. The shop sells these relics with descriptions, but `RuneDelvePlayPage.handleChain` never calls `computeChainMods` or any of the helpers above, so these relics **are paid for but have zero in-game effect**:

| Relic | Promise | Status |
|---|---|---|
| Ember Edge | First red chain ×1.5 dmg | ❌ broken |
| Crimson Tide | Every 5th red ×1.75 dmg | ❌ broken |
| Executioner's Mark | +30% vs <25% HP | ❌ broken |
| Desperate Surge | +25% red <30% HP | ❌ broken |
| Sapphire Flow | +1 mana on 4+ blue | ❌ broken |
| Verdant Heart | +1 HP/rune on green | ❌ broken |
| Bulwark | +1 shield turn on gold | ❌ broken |
| Quickstep | +1 effective length on first chain | ❌ broken |
| First Light | First ability free | ❌ broken |
| Momentum | 4+ chain ×1.10 score | ❌ broken |
| Shrine Ward | Turn-1 dmg ×0.90 | ❌ broken |
| Cracked Crown | Boss soften ×0.85 | ❌ broken |
| Foresight | Telegraph 1 turn early | ❌ broken |
| Keysight | Sealed unlock 1 turn faster | ❌ broken |
| Cleansing Touch | First corrupt clear free | ❌ broken |

Working relics (already wired): Aether Spark, Iron Resolve, Last Stand, Bloodbond, Wanderer's Compass.

**Fix**: in `handleChain`, call `computeChainMods(activeRelics, ctx)` and apply the returned `bonusDamageMult` / `bonusManaFlat` / `bonusHealFlat` / `bonusShieldTurns` / `effectiveLengthBonus` to the resolution. In `handleAbility`, check `abilityFreeFirstUse` to skip mana cost on first cast. In the corruption section, check `cleansing_touch` (track a `corruptCleansedThisRun` count). Wire `shrineWardTurn1Mult` into the enemy attack damage on turn 1. Wire `bossRuleSoften` into `enemiesAttack` when a boss-rule-driven multiplier exists. Wire `momentumScoreBonusMult` into `finalize` before returning the breakdown. Wire `getTelegraphReadyEarly` in the initial-intent setup and `getSealedTilesSpeedup` into `buildInitialSeals`.

This restores 15 relics that players are spending shards on with no payoff.

## 3. Small correctness & polish

### a. `RuneBoard` chain-preview is class-blind
`RUNE_PREVIEW.effect` shows e.g. "8 dmg per rune" — but a Warrior's red chain hits ×1.25, Mage blue gives 2 mana, Cleric green heals ×1.5, and chain-6+ now adds tier bonuses. Pass the active class + tier into the preview so the live "Attack · 32 dmg" string actually reflects what will happen. Quick fix: accept an optional `damagePerRune`/`healPerRune` override prop and compute it once on `RuneDelvePlayPage`.

### b. `handleChain` is a 200-line monolith
Extract three pure helpers (still in the same file is fine):
- `applyTierMultiplier(next, resolution, type, tier)` — the chain-6/7/8 damage scaling block (lines 199–221).
- `buildTurnLogs(...)` — the long log-building section (lines 224–250 + 322–330).
- `applyCorruptionToChain(...)` — corruption block (262–276).

Cuts the function to ~80 lines and makes the bonus-move flow obvious.

### c. `useLevel` runs a 2nd fetch on every cache miss
After failing `insert` (RLS denial for non-admins), it always `select`s again before falling back to a transient row. For the common case (non-admin player on a not-yet-seeded level), this is two extra round-trips per visit. Skip the second select unless the insert error is a unique-violation race (`code === '23505'`). Trims one round-trip from every transient-level page load.

### d. `pushLog` ID generation
`Date.now() + Math.random()` per entry inside a setState updater triggers a fresh `Math.random()` per call. Use a module-level `let logSeq = 0; logSeq++` counter instead — slightly faster and produces stable, sortable IDs.

### e. `RuneDelvePlayPage` `useEffect` deps
The board-init effect (line 130–148) lists `activeRelics` in its deps — but `activeRelics` is rebuilt on every `loadout`/`ownedRelics` change via `useMemo`, so toggling a relic mid-mount **resets the entire board mid-run**. Replace with `activeRelics` snapshot at run start — pull starting mana/shield once on first level/hero pair, not every time the relic ranks update.

### f. `as any` casts on every Supabase call
`(supabase as any).from(...)` appears 20+ times across `useRuneDelveCampaign.ts`, `useRuneDelve.ts` (deleted), `useRuneShards.ts`, `useRelicCollection.ts`, `useRuneDelveHero.ts`, `useRuneDelveClassProgress.ts`. The generated `types.ts` does include all `rune_delve_*` tables now — drop the casts so we get type-safety on column names. (One-line change per call.)

## 4. What I'm NOT changing

- No DB migrations.
- No combat balance, scoring, or class changes.
- No relic catalog changes (no new relics, no rebalanced numbers — only making existing relics actually fire).
- No UI redesigns.
- No changes outside `src/{pages,hooks,lib,components}/runedelve*` and `src/hooks/useRuneDelve*.ts`.

## Files

**Delete**
- `src/hooks/useRuneDelve.ts` (entire legacy file)

**Edit**
- `src/lib/runedelve/relicEffects.ts` — keep all helpers (now wired); minor tidy.
- `src/pages/RuneDelvePlayPage.tsx` — wire up `computeChainMods`, `abilityFreeFirstUse`, `shrineWardTurn1Mult`, `cleansing_touch`, `momentumScoreBonusMult`; extract three helpers; fix `useEffect` dep on `activeRelics`; tidy `pushLog`.
- `src/components/runedelve/RuneBoard.tsx` — accept class-aware preview values (optional props).
- `src/hooks/useRuneDelveCampaign.ts` — drop `(supabase as any)` casts; trim the redundant re-select in `useLevel`.
- `src/hooks/useRuneShards.ts`, `useRelicCollection.ts`, `useRuneDelveHero.ts`, `useRuneDelveClassProgress.ts`, `useLoadout.ts` — drop `(supabase as any)` casts.

## Expected impact

- **15 relics start working** that previously did nothing in combat — the single biggest player-facing win.
- ~250 fewer LOC overall.
- Cleaner build: type-safe Supabase queries, no dead exports cluttering autocomplete.
- Mid-run relic toggles no longer reset the board.
- Slightly faster transient-level page loads (one fewer Postgrest round-trip).

## How we'll know it worked

- Equip Ember Edge: the first red chain of a run visibly hits harder than subsequent reds; the combat log shows the boosted number.
- Equip Verdant Heart: a green chain of length 5 heals `5 + round(1.0×5) = 10` HP at R1, `5 + round(1.4×5) = 12` HP at R5.
- Equip First Light: first ability cast a run does not consume mana.
- Equip Foresight: telegraphed enemies show their intent one turn earlier in the EnemyDisplay.
- TypeScript build passes with the `as any` casts removed.

