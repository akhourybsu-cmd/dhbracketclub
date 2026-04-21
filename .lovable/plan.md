

# Rune Delve — Difficulty Rebalance (Data-Driven)

## What the data shows

I pulled every Rune Delve run from the database. Tiny sample (4 active players, 18 runs across L1–L8), but the signal is unmistakable:

| Lvl | Attempts | Clears | Clear % | Avg turns used | Avg HP left | Notes |
|----:|---------:|-------:|--------:|---------------:|------------:|-------|
| 1 | 3 | 3 | **100%** | 10.3 | 90 | smooth |
| 2 | 3 | 1 | **33%** | 11.0 | 87 | early dip — see below |
| 3–7 | 12 | 12 | **100%** | 5.0–10.5 | 89–94 | comfortable |
| **8** | **2** | **0** | **0%** | **12.0 (max)** | **18** | **hard wall** |

**Level 8 is a cliff, not a curve.** Going from L7 → L8 the level generator jumps:

- enemy count **2 → 3** (+50%)
- total enemy HP **168 → 256** (+52%)
- total enemy damage per turn **8 → 20** (+150%)
- turn limit stays at **12**

Both L8 attempts used all 12 turns, used their ability, hit chains of 7–12 — they played well and still only killed 1 of 3 enemies. Required DPS jumps from ~14 to ~21 HP/turn with no warning.

**Twelve turns is fine through L7.** It is *not* fine for a 3-enemy / 256-HP encounter at L8.

The L2 dip is a separate, smaller issue: the slime (94 HP, 3 dmg) is a slog with no ability yet earned, so newer players time out.

## What I'll change

### 1. Smooth the L8 cliff in the level generator (`src/lib/runedelve/levelGenerator.ts`)

- **Enemy count ramp** — push the 3-enemy threshold later and gate it by chance, not just chapter:
  - `level ≤ 8` → always **2**
  - `level 9–15` → **2** (75%) or **3** (25%)
  - `level 16–25` → 2 or 3 (50/50)
  - `level 26–75` → 3
  - `level 76+` → 3 or 4
- **HP scaling** — soften early ramp from `+4%/level` to `+3%/level` for the first 25 levels, then resume 4%.
- **Damage scaling** — soften from `+2.5%/level` to `+2%/level` for the first 25 levels.
- **Turn budget** — keep 12 through L15 (currently L1–10), then taper to 11/10/9/8 the same way.
- **Per-enemy DPS cap on early levels** — when generating L≤15, if the rolled template's damage scales above 7, swap to a tankier-but-softer alternate. Prevents a 3-Goblin spike like L6 hinted at.

### 2. Backfill the already-stored levels (DB migration)

Levels 1–8 are already persisted in `rune_delve_levels` with the old (harsh) configs. The formula change won't touch them. I'll write a migration that **regenerates** rows for levels 1–25 to match the new curve. Specifically:

- For L1–8 already in the table, recompute `enemy_config`, `turn_limit`, `objective_target` using the new generator.
- Only touches rows where `level_number ≤ 25` so existing player progress (`rune_delve_progress`) is untouched — players keep their unlocked levels and history.

The migration is idempotent and uses the deterministic seed, so reruns produce identical results.

### 3. Concrete L8 target after the change

Same seed, same chapter, but:

- 2 enemies (Shadow Imp + Skeleton), total HP ~150, total damage ~12/turn
- 12 turn budget, ability available
- Expected clear rate ~70–80% on first try

Levels 9–15 stay tense but solvable; the "3-enemy" experience moves to L16+ where players have more relics, ability uses, and class progression to lean on.

### 4. Tooling — log a "near-miss" signal so we can re-tune later

Add a small note to `RuneDelveResultsPage` so failed runs that cleared ≥60% of total enemy HP show a "So close — try a different relic" hint. This is QoL, not balance, but it'll give us better player feedback for the next pass once more runs are in the DB.

## What I'm NOT changing

- No gameplay/combat math, no scoring formula, no class abilities, no relic effects.
- No changes past L25 — the late-game curve has zero data; tuning it now would be guessing.
- No changes to objectives (defeat_all stays the default through L14).
- No HUD/UI/typography changes — this is a numbers pass.

## Files

**Edited**
- `src/lib/runedelve/levelGenerator.ts` — softer enemy-count, HP, damage, and turn-limit curves for L1–25.

**New**
- `supabase/migrations/<ts>_rune_delve_rebalance_l1_25.sql` — regenerates `rune_delve_levels` rows 1–25 in place using the new formula.

## How we'll know it worked

After ship, re-run the same per-level query in 1–2 weeks. Healthy targets:

- L1–10 clear rate **70–95%**
- L11–25 clear rate **40–70%**
- No level with **0% clear** across 3+ attempts
- Avg turns used should sit at **70–85%** of the budget on cleared runs (currently 100% on L8 = no margin)

