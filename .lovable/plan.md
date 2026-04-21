

# Rune Delve — Relic Upgrade System

## What we're adding

Right now, every relic is a one-and-done unlock. Once you've bought all the relics you can afford in your tier, Rune Shards have nowhere meaningful to go. I'll add a **5-rank upgrade ladder** for every relic, so shards keep mattering long after the catalog is full — but with deliberately gentle scaling so nothing snowballs.

## The upgrade curve

Each relic has 5 ranks: **R1 (base, on unlock) → R5 (max)**. Every rank adds a small, fixed bump to that relic's effect. The bump is always **≤10–15%** of the base, and damage/heal/shield numbers are always **rounded to whole integers** (per your rule).

### Rank cost (shards)

Cost scales with the original relic price + a tier multiplier. Whole numbers, easy to read:

| Rank | Tier 1 base 100 | Tier 2 base 300 | Tier 3 base 650 |
|------|---------------|---------------|---------------|
| R2 | 60 | 180 | 400 |
| R3 | 120 | 360 | 800 |
| R4 | 240 | 720 | 1600 |
| R5 | 480 | 1440 | 3200 |
| **Total to max** | **900** | **2700** | **6000** |

Formula: `rankCost(rank) = round(baseCost × 0.6 × 2^(rank-2))`. Doubles each rank — keeps the late ranks aspirational without making R2/R3 feel out of reach.

### Per-rank effect bumps

Each rank applies a small additive bump on top of base. Examples (all rounded to whole numbers at apply-time):

| Relic | Base (R1) | R2 | R3 | R4 | R5 |
|---|---|---|---|---|---|
| Ember Edge (first red ×1.5 dmg) | ×1.50 | ×1.55 | ×1.60 | ×1.65 | ×1.70 |
| Verdant Heart (+1 HP per green rune) | +1.0 → heal=len | +1.1×len | +1.2×len | +1.3×len | +1.4×len (rounded) |
| Aether Spark (start mana +2) | +2 | +2 | +2 | +3 | +3 (capped) |
| Iron Resolve (start shield 1 turn) | 1 | 1 | 2 | 2 | 2 |
| Bloodbond (heal 4 on kill) | 4 | 5 | 5 | 6 | 6 |
| Crimson Tide (every 5th red ×1.75) | ×1.75 | ×1.80 | ×1.85 | ×1.90 | ×1.95 |
| Sapphire Flow (+1 mana on 4+ chains) | +1 | +1 | +1 | +2 | +2 |
| Last Stand (survive at 1 HP) | 1 use | 1 | 1 | 1 | **2 uses** |
| First Light (1st ability free) | 1 free | 1 | 1 | 1 | **2 free** |
| Executioner's Mark (+30% vs <25% HP) | ×1.30 | ×1.34 | ×1.38 | ×1.42 | ×1.46 |
| Desperate Surge (+25% red <30% HP) | ×1.25 | ×1.29 | ×1.33 | ×1.37 | ×1.41 |
| Wanderer's Compass (+15% shards) | ×1.15 | ×1.18 | ×1.21 | ×1.24 | ×1.27 |
| Quickstep (+1 effective length first chain) | +1 | +1 | +1 | +2 | +2 |
| Bulwark (+1 shield turn on gold) | +1 | +1 | +1 | +2 | +2 |
| Momentum (4+ chains: +10% score) | ×1.10 | ×1.12 | ×1.14 | ×1.16 | ×1.18 |
| Foresight (telegraph 1 turn early) | 1 turn | 1 | 1 | 2 | 2 |
| Keysight (sealed unlock 1 turn faster) | 1 | 1 | 1 | 2 | 2 |
| Shrine Ward (turn-1 dmg ×0.90) | ×0.90 | ×0.88 | ×0.86 | ×0.84 | ×0.82 |
| Cleansing Touch (1st corrupt clear free) | 1 | 1 | 1 | 1 | 2 |
| Cracked Crown (boss soften ×0.85) | ×0.85 | ×0.83 | ×0.81 | ×0.79 | ×0.77 |

**Why these numbers**: Multiplier relics get **+0.04–0.05 per rank** (tiny decimal bumps, exactly as you asked). Flat-integer relics (heal, shield turns, mana, free uses) gain a +1 every **2–3 ranks** so they only "tick up" at meaningful breakpoints — no rounding weirdness. Going from a fully-equipped R1 loadout to a fully-equipped R5 loadout is roughly **+18–25% effective power**, not 2×.

