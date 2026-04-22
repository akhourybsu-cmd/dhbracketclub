

## Rune Delve — Bosses, Mini-Bosses, Waves & Bestiary Backfill

Three issues, one cohesive pass: fix the silent Bestiary, add a real boss/mini-boss cadence, and introduce balanced multi-wave fights now that turn budgets allow it.

---

### 1) Bestiary — fix tracking + retroactive backfill

**Root cause:** Persisted `rune_delve_levels` rows created before the roster system have `enemy_config` entries with no `archetypeId` (e.g. L1 = `{name: "Cave Bat", emoji: "🦇", hp:45, damage:4}`). When the play page hydrates enemies it copies `archetypeId` straight through — `undefined` → `recordKill()` no-ops → 0 rows in `rune_delve_bestiary` despite 113 kills across two top players.

**Fix (forward):**
- In `RuneDelvePlayPage.tsx` enemy hydration, add a name→archetype-id resolver fallback: when `e.archetypeId` is missing, look it up by `name` against `ENEMY_ROSTER` (case-insensitive), strip any "Elite "/"Boss " prefix first. Falls back to `null` only for truly unknown legacy stubs ("Slime").
- Add a one-time DB migration that rewrites legacy `enemy_config` rows: enrich each enemy with `archetypeId` (resolved by name, with "Slime"→`ember_slime`, "Goblin"→`goblin_scout`, etc.) so future runs log cleanly without the JS fallback.
- Combat-engine ability spawns (Bone Husk minion) already carry `archetypeId` — no change needed.

**Retroactive backfill:**
- New SQL data migration approximates per-user kills from existing `rune_delve_runs`. For each (user, level) row we know `enemies_defeated` and the `enemy_config` archetype mix on that level; distribute the kill count proportionally across the level's archetypes (favoring non-elite roles) and `INSERT … ON CONFLICT` aggregate into `rune_delve_bestiary`. Also seeds `first_defeated_at`/`last_defeated_at` from the run's `created_at`/`completed_at` and `highest_level_defeated` from the run's `level_number`.
- Adds a "Backfilled from earlier runs" toast on the player's first Bestiary visit (localStorage flag) so the surprise drop reads as intentional.

---

### 2) Boss & Mini-Boss cadence

Today only 3 boss beats exist (L130/140/150). New cadence:

| Beat | Frequency | Levels | What changes |
|---|---|---|---|
| **Mini-Boss** | every 10 levels | 10, 20, 30… (skipping major boss levels) | One enemy promoted to mini-boss: +60% HP, +10% damage, gets one signature ability tied to its family, `🥈 Mini-Boss <Name>` label, gold-ringed portrait |
| **Chapter Boss** | end of each chapter | 50, 100, 150 | Single big enemy +120% HP +20% damage, signature **boss rule** picked from the existing `BOSS_RULES` registry, intro sheet, gold crown badge |
| **Mid-Chapter Boss** | mid-chapter | 25, 75, 125 | Like chapter boss but lighter (+90% HP, no boss-rule — just stat-boosted miniboss with telegraph) |
| **Existing milestone bosses** | preserved | 130, 140, 150 | Unchanged (already use `BOSS_RULES`) |

