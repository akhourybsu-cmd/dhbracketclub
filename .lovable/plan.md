# Bestiary Boss Tracking + Roster Expansion

Two-part content + data drop: make sure mini-boss and boss kills correctly populate the Bestiary (including past runs), then triple the enemy variety with 10 fresh archetypes per chapter.

---

## Part 1 — Mini-boss & boss tracking (forward + retroactive)

### Status check
Forward-tracking already works: `recordKill()` in `RuneDelvePlayPage.tsx` correctly appends `__mini` / `__boss` suffixes to the archetype id when the slain enemy carries a `tier` flag, and the Bestiary page renders all variants from `BESTIARY_ROSTER`. DB confirms one `shadow_imp__boss` row exists from a recent run.

What's missing: **historical runs were logged before variant tracking shipped**, so every boss/mini-boss kill prior to this week is credited only to the base archetype.

### Backfill approach
Use the per-run `rune_delve_runs` table (which preserves `level_number`, `dungeon_cleared`, `enemies_defeated`, `user_id`) plus the deterministic `bossKindForLevel()` rule to credit one variant kill per cleared boss-tier level:

- For every `rune_delve_runs` row where `dungeon_cleared = true` AND `bossKindForLevel(level_number)` is `'mini'` / `'mid'` / `'chapter'`, insert/upsert a single defeat into the variant id (`__mini` for `mini`; `__boss` for `mid` and `chapter`, since both render as the gold-ringed "Boss" variant in the journal).
- The base archetype is recovered by re-running `generateLevel(level_number)` (deterministic seed) and reading `enemies[final_slot].archetypeId`. Both wave-1 mid bosses and wave-2 chapter bosses are handled — the chapter-boss archetype lives in the wave-2 enemy list.
- Aggregate across runs per `(user_id, variant_id)` so a player who cleared L25 three times gets `defeat_count = 3` on `<base>__boss`.
- `first_defeated_at` / `last_defeated_at` use the run's `completed_at`; `highest_level_defeated` is the max `level_number` seen.

### Implementation
- **One-time migration script** (TypeScript edge function, invoked once): reads all completed runs, runs the deterministic generator for each cleared boss level, builds the variant defeat ledger, and upserts into `rune_delve_bestiary`. Idempotent — re-running it only ever updates counts to the recomputed totals (using `ON CONFLICT (user_id, archetype_id)`).
- **Pre-flight constraint check**: confirm the `rune_delve_bestiary` table has a unique constraint on `(user_id, archetype_id)`. If not, add it via migration first so the upsert is safe.
- **Retroactive toast already exists** — `RuneDelveBestiaryPage` shows a one-time "We added X foes from your earlier runs" toast keyed by `localStorage`; resetting that key forces it to re-fire after the backfill.

---

## Part 2 — 30 new enemy archetypes (10 per chapter)

Every new enemy follows the existing rubric in `enemyRoster.ts`: pick a family + role, set HP/damage in the role's stat band, slot it into a chapter + tier, and only attach an `ability` when the role calls for it. Most additions stay ability-less so the board doesn't feel spammy. Each gets a flavour line in `bestiary.ts` so the journal entry reads cleanly.

### Chapter 1 — Ember Caves (10 new — readable, iconic)
Focus: tier 1-2, no abilities (Chapter 1 ability gate stays in place). Adds variety to the mook pool so L1-30 stops repeating the same five faces.

| ID | Name | Family | Role | Tier | Notes |
|---|---|---|---|---|---|
| `ember_rat` | Ember Rat | beast | swarm | 1 | Pack filler under bats |
| `tunnel_kobold` | Tunnel Kobold | cultist | striker | 1 | Knife-and-grin variant of Goblin Scout |
| `cave_lizard` | Cave Lizard | beast | striker | 1 | Mid-band biter |
| `mossback_toad` | Mossback Toad | beast | tank | 2 | Wet-noodle alt to Ember Slime |
| `lantern_moth` | Lantern Moth | magical | swarm | 1 | Glowing nuisance, very low HP |
| `goblin_brute` | Goblin Brute | cultist | tank | 2 | Heavier Goblin profile |
| `cave_crab` | Cave Crab | cave | defender | 2 | Naturally tough shell, low DPS |
| `ember_pup` | Ember Pup | beast | striker | 2 | Quick chomp; pairs with bats |
| `dust_wisp` | Dust Wisp | magical | swarm | 1 | Tiny HP, lowest damage in pool |
| `feral_imp` | Feral Imp | magical | striker | 2 | Tier-2 striker bridge to Ch.2 |

### Chapter 2 — Crystal Hollow (10 new — tactical, some ability bearers)
Focus: tier 2-4, sprinkle of abilities (heal/shield/seal/corrupt) consistent with Chapter 2 themes. Adds replay variety in the L51-100 band.

