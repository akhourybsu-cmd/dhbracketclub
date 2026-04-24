# Rune Delve · Class Balance & Mastery Wiring

Audit of the four hero classes (warrior / mage / rogue / cleric) found three issues:

1. **One base passive is broken.** Rogue's "+50% score on chain ≥5" actually grants only **+5%** in code (`scoring.ts` says `total * 0.05`, but the in-game class card and the source comment both say "+50%"). Rogue is currently the weakest class on score, undercutting their entire identity.
2. **11 of 20 mastery tiers are defined but never called at combat time.** The helpers exist in `masteryEffects.ts` but `RuneDelvePlayPage.tsx` only imports & uses 9 of them. Players unlock these tiers (with toast + confetti) but get nothing.
3. **The hero profile doesn't show unlocked masteries.** They live only inside the Codex sheet (Masteries tab). A player viewing their hero has no list of "perks I've earned."

---

## Part 1 — Fix the Rogue base passive (balance)

**File:** `src/lib/runedelve/scoring.ts`

- Change the rogue chain bonus from `total * 0.05` to `total * 0.15` (+15%, a balanced reading of "score-bonus stamp"; the literal +50% from the class card is too swingy when stacked with Rogue T1/T5 masteries below).
- Update the inline comment so future maintainers see the real value.
- Update the **class card description** in `src/lib/runedelve/classConfig.ts` from "+50% score" to "+15% run score" so it matches reality.

This single change makes rogue's identity actually work without making them dominant.

---

## Part 2 — Wire the 11 missing mastery effects

All helpers already exist in `src/lib/runedelve/masteryEffects.ts`. Wiring happens in `src/pages/RuneDelvePlayPage.tsx` and (for two combat overrides) `src/lib/runedelve/combatEngine.ts`.

### Warrior
- **T2 Iron Constitution** (`getMasteryHpPerChapter`) — at run init, add `+1 maxHp × current chapter index` after the base `MAX_HP` is set.
- **T3 Honed Cleave** (`getMasteryCleaveDamage`) — replace hard-coded `40` in `useAbility` (warrior branch) with `getMasteryCleaveDamage(active) ?? 40`. Plumb `activeMasteries` into `useAbility` via a new optional 4th arg (default `[]`) so the engine stays pure.
- **T4 Brace** (`hasMasteryPanicShield`) — add a one-shot guard: when player HP drops below 25% the first time in a run, set `combat.shieldTurns = max(2, shieldTurns)` and flip a `bracedFired` ref so it only triggers once per run.

### Mage
- **T3 Arc Cascade** (`getMasteryArcChainFraction`) — in `useAbility` mage branch, after the primary 80-dmg hit, deal `round(80 * 0.30)` to the second targetable enemy if one exists.
- **T5 Overflow** (`shouldMasteryRefundMana`) — already tracked: `manaSpentTotal` exists. After every ability spend, check `shouldMasteryRefundMana(active, manaSpentTotal)` and refund 1 mana when true.

### Rogue
- **T1 Gilded Eye** (`getMasteryGoldScoreBonus`) — track `goldRunesCleared` across the run (increment on every gold chain by `chain.length`). Add to score at finalize as a new `masteryBonus` line (or fold into `rogueBonus`).
- **T2 Opening Strike** (`getMasteryOpeningCritMult`) — in the red-chain damage block, multiply `extraMult` by `getMasteryOpeningCritMult(active, chainsThisFight)`. The page already tracks `chainsThisFight`.
- **T3 Veilcut** (`shadowstepClearsCooldown`) — when rogue uses Shadowstep ability, also reduce one random enemy's `cooldown` by 1 if `shadowstepClearsCooldown(active)` is true. Plumb through `useAbility`.
- **T4 Quickblade** (`getMasteryChainCritChance`) — in red-chain block, roll `Math.random() < getMasteryChainCritChance(active, length)`; on success multiply damage ×1.5 and push a "Crit!" combat-log line.

### Cleric
- **T3 Greater Sanctuary** (`getMasterySanctuaryHeal`) — in `useAbility` cleric branch, replace `30` with `getMasterySanctuaryHeal(active) ?? 30`.
- **T4 Resurgent Light** (`reviveBurstActive`) — when any heal would bring HP from 0 → positive (revive via relic/aegis), if `reviveBurstActive(active)` is true, deal 25 dmg to up to 2 targetable enemies and log a burst.
- **T5 Eternal Aegis** (`hasMasteryAegis`) — add a `aegisFired` ref; when an enemy attack would set HP ≤ 0, if not yet fired, clamp HP to 1 instead and fire a "🛡️ Aegis blocked the killing blow!" log line. Implement in the page after `enemiesAttack` returns, before `isRunOver` check.

### Engine signature changes (small)
`useAbility(state, cls, bossRule?, activeMasteries?: MasteryId[])` — additive, default `[]`, no caller breaks. Same for `applyChain` if we move the warrior chapter-HP logic into `initialCombat` we don't need to touch it.

---

## Part 3 — Surface unlocked perks on the hero profile

**File:** `src/pages/RuneDelveHeroPage.tsx`

Add a new card between **"Active class — passive + ability"** and **"Class Progression"**:

```text
┌─ Class Masteries · Warrior ─────────────────┐
│ Lv 12  ●●○○○   2 of 5 unlocked             │
│ ✓ T1 Crimson Fervor — +5% red-chain dmg    │
│ ✓ T2 Iron Constitution — +1 HP/chapter     │
│ 🔒 T3 Honed Cleave (Lv 30)                 │
│ 🔒 T4 Brace (Lv 50)                        │
│ 🔒 T5 Last Stand (Lv 75)                   │
└─────────────────────────────────────────────┘
```

- Reuse `MASTERY_TIERS[heroClass]`, `getActiveMasteries`, and `nextMasteryFor` from `classMastery.ts`.
- Style matches the existing `MasteryRow` from `CodexSheet.tsx` — extract that component into `src/components/runedelve/MasteryRow.tsx` so both the codex and the hero page share one render.
- Show a compact 5-segment progress bar (filled = unlocked) plus the next unlock hint.

---

## Part 4 — Quick passive sanity-check (no changes, just verification)

After Part 1, the four base passives sit in roughly the same power band:

| Class   | Base passive                              | Power |
|---------|-------------------------------------------|-------|
| Warrior | Red chains ×1.25 dmg                      | ✓     |
| Mage    | Blue chains charge 2 mana (vs 1)          | ✓     |
| Cleric  | Green chains ×1.5 heal                    | ✓     |
| Rogue   | Chains ≥5 grant +15% run score (was 5%)   | ✓ (fixed) |

Each passive now has a clear "do my color of chain a lot to power up" identity, and each class can earn five mastery perks that all actually apply.

---

## Files touched

- `src/lib/runedelve/scoring.ts` — rogue multiplier + comment
- `src/lib/runedelve/classConfig.ts` — rogue passive description
- `src/lib/runedelve/combatEngine.ts` — `useAbility` signature + cleave/sanctuary overrides + (small) initialCombat HP-per-chapter param
- `src/pages/RuneDelvePlayPage.tsx` — wire T1/T2/T3/T4 effects above; aegis/brace/revive triggers
- `src/components/runedelve/MasteryRow.tsx` — extracted shared row
- `src/components/runedelve/CodexSheet.tsx` — import the extracted row
- `src/pages/RuneDelveHeroPage.tsx` — new "Class Masteries" card
