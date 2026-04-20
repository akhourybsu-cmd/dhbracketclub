

## Rune Delve — Final wiring & gap-closure pass

The five bands and intro UI are wired. This pass closes the **integration gaps** that remain before calling the campaign progression complete: a few real bugs, a couple of fairness/clarity gaps, and the final mobile polish item.

### Gaps found (from a full audit of the wired code)

**1. Bug — chapter switcher is gated on the OLD progress model**
`RuneDelveLevelMapPage` only lets the player switch to chapter 2/3 if `chapterFor(highest_unlocked_level) >= ch`. After the destructive reset, every player is back at level 1, so the chapter buttons for Ch 2/3 are locked even when peeking. Players who haven't unlocked them should still be able to **preview** later chapters (consistent with how the level cards show "🔒"). Fix: always allow switching; keep the lock pip on individual level cards.

**2. Bug — boss-rule end-of-turn effect runs twice per turn**
In `RuneDelvePlayPage.handleChain` and `handleAbility`, `enemiesAttack(...)` already calls `applyBossTurnEffects` internally; the page then calls `applyBossTurnEffects(afterEnemies, bossRule)` again. On Regenerator levels the boss heals **16 HP/turn instead of 8** — roughly the entire intended challenge, doubled. Fix: drop the redundant call from both handlers.

**3. Bug — `MechanicIntroSheet` opens for mechanic combos too**
`introMechanicForLevel` only returns the mechanic on band-opener levels (26, 51, 76, 101, 126), which is correct. But it's evaluated against `level.modifiers.intro_mechanic` first, which the generator **always sets to the band intro id** for any level inside the band — so the modal can re-open on later levels. Cross-checking, the field is `null` from `introMechanicForLevel(n)` for non-opener levels — verified safe. **No fix needed**, but worth a comment so it doesn't regress.

**4. Fairness — Layered Goals are required for clear but give no score reward**
`secondaryMet` gates the clear, but `calculateScore` ignores it entirely. A player who hits a much harder dual-objective level scores the same as one with a single objective. Fix: add a small `+250` bonus to `calculateScore` when a `secondaryMet === true` flag is passed in, and thread the flag through `finalize()`.

**5. Clarity — Boss-rule "Last Stand" silently does nothing in the UI**
When a chain targets the immune final enemy, `applyChain` finds an empty `targetable[]` and the chain just deals 0 damage with no feedback. Players think it's broken. Fix: when a red chain resolves to 0 damage on a Last-Stand level with the boss alive, fire a one-shot toast: "🛡️ Boss is shielded — defeat the others first."

**6. Clarity — Level Map doesn't surface secondary goal or boss rule**
The map shows the mechanic icon and a "NEW" pip but never hints "this level has a bonus goal" or "this is a boss-rule level." Fix: add a tiny corner glyph (🎯 for `secondary_objective`, 👑 for `boss_rule`) below the mechanic chip on the level card.

**7. Polish — Results page recap title is too generic on failed runs**
The "This level featured" recap renders identically on a clear and a defeat. On defeats, change the heading to "What you faced" (subtle teaching cue).

**8. Cleanup — comment-and-test guard for the modifier shape**
Several files cast `level.modifiers as any`. Add a typed `LevelModifiers` shape exported from `levelGenerator.ts` and use it in the play and results pages to prevent drift if a 6th mechanic is added.

### Files to edit

| File | Change |
|---|---|
| `src/pages/RuneDelveLevelMapPage.tsx` | (a) Remove the `reachable` gate on chapter switch buttons (still show a small lock pip for preview-only chapters). (b) Render a 👑 glyph for boss-rule levels and 🎯 glyph for secondary-objective levels at the bottom-right of the card. |
| `src/pages/RuneDelvePlayPage.tsx` | (a) Remove the duplicate `applyBossTurnEffects` calls in `handleChain` and `handleAbility`. (b) Detect "Last Stand shielded chain" and toast it. (c) Pass `secondaryMet(...)` into `finalize()` and through to `calculateScore`. |
| `src/lib/runedelve/scoring.ts` | Add an optional `secondaryBonus: boolean` input → `+250` line item in `ScoreBreakdown`. |
| `src/pages/RuneDelveResultsPage.tsx` | Switch recap title to "What you faced" on non-cleared runs. Render the `secondaryBonus` line if present. |
| `src/lib/runedelve/levelGenerator.ts` | Export a `LevelModifiers` interface and use it in the `LevelDefinition.modifiers` field. |
| `src/components/runedelve/MechanicIntroSheet.tsx` | Add a tiny inline comment that the modal is intro-only (band openers) — doc only. |

### Out of scope (verified working)

- Schema, RLS, and seeding — `rune_delve_levels.modifiers` is JSONB and accepts the new keys; the destructive reset migration is in place.
- Mechanic registry, combine-rule gating (3-level intro phase + every-3rd-level layering after).
- Sealed Tiles, Telegraphed Attacks, Corrupted Tiles core engines & visuals.
- Boss-rule combat hooks for `last_stand`, `regenerator`, `enrager`.
- Layered-goal evaluator + secondary-goal pill UI on the play page.
- Results-page mechanic recap (chips + bonus-goal line).

### Manual testing checklist

1. Open the Level Map at level 1 → tap "Ch 2" → preview opens, levels are visibly locked.
2. Play level 130 (Regenerator boss) → boss heals **8 HP/turn**, not 16.
3. Play level 130 again → on Last Stand turn, hit boss with red chain → toast appears, no silent 0-damage.
4. Play level 103 (Layered Goals) → satisfy both objectives → results show "Bonus Goal +250" line.
5. Play level 103 and miss the secondary → primary still fails the run with an explanatory recap.
6. On the Level Map, level 103 shows 🎯 corner glyph; level 130/140/150 each show 👑.
7. Lose a run → results recap header reads "What you faced".