**Boss-rule registry expansion** (so 50/75/100/125/150 don't all feel the same):
- Add 3 new rules: `splitter` (boss splits into 2 half-HP minions at 50% HP), `phaselock` (boss is immune for 1 turn after losing 25% HP — "Phasing…" telegraph), `aura` (all live enemies gain +15% damage while boss is alive).
- Total registry: 6 rules. Rotate deterministically by `(level / 25) mod 6` so each boss feels distinct.

**Implementation:**
- New helpers in `bossRules.ts`: `bossKindForLevel(n)` returning `'mini' | 'mid' | 'chapter' | null`, plus the 3 new rule defs and their `apply*` hooks (split → mutate enemies, phaselock → immune-flag with countdown, aura → damage multiplier shared by `enemyDamageMultiplier`).
- `levelGenerator.ts` consumes `bossKindForLevel` to apply HP/damage multipliers and assign the correct label (`Mini-Boss`/`Boss`).
- `MechanicIntroSheet` gains entries for the new boss rules; chapter bosses surface the existing intro flow once.
- HUD: `EnemyDisplay` gets a `tier` prop (`mini` | `boss`) drawing a gold ring + crown chip, fed from the enemy's name prefix (already encoded).

---

### 3) Multi-Wave Encounters

Now that turn limits sit at 8–12, longer levels can support a second wave without bloating the screen.

**Rules:**
- Triggered on **mid-chapter and chapter-boss levels (25, 50, 75, 100, 125, 150)** plus **every 20 levels from L60 upward** (60, 80, 120, 140 — skipping pure mini-boss beats). Never on intro/early levels (≤24).
- Wave 1 = current `enemy_config`. Wave 2 = a deterministic second roster pick (1–2 enemies, scaled to level), spawned **when wave 1 is fully cleared** (not on a turn timer).
- Spawn moment: shows a "**Wave 2 — Reinforcements!**" banner (reuses `MechanicBanner`), grants the player **+2 turns** to the remaining budget so the level stays clearable, and inserts new enemies into `combat.enemies`.
- Boss levels (50/100/150) spawn the boss **as wave 2** so wave 1 acts as a warm-up gauntlet of 2 mini-mobs first — much more "boss fight" feel.

**Storage:**
- `rune_delve_levels.enemy_config` stays as wave-1. Add `modifiers.waves: [{ enemies: Enemy[], reinforcement_turns: 2 }]` for any level with extra waves. Reader fallback: missing `waves` → no extra waves (legacy-safe).
- `combatEngine` gains `spawnWave(state, enemies, bonusTurns)` — appends enemies, bumps turn limit, no other state churn.

**Balance guards:**
- Total HP across all waves capped at **2.4× the prior single-wave budget** for that level so it isn't a difficulty cliff.
- Wave 2 never adds a 2nd ability-bearing enemy if wave 1 already had one.
- Bestiary kills from wave 2 flow through the existing `recordKill` path automatically.

---

### Files touched

**New / heavily edited**
- `src/lib/runedelve/bossRules.ts` — add `bossKindForLevel`, 3 new rules + their hooks, intro labels.
- `src/lib/runedelve/levelGenerator.ts` — boss/mini-boss promotion, wave-2 generation in `modifiers.waves`, label/HP scaling per tier.
- `src/lib/runedelve/combatEngine.ts` — `spawnWave()` helper + bonus-turns hook; integrate `aura` damage multiplier.
- `src/pages/RuneDelvePlayPage.tsx` — name→archetype fallback resolver in enemy hydrate; trigger wave-2 spawn when wave 1 clears; show "Wave 2" banner; pass mini/boss tier to `EnemyDisplay`.
- `src/components/runedelve/EnemyDisplay.tsx` — gold ring + Mini-Boss/Boss chip styling.
- `src/components/runedelve/MechanicIntroSheet.tsx` — copy for new boss rules.

**Migrations**
1. Schema-safe data migration: rewrite legacy `rune_delve_levels.enemy_config` to add resolved `archetypeId` per enemy.
2. Backfill `rune_delve_bestiary` from `rune_delve_runs` (proportional distribution, idempotent via `ON CONFLICT (user_id, archetype_id) DO UPDATE`).
3. (Optional, safe) Re-run level seeding for L1–L29 so wave-2 + boss-tier `modifiers` populate; transient-fallback already handles unseeded levels.

### Manual test checklist

- L20 (mini-boss): enemy labeled "Mini-Boss <Name>", gold ring portrait, ability fires, Bestiary logs the archetype.
- L25 (mid-chapter boss): intro sheet shows new boss rule once; +90% HP visible vs L24.
- L50/100/150 (chapter bosses): wave 1 = 2 mooks → clear → "Wave 2 — Reinforcements!" banner + boss spawns + 2 bonus turns added.
- L60/80 multi-wave (non-boss): wave 2 spawns 1–2 mid-tier enemies after wave 1 clears.
- After any run with kills: Bestiary page now reflects archetypes (forward fix verified).
- First load post-deploy: existing players see backfilled Bestiary entries with kill counts derived from past runs; one-time toast appears.
- L130/140/150 still show original `last_stand` / `regenerator` / `enrager` rules unchanged.

