

# Rune Delve: Shifting Runes, Daily Challenge & Class Mastery

A three-pillar content drop that addresses the L31+ repetition problem with new mechanics, a replayable daily ritual, and meaningful per-class progression — all surfaced through a single in-game **Codex** so nothing feels hidden.

---

## Pillar 1 — Three new mechanic bands (L36 / L51 stays / L101 reflows)

The current bands are spaced every 25 levels starting at L26. We'll **insert two new bands inside the L31–75 dead zone** without disturbing the existing telegraph/corruption/multi-objective/boss progression, by tightening the band cadence.

New mechanic registry order (`mechanics.ts`):

| Level | Mechanic | Rule (one-liner) |
|---|---|---|
| 26 | 🔒 Sealed Runes | *(unchanged)* |
| **36** | 🌬️ **Shifting Runes** | One column drifts down by 1 each turn. Plan around the slide. |
| **46** | 🔗 **Linked Pairs** | Some runes are linked. Match one — its twin clears too. |
| **56** | 🌑 **Eclipse Tiles** | Dimmed runes can't start a chain but extend one normally. |
| 66 | ⚠️ Telegraphed Attacks | *(shifted from 51)* |
| 81 | ☠️ Corrupted Tiles | *(shifted from 76)* |
| 101 | 🎯 Layered Goals | *(unchanged)* |
| 126 | 👑 Boss Rule | *(unchanged)* |

Each new mechanic gets:
- An entry in `MECHANICS` and `MECHANIC_LIST`
- A 3-level intro phase (handled by existing `mechanicsForLevel`)
- A `MechanicIntroSheet` first-encounter modal (already wired via `introMechanicForLevel`)
- Engine implementation in `boardEngine.ts` (Shifting), `dungeonGenerator.ts` (Linked, Eclipse spawn rules), and a new `eclipseTiles.ts` / `linkedPairs.ts` companion file mirroring the `sealedTiles.ts` pattern

**Engine hooks needed:**
- `applyShift(grid, rng, shiftCol)` runs after `enemiesAttack` each turn — pops top-of-column, inserts new rune at bottom (or top — TBD per playtest)
- `LinkedPair` map stored on the board state; chain resolution clears both tiles + grants combined score
- `EclipseSet` blocks chain *start* but not *continuation*; visual: tile rendered at 60% opacity with a thin dim ring

---

## Pillar 2 — Daily Challenge with Modifiers

A separate, single-attempt-per-day mode living at `/rune-delve/daily`. Same hero/relics/class as the campaign, but on a **special level seeded by date** with **2–3 stacked modifiers** that don't appear in the regular campaign.

### Daily modifier pool (modifier-only — never appear in campaign)

| Modifier | Effect |
|---|---|
| 🔥 **Inferno** | All red chains +30% damage. You lose 2 HP per turn. |
| 🛡️ **Ironclad** | Enemies have armor: chains <4 deal half damage. |
| ⚡ **Overcharge** | Mana costs 2 (down from 3). Chains can't exceed length 5. |
| 🌫️ **Fogged** | You only see the next rune that will spawn (no foresight relics). |
| 🩸 **Glass Cannon** | All damage you deal +50%. Max HP halved. |
| ⏳ **Hourglass** | -2 turn limit. Each chain refunds 1 mana. |
| 🪙 **Greed** | +50% shards earned. Enemies +25% HP. |
| 🪞 **Reflective** | Enemies reflect 20% of damage you deal. |

Each daily rolls **2 modifiers** (or **3** on Sundays for a "weekend gauntlet"), seeded from the UTC date so everyone faces the same combo.

### Rewards (replayability through escalating tiers)

- **Clear at all** → 50 shards + 100 XP
- **Clear with 2★** → +25 bonus shards
- **Clear with 3★** → +50 bonus shards + 1 random Tier-1 relic shard fragment (cosmetic dust toward upgrade)
- **7-day streak** → 200 shard bonus + "Daily Devotee" cosmetic title
- **30-day streak** → 1000 shards + "Eternal Pilgrim" title

### Daily Leaderboard
Date-scoped board on the Daily page showing top scores for today. Resets at 00:00 UTC. New table `rune_delve_daily_runs (user_id, daily_date, score, stars, modifiers, completed_at)` with unique `(user_id, daily_date)`.

### Schema (new)
```sql
rune_delve_daily_runs (
  id uuid pk, user_id uuid, daily_date date,
  score int, stars int, dungeon_cleared bool,
  modifiers jsonb, hero_class text, completed_at timestamptz,
  unique(user_id, daily_date)
)
rune_delve_daily_streaks (
  user_id uuid pk, current_streak int, best_streak int,
  last_completed_date date, lifetime_clears int
)
```

---

## Pillar 3 — Class Mastery System

Each class gets a **5-tier mastery track** unlocked by *that class's* lifetime XP (already tracked per-class in `rune_delve_class_progress`). Tiers are gentle, build-defining buffs that reward main-ing a class without breaking balance.

### Mastery tiers (apply to that class only, in any run)

