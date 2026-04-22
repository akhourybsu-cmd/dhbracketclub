

## Rune Delve — Mechanics audit & wiring fixes

I went through every band gate end-to-end (Sealed Runes / Telegraphed Attacks / Corrupted Tiles / Layered Goals / Boss Rules / per-enemy Abilities) and traced each from the level generator through `combatEngine` into the play page and the Battle Chronicle. The good news: most of it works. The bad news: there are several small but real wiring bugs that make a few mechanics either silent or fully no-op.

### What's working correctly

- **Sealed Runes (L26+)** — seeded deterministically, render correctly, `isValidChain` blocks them, broken-by-adjacency on chain land, log line fires.
- **Telegraphed Attacks (L51+)** — initial intents applied, badge renders, heavy-strike fires + logs + toast, guard pierce honored.
- **Corrupted Tiles (L76+)** — sources placed, spread tick happens, source-clear and HP cost both logged + toasted.
- **Layered Goals (L101+)** — secondary objective rolled, pill rendered, `secondaryMet` correctly gates the clear, "Met" indicator updates live.
- **Boss intro sheets** — fire once per `BossRuleId`, suppressed when a mechanic intro is already showing.
- **Mini-boss / Mid / Chapter tier visuals** — gold ring, crown chip, name prefix all correct.

### Bugs found (need fixing)

**1. Enemy ability `heal_ally` is silently a no-op.** In `tickEnemyAbilities`, the heal mutates `target.hp` on an element of the intermediate `next` array, but the outer `.map` returns fresh object copies that don't include the mutation. Players see the log line "Cult Chanter mended X" but the ally's HP bar doesn't actually move. Fix: do the heal inside the same map pass by patching the target's hp on the returned object (track a `healPatch: Map<id, hp>` in step 2 and apply during step 4).

**2. State race between enemy-ability side-effects and end-of-turn `setCorruption` / `setSeals`.** When `corrupt_tile` or `seal_tile` ability fires, the page does a functional `setCorruption(prev => …)` / `setSeals(prev => …)`, but later in the same handler we call `setCorruption(nextCorruption)` and `setSeals(nextSeals)` with non-functional values that overwrite the ability-driven updates. Net effect: enemy `corrupt_tile` / `seal_tile` abilities get visually erased on their own turn. Fix: collect ability cell-additions into local `nextCorruption` / `nextSeals` variables before the final `setCorruption`/`setSeals`, so the merged value is what lands.

**3. Wave-2 reinforcements skip `applyInitialIntents` on telegraph levels (L51+).** When wave 2 spawns, enemies have no `intent` field, so the Telegraphed Attacks mechanic silently doesn't apply to them — no badge, no heavy strike, no skill expression. Fix: in the wave-spawn branch (both `handleChain` and `handleAbility`), if `telegraphActive`, run `applyInitialIntents(fresh, level.generation_seed + wavesSpawnedRef.current, level.level_number)` on the fresh enemy list before `spawnWave`.

**4. Boss-rule effects fire silently in the Battle Chronicle.** Three rules trigger but never write log lines:
- `regenerator` — boss heals 8 HP each turn, no log
- `splitter` — boss splits into "Echo of …", no log
- `phaselock` — boss becomes immune for 1 turn, red chains fizzle without explanation
- `aura` — minions hit 15% harder, no indication

Fix: have `applyBossTurnEffects` return a small `{state, logs}` shape, and surface a phase-lock log when `isImmune` blocks a red chain (mirror the existing `last_stand` toast/log pattern around line 559). Aura can be a one-time intro line ("Dread Aura — minions enraged while the Boss lives").

**5. L31-50 ability gate is effectively dead code.** The prior tuning pass dropped the ability filter from `level <= 50` to `level <= 30`, but `rosterPoolForLevel` filters by `chapter <= (level<=50?1:2)` — so L31-50 still only see Chapter 1 enemies, none of which have abilities. Result: zero behaviour change from that tuning. Fix: extend the chapter window so L36-50 may pull from Chapter 2 as a small minority (e.g. 25% chance to use chapter≤2 pool when level ∈ [36,50]). Keeps Chapter 1 dominant but lets a Cult Warden / Wraith / Chanter actually appear, which is what the previous plan promised players would experience.

### Files touched

- `src/lib/runedelve/enemyAbilities.ts` — fix `heal_ally` mutation; have effects pipeline carry HP patches.
- `src/lib/runedelve/bossRules.ts` — `applyBossTurnEffects` returns `{state, logs}`; emit logs for regenerator / splitter / phaselock-decay.
- `src/lib/runedelve/combatEngine.ts` — thread the new boss-rule logs into the existing `abilityLogs` channel.
- `src/lib/runedelve/levelGenerator.ts` — small Chapter 2 bleed-in for L36-50 so the ability gate actually means something.
- `src/lib/runedelve/enemyRoster.ts` — add a `rosterPoolForLevelAllowingNextChapter(level, rng)` helper used only in the L36-50 bleed-in.
- `src/pages/RuneDelvePlayPage.tsx`:
  - Wave-2 spawn: apply `applyInitialIntents` to fresh enemies on telegraph levels (both handlers).
  - Merge ability `corrupt_tile` / `seal_tile` effects into the single end-of-turn `setCorruption` / `setSeals` call instead of racing functional updaters.
  - Push a "Boss phases out — strike fizzled" log line when `phaselock` immunity blocks a red chain.

### Verification

- L51+ wave-2 enemies show the ⚡ intent badge and can deliver heavy strikes.
- Cult Chanter (L36+) actually heals an ally — the HP bar moves and the log line is truthful.
- Rune Wraith corrupting a tile and Voidspawn sealing a tile leave the new cell on the board after the player's next chain (no race wipe).
- L25 (regenerator), L75 (splitter), L100 (phaselock), L125 (aura) all surface their effects in the Battle Chronicle so the player can read what's happening.
- L40 sample (5 seeds): at least one fight contains a Chapter-2 ability enemy (Warden / Chanter / Wraith).
- Sealed Runes / Corrupted Tiles / Telegraphed Attacks / Layered Goals — unchanged behaviourally beyond the bug fixes.