## How it appears in the UI

### Shop page (`RuneDelveShopPage.tsx`)

Owned relics now show a **rank bar (●●●○○ R3/5)** under the description and a **"Upgrade · 240 ✦"** chip in the corner. Tapping an owned relic opens an upgrade sheet showing the next-rank delta ("Damage ×1.55 → ×1.60") and confirms the spend. Locked tiers and the buy flow are unchanged.

### Armory & loadout

`LoadoutSlot` and `RelicCard` already render the relic — I'll add a small `R3` chip on the icon corner so players see their invested ranks at a glance during loadout selection.

### In-run

No HUD changes. The bumps just flow through `relicEffects.ts` automatically.

## Technical implementation

### Database

New column on existing table — no new tables needed:

```sql
ALTER TABLE public.rune_delve_relic_unlocks
  ADD COLUMN rank smallint NOT NULL DEFAULT 1
  CHECK (rank BETWEEN 1 AND 5);
```

Existing unlocks default to R1, so nothing breaks for current players.

### `src/lib/runedelve/relics.ts`

- Add `MAX_RANK = 5` constant.
- Add `rankCost(baseCost, rank)` helper → returns whole-shard cost for the given target rank.
- Add `rankEffectTable` mapping every relic id to its 5 effect values (multipliers as decimals, integers as ints). Single source of truth for both UI display and `relicEffects.ts`.

### `src/lib/runedelve/relicEffects.ts`

- `ActiveRelics` becomes `{ ranks: Map<string, number> }` instead of a Set. Add `rankOf(a, id)` helper.
- Every `getXxx` and `computeChainMods` reads its multiplier/integer from the rank table. **All damage/heal/shield outputs wrapped in `Math.round()`** so the on-screen number is always a whole integer (per your spec).
- Backwards-compat: `has()` stays (returns `rank >= 1`).

### `src/hooks/useRelicCollection.ts` & `useRuneShards.ts`

- `OwnedRelic` adds `rank: number`.
- New `useUpgradeRelic({ relic_id, target_rank, cost })` mutation: spends shards + bumps `rank` in a single round-trip (read-modify-write, RLS-scoped).
- `buildActive([slot1, slot2, slot3], owned)` now resolves each slot to its current rank from the collection.

### `src/pages/RuneDelveShopPage.tsx`

- For owned relics, swap the disabled state for an "Upgrade" CTA when `rank < 5`, otherwise show "Maxed".
- New `<RelicUpgradeSheet>` component (mobile sheet, 44px tap targets, shows current → next stat with the delta highlighted).

### `RelicCard.tsx` & `LoadoutSlot.tsx`

- Add an optional `rank` prop. When set and >1, render a tiny gold `R{rank}` chip on the icon corner.

## What I'm NOT changing

- No new relics, no removals, no rebalancing of base R1 values.
- No changes to shard earn rates, the failure-reward system, or slot unlocks.
- No changes to combat engine, scoring, classes, or level generation.
- No changes outside Rune Delve.

## Files

**New**
- `supabase/migrations/<ts>_rune_delve_relic_ranks.sql` — adds `rank` column.
- `src/components/runedelve/RelicUpgradeSheet.tsx` — bottom sheet for confirming upgrades.

**Edited**
- `src/lib/runedelve/relics.ts` — `MAX_RANK`, `rankCost`, `rankEffectTable`.
- `src/lib/runedelve/relicEffects.ts` — rank-aware effect resolution, integer rounding everywhere.
- `src/hooks/useRelicCollection.ts` — `rank` field, `useUpgradeRelic` mutation, rank-aware `buildActive`.
- `src/pages/RuneDelveShopPage.tsx` — Upgrade CTA, rank chip on owned cards.
- `src/components/runedelve/RelicCard.tsx` — optional rank chip overlay.
- `src/components/runedelve/LoadoutSlot.tsx` — rank chip on equipped relics.
- `src/pages/RuneDelvePlayPage.tsx` — pass owned-collection ranks into `buildActive`.

## How we'll know it worked

- Owned relics show a rank bar; pressing Upgrade spends the right amount and bumps the rank.
- Effect numbers in combat reflect the upgraded value (e.g. Verdant Heart at R3 healing `round(1.2 × chainLen)` HP).
- Clear rates on hard levels (8, 16, 25) creep up gradually as veteran players invest, but no single rank doubles a relic's output.