| Tier | Unlock | Warrior | Mage | Rogue | Cleric |
|---|---|---|---|---|---|
| **I** | Class Lv 5 | +5% red chain damage | Start with 1 mana | +2 score per gold tile cleared | First chain heals 5 HP |
| **II** | Class Lv 15 | +1 max HP per chapter | Blue chains heal 2 HP | First chain of fight crits | Shields last +1 turn |
| **III** | Class Lv 30 | Cleave hits for 50 dmg (was 40) | Arc Burst chains to 2nd target at 30% | Shadowstep also clears 1 enemy ability cooldown | Sanctuary heals 40 (was 30) |
| **IV** | Class Lv 50 | First time HP ≤ 25%: gain 2-turn shield (1×/run) | Mana cap 5 (was 4) | Crit chance: 10% on chains 4+ | On revive (any source): also heal allies adjacent enemies for damage |
| **V** | Class Lv 75 | "Last Stand": below 20% HP, +50% damage | "Overflow": every 4th mana spent refunds 1 | "Master Thief": +1 shard per chain | "Aegis": once/run, fully block a fatal hit |

### Implementation
- New file `src/lib/runedelve/classMastery.ts` exporting `MASTERY_TIERS: Record<HeroClass, MasteryTier[]>` and `getActiveMasteries(cls, classLevel): MasteryId[]`
- New `relicEffects.ts` companion `masteryEffects.ts` with helpers like `getMasteryStartingMana(cls, lvl)`, `getMasteryDamageMult(cls, lvl, chainType)` etc.
- `RuneDelvePlayPage.tsx` calls `getActiveMasteries` once on run start and passes into the same mod-stacking pipeline relics already use
- No DB changes — derives entirely from `rune_delve_class_progress.level`

---

## Pillar 4 — In-Game Codex (the "explained without clutter" piece)

A single sheet/page that consolidates everything new, accessible from:
1. A **📖 Codex** button in `RuneDelveHUD` (replacing nothing — added to the HUD's right side next to shards on home only)
2. Auto-opened the first time a player encounters anything new (mechanic, modifier, mastery unlock) — same `seenMechanicKey` localStorage pattern that already exists

### Codex contents (4 tabs)
- **Mechanics** — every unlocked mechanic with its icon, family chip, full rule, and example image
- **Daily** — today's modifiers + their rules + your streak status
- **Masteries** — your hero's class track with locked/unlocked tiers, "next unlock at Lv X" progress bar
- **Relics** — pulled from existing relic catalog (compact view)

Mastery unlocks fire a celebratory toast (existing `Confetti` + sound utility) with a "View in Codex" CTA — discovery without forcing a modal mid-run.

---

## Files changed / created

**New files:**
- `src/lib/runedelve/shiftingRunes.ts` — column-drift engine
- `src/lib/runedelve/linkedPairs.ts` — pair generation + clear cascade
- `src/lib/runedelve/eclipseTiles.ts` — dim-tile state + chain validation hook
- `src/lib/runedelve/dailyChallenge.ts` — date-seeded modifier roll + scoring
- `src/lib/runedelve/dailyModifiers.ts` — modifier registry + effect helpers
- `src/lib/runedelve/classMastery.ts` — tier definitions
- `src/lib/runedelve/masteryEffects.ts` — combat hook helpers
- `src/hooks/useDailyChallenge.ts` — fetch today's run, submit, streak
- `src/pages/RuneDelveDailyPage.tsx` — Daily mode landing + leaderboard
- `src/components/runedelve/CodexSheet.tsx` — 4-tab consolidated reference
- `src/components/runedelve/MasteryUnlockToast.tsx`

**Edited:**
- `src/lib/runedelve/mechanics.ts` — register 3 new mechanics, shift band ranges
- `src/lib/runedelve/levelGenerator.ts` — wire new mechanics into `mechanicsForLevel`
- `src/lib/runedelve/boardEngine.ts` — `applyShift` / linked-pair clear cascade
- `src/components/runedelve/RuneCell.tsx` — eclipse + linked + shift indicators
- `src/components/runedelve/RuneBoard.tsx` — render shift arrows + linked threads
- `src/components/runedelve/RuneDelveHUD.tsx` — add 📖 Codex button (home only)
- `src/pages/RuneDelvePlayPage.tsx` — apply mastery effects, support daily mode via `?daily=1`
- `src/pages/RuneDelveHomePage.tsx` — Daily Challenge card (above campaign)
- `src/App.tsx` — add `/rune-delve/daily` route

**DB migration:** `rune_delve_daily_runs` + `rune_delve_daily_streaks` tables with RLS (own rows read/write).

## Open questions before build

1. **Shifting Runes direction** — should it slide *down* (gentler — runes fall off the bottom) or *up* (harsher — disrupts top stacks)? My recommendation: **down**, since it pairs naturally with the existing gravity system.
2. **Daily reset time** — 00:00 UTC (global, fair) or 00:00 local time (better UX, but "first to clear" leaderboards become meaningless)? Recommend **UTC**.
3. **Mastery V "Last Stand" warrior** — does it stack with the existing `last_stand` relic, or do they share a per-run cap? Recommend **stack** (relic = revive, mastery = damage).