| ID | Name | Family | Role | Tier | Ability | Notes |
|---|---|---|---|---|---|---|
| `frost_acolyte` | Frost Acolyte | cultist | caster | 3 | — | Mid-tier caster, no ability |
| `bone_archer` | Bone Archer | undead | striker | 3 | — | Glass-cannon ranged feel |
| `crystal_construct` | Crystal Construct | cave | tank | 4 | — | Stone-Golem sibling |
| `glacial_imp` | Glacial Imp | magical | striker | 3 | — | Frosty Shadow-Imp echo |
| `cult_seer` | Cult Seer | cultist | support | 3 | `shield_self` (cd 5) | Self-wards, lower threat than Warden |
| `revenant_thrall` | Revenant Thrall | undead | swarm | 2 | — | Pack filler in Ch.2 |
| `hollow_shrieker` | Hollow Shrieker | undead | support | 3 | `heal_ally` (cd 5) | Heals like Chanter, longer cd |
| `quartz_serpent` | Quartz Serpent | beast | striker | 4 | — | Late-Ch.2 mid-striker |
| `frost_warden` | Frost Warden | undead | defender | 4 | `shield_self` (cd 4) | Heavy variant Cursed-Knight pre-echo |
| `whisper_witch` | Whisper Witch | cultist | corrupter | 4 | `corrupt_tile` (cd 4) | Slower-cycle Wraith echo |

### Chapter 3 — Shattered Vault (10 new — layered, dangerous)
Focus: tier 4-5, mix of abilities and pure stat threats. Bolsters the L101+ pool, reduces "Cursed Knight again" fatigue.

| ID | Name | Family | Role | Tier | Ability | Notes |
|---|---|---|---|---|---|---|
| `void_acolyte` | Void Acolyte | corrupted | caster | 4 | — | Telegraph-friendly caster |
| `wraith_lord` | Wraith Lord | undead | corrupter | 5 | `corrupt_tile` (cd 3) | Faster-cycle Wraith |
| `sundered_titan` | Sundered Titan | cave | tank | 5 | — | Massive HP pool, low DPS |
| `void_stalker` | Void Stalker | corrupted | striker | 5 | — | Glass cannon, faster than Assassin |
| `dread_summoner` | Dread Summoner | undead | summoner | 5 | `summon_minion` (cd 6) | Echo of Bone Summoner, longer cd |
| `arcane_warden` | Arcane Warden | magical | defender | 4 | `shield_self` (cd 3) | Frequent self-shield, low DPS |
| `bone_juggernaut` | Bone Juggernaut | undead | tank | 5 | — | Pure stat tank for late game |
| `void_seer` | Void Seer | corrupted | support | 4 | `heal_ally` (cd 4) | Heals corrupted allies |
| `gloom_wisp` | Gloom Wisp | magical | swarm | 4 | — | Late-game swarm filler |
| `vault_revenant` | Vault Revenant | undead | striker | 5 | — | Rounds out Ch.3 striker pool |

### Auto-generated mini/boss variants
The existing `BESTIARY_ROSTER` builder already auto-generates `__mini` and `__boss` variants for every base archetype except `minion`. Adding 30 new bases automatically yields **60 new variant entries**, bringing the bestiary from ~48 entries to ~138 total — without any extra wiring.

### Generator integration
- `rosterPoolForLevel()` and `rosterPoolForLevelAllowingNextChapter()` already filter by `chapter <= chapter && tier <= maxTier`, so new entries appear in the picker the moment they're added — no generator changes needed.
- The Chapter-1 ability gate (`level <= 30 → filter out abilities`) protects the new Ch.2 ability bearers from showing up too early.
- Flavour text additions to `ARCHETYPE_FLAVOR` so each new entry has a Bestiary detail line; ability blurbs reuse existing entries in `ABILITY_BLURB`.

---

## Files touched

- `src/lib/runedelve/enemyRoster.ts` — append 30 new entries across CHAPTER_1/2/3 arrays.
- `src/lib/runedelve/bestiary.ts` — add 30 new flavour-text entries to `ARCHETYPE_FLAVOR`.
- `supabase/migrations/<new>_bestiary_unique_constraint.sql` — ensure unique `(user_id, archetype_id)` index for safe upsert (only if missing).
- `supabase/functions/backfill-bestiary-variants/index.ts` — one-shot edge function: reads `rune_delve_runs`, replays `generateLevel()` for cleared boss levels, upserts variant kills.
- Manual invocation note: I'll call the edge function once after deploy via `supabase--curl_edge_functions`. Idempotent, so safe to re-run.

No changes to Bestiary UI, hooks, generator, or combat engine — purely additive data + a one-time backfill.
