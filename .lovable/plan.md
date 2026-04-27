## Daily Challenge → Endless Survival Mode

Replace the current "play a seeded level with daily modifiers" daily challenge with a **timed endless survival arena**: one continuous fight, no move limit, no chapters, no objectives — just the player vs. an unending stream of enemies until the timer hits zero or they die.

### Core Design

**Format:**
- Fixed time limit: **2:00 minutes** per attempt (single countdown, visible HUD timer)
- One run per day per player (existing daily uniqueness preserved)
- Player picks runes freely — **no turn/move limit**
- Enemies spawn continuously: clear an enemy → next spawns shortly after, with difficulty ramping over time
- Run ends when: (a) timer reaches 0, or (b) HP reaches 0
- No level number, no chapters, no secondary objectives, no boss mechanics — pure combat loop

**Scoring & Rewards (kill-count driven):**
- Score = enemies defeated × tier multiplier + bonus for damage dealt
- Reward tiers based on kill count (scaled to encourage character investment):
  - 0–4 kills → 25 shards (participation)
  - 5–9 kills → 75 shards
  - 10–14 kills → 150 shards
  - 15–19 kills → 250 shards
  - 20–29 kills → 400 shards + cosmetic title progress
  - 30+ kills → 600 shards + "Endless Conqueror" title at 30+, "Eternal" title at 50+
- XP scales linearly with kills (10 XP per kill, capped at 500)

**Difficulty ramp (every 20 seconds):**
- Wave 1 (0:00–0:20): basic enemies, single spawn
- Wave 2 (0:20–0:40): +20% enemy HP, occasional 2-enemy spawns
- Wave 3 (0:40–1:00): +50% enemy HP, mini-boss variants appear
- Wave 4 (1:00–1:30): +100% enemy HP, all spawns are 2-enemy
- Wave 5 (1:30–2:00): +200% enemy HP, boss variants in pool — "Final Push"

**Why this incentivizes character investment:**
- Stronger relics + class masteries = faster kills = more enemies cycled = bigger rewards
- A weak loadout caps out around 5–10 kills; a tuned loadout pushes 25+

### Streak & Leaderboard

- Streak still rewards consecutive **days played** (lower the bar from "cleared" to "attempted with ≥5 kills" since there's no clear/fail anymore)
- Leaderboard ranks by **kill count** primarily, score as tiebreaker
- "Stars" repurposed: ★ = 5+ kills, ★★ = 15+ kills, ★★★ = 25+ kills

### Files Changed

**New:**
- `src/pages/RuneDelveEndlessPage.tsx` — the new survival play screen (timer HUD, continuous enemy spawner, kill counter, end-of-run summary)
- `src/lib/runedelve/endlessMode.ts` — wave config, enemy spawn pool by time, reward tier calculator, `endlessStarsFor(kills)` helper

**Modified:**
- `src/lib/runedelve/dailyChallenge.ts` — strip modifier rolling and `dailyLevelFor`; keep date helpers; add `endlessTimeLimit = 120` constant and `endlessRewardFor(kills)`
- `src/hooks/useDailyChallenge.ts` — `useTodayDaily()` returns `{ dateStr, timeLimit }` only (no modifiers/level); `useSubmitDailyRun()` accepts `{ kills, score, heroClass }`; streak now bumps on attempts ≥5 kills
- `src/pages/RuneDelveDailyPage.tsx` — remove the modifiers section and "Today's Trial" copy; show "Endless Survival · 2 minutes" hero, kill-count reward ladder, leaderboard ranked by kills
- `src/pages/RuneDelvePlayPage.tsx` — remove `?daily=1` branch and all daily-modifier injection (lines 66–81, 144–153, daily mods in combat). Daily mode no longer routes here.
- Routing: `/rune-delve/daily` "Begin" CTA points to a new `/rune-delve/endless` route registered in `src/App.tsx`

### Database

**Migration on `rune_delve_daily_runs`:**
- Add `kills_count int not null default 0`
- Repurpose existing `score` (still used) and `stars` (now derived from kills)
- `dungeon_cleared` becomes legacy/unused — keep column for back-compat, always write `false`
- `modifiers` jsonb — keep column, always write `[]`
- No new table; the unique `(user_id, daily_date)` constraint still gates "one run per day"

**Migration on `rune_delve_daily_streaks`:**
- No schema change. Logic in `useSubmitDailyRun` updates streak when `kills ≥ 5` instead of when `cleared = true`.

### Technical Notes

- Endless page uses the existing `RuneBoard`, `combatEngine.applyChain`, `EnemyDisplay`, `HeroStatusBar` — no combat logic rewrite. We bypass `endTurn` move-limit checks and replace `enemiesAttack` cadence with a time-based enemy AI tick (every 4s an alive enemy attacks; faster as waves progress).
- Enemy spawner picks from `ENEMY_ROSTER` filtered by current wave tier; uses `spawnWave()` helper already exported from `combatEngine`.
- Run snapshot/rehydrate from `runSnapshot.ts` is **disabled** for endless (one continuous run, no resume — if the player closes the app, the run ends).
- Class masteries, relics, and shards economy all still apply during the endless run, so character power directly drives kill throughput.
- Streak rules: if last_completed_date == today → no change; if == yesterday → +1; else → 1. Lifetime counter increments on any attempted run with ≥5 kills.

### Open Question

The plan uses **2:00** as the timer. If you'd prefer 1:30 (tighter, more frantic) or 3:00 (more room for slow class builds), say the word and I'll adjust the constant before building.