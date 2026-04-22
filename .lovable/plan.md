

## Rune Delve — L27+ difficulty tuning

### What I found playtesting on paper

For L27–50, the math says fights look like this:

- **L27**: 11 turns, 2-3 enemies (mostly 3), Chapter 1 pool only, **abilities filtered out** (gate is `level <= 50`). Goblin Scout → 122 HP/8 dmg. Three enemies = ~24 dmg/turn vs 100 HP. Beatable but not threatening.
- **L30**: 11 turns, 3 enemies. Same Chapter 1 pool. Sealed Runes mechanic active (intro'd at L26).
- **L40**: 10 turns, 3 enemies. Shadow Imp scales to ~141 HP / 14 dmg. Still no enemy abilities.
- **L50**: 10 turns. Chapter boss arrives. First time the player sees an ability-bearing enemy.

The result: **L27–49 is a 23-level stretch of "more of the same Chapter 1 enemies, just bigger."** No telegraphed threats, no caster charge-ups, no shielded targets, no healers to prioritize. The only new wrinkle is sealed tiles. That's flat.

Two compounding issues:

1. **Ability gate is too late.** Chapter 2 archetypes (`Cult Warden`, `Cult Chanter`, `Rune Wraith`, `Frost Revenant`) are pool-eligible from level 14+ by tier (`maxTier = 1 + floor(level/8)`), but the generator strips abilities until L51. So the only enemies with telegraphs/threats arrive *after* the chapter boss. Players never feel pressure mid-Chapter 1.
2. **Turn budget barely tightens.** 12 → 11 → 10 across a 30-level band is basically flat, while HP/damage grow linearly. Survive/elite objectives could feel tense, but `defeat_all` (the default) is still the dominant objective.

### Fix — three small tuning changes

**1) Open the ability gate earlier (L31+ instead of L51+).** Change `pickTemplate` in `levelGenerator.ts`:

```ts
// Before: if (level <= 50) pool = pool.filter(e => !e.ability);
// After:  if (level <= 30) pool = pool.filter(e => !e.ability);
```

This lets one ability-bearing enemy show up in the second half of Chapter 1. The wave-2 anti-stack guard (`wave1HasAbility` re-roll) already prevents two ability enemies from compounding — no other changes needed.

**2) Tighten turn budget on the L26-50 band.** A single line in `turnLimitFor`:

```ts
if (level <= 15) return 12;
if (level <= 25) return 11;   // was: <= 30
if (level <= 50) return 10;   // was 11 for 26-30, 10 for 31-60
if (level <= 75) return 9;    // was 10
if (level <= 100) return 9;
return 8;
```

This shaves 1 turn off L26-30 and L61-75 — each fight gets a touch more pressure without breaking the 100-level pacing.

**3) Add a "menace" damage bump for Chapter 1 deep cuts (L31-50).** Today the dmg curve is `1 + (level-1) * 0.025`. For L31-50 we already have ability-bearing enemies coming online (fix #1) but their *base* damage is tame because they're support/corrupter roles. Bump per-enemy dmg by ~10% only in this band so the player feels the late-Chapter-1 squeeze:

```ts
function scaleEnemy(base: RosterEntry, level: number) {
  const hpRate  = level <= 25 ? 0.03 : 0.04;
  const dmgRate = level <= 25 ? 0.02 : 0.025;
  let hpMul   = 1 + (level - 1) * hpRate;
  let dmgMul  = 1 + (level - 1) * dmgRate;
  // Late Chapter 1 menace pass — ability enemies are softer by design,
  // so add a gentle damage bump in the 31-50 band so fights bite back.
  if (level >= 31 && level <= 50) dmgMul *= 1.10;
  return {
    hp: Math.round(base.baseHp * hpMul),
    damage: Math.max(base.baseDamage, Math.round(base.baseDamage * dmgMul)),
  };
}
```

### What this changes in practice

- **L27–30**: Same enemies, but one fewer turn. Tight clear, not punishing.
- **L31**: First Cult Warden / Wraith / Chanter starts appearing. Player must read the ✦ telegraph and prioritize a healer or shielded target. The board-affecting `corrupt_tile` / `seal_tile` abilities suddenly matter — and they compose naturally with the Sealed Runes mechanic that's already active.
- **L35-49**: Fights have real teeth. ~10% damage bump + abilities + 10-turn limit means a sloppy chain run actually loses HP rather than coasting.
- **L50 chapter boss** still feels like the apex — but now the player arrives *prepared* by past ability encounters, not seeing telegraphs for the first time.

### Verification

- `rng().filter(e => e.ability)` for a sample of L31-50 seeds shows ≥1 ability enemy in ~40% of fights (matches design intent of "occasional, not every fight").
- L27-50 average turns-to-clear (estimated): drops from ~7 to ~9 — fights feel more decisive.
- L1-25 untouched; L51+ untouched. No data migration needed — these are pure generator changes that re-derive on next visit (and `hydrateLegacy` overlays new generator output onto stored rows automatically).
- No DB writes needed since `hydrateLegacy` already overlays generator output when stored data is sparse, and existing L27+ rows have the empty configs that trigger the overlay path.

### Files touched

- `src/lib/runedelve/levelGenerator.ts` — three small edits inside `pickTemplate`, `turnLimitFor`, and `scaleEnemy`.

