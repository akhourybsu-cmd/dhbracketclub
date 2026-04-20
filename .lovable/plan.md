

# Rune Delve — Daily Fantasy Puzzle Mode

A new daily-shared, mobile-first puzzle game added as the centerpiece of the Compete section. Players match-and-chain runes on a 5x5 grid to defeat enemies, earn XP, and climb a daily leaderboard with their hero.

---

## 1. Compete section restructure

The Compete page (`/compete`) is reorganized so Rune Delve becomes the featured daily challenge and Lockbox is repositioned as a secondary game.

```text
┌─────────────────────────────────────┐
│  COMPETE                            │
│                                     │
│  [ Season ] [ Rune Delve ] [Other]  │  ← 3 tabs
│                                     │
│  Season tab:    (existing seasons)  │
│  Rune Delve:    today's daily run   │
│  Other:         Lockbox + Pickem    │
│                 + Brackets links    │
└─────────────────────────────────────┘
```

- The existing `LockboxCompeteCard` is moved out of the main Compete view and into the new "Other" tab alongside small entry cards for Pick'em and Brackets.
- Sidebar "Compete" group (desktop) is updated: Rune Delve added above Lockbox; Lockbox stays accessible but lower in priority.
- All existing routes (`/lockbox`, `/pickem`, `/brackets`) remain unchanged — only the visual prominence shifts.

---

## 2. New routes & screens

| Route | Screen | Purpose |
|---|---|---|
| `/rune-delve` | **Rune Delve Home** | Today's challenge banner, hero snapshot, streak, leaderboard preview, big "Enter Dungeon" CTA |
| `/rune-delve/play` | **Daily Puzzle** | 5x5 rune board, enemies, turn counter, ability button |
| `/rune-delve/results` | **Daily Results** | Score breakdown, XP gained, streak, leaderboard placement |
| `/rune-delve/leaderboard` | **Daily Leaderboard** | Today's rankings with class badges, clear marker, streaks |
| `/rune-delve/hero` | **Hero Profile** | Class, level, XP bar, streak, lifetime stats, class change (once per season) |
| `/rune-delve/history` | **History** | Past daily runs, scores, leaderboard placement |

All routes wrapped in existing `ProtectedPage` lazy loader.

---

## 3. Data model (new tables)

```text
rune_delve_heroes
  id, user_id (unique), hero_name, class (warrior|mage|rogue|cleric),
  level, xp, current_streak, best_streak, lifetime_runs,
  lifetime_score, cosmetic_title, created_at, updated_at

rune_delve_dungeons          -- one row per day, shared by all players
  id, run_date (unique date), seed (int, deterministic board+enemy gen),
  enemy_config (jsonb: [{hp,dmg,trait}]), max_turns (default 10),
  created_at

rune_delve_runs              -- one official run per user per day
  id, user_id, dungeon_id, score, enemies_defeated, dungeon_cleared (bool),
  turns_used, total_damage, longest_chain, hp_remaining, xp_earned,
  ability_used (bool), pick_log (jsonb: array of chains for replay),
  completed_at, created_at
  UNIQUE (user_id, dungeon_id)

rune_delve_daily_leaderboard -- materialized via view OR computed client-side
  (we'll use a SELECT view + rank() window over rune_delve_runs)
```

RLS: all authenticated users can SELECT everything (social leaderboard); INSERT/UPDATE only on own rows. Heroes auto-created on first visit via a `useEnsureHero()` hook (client-side upsert).

---

## 4. Game mechanics (MVP)

**Board** — 5x5 grid of runes from 4 colors:
- 🔴 Red = Attack (damages enemy)
- 🔵 Blue = Mana (charges class ability)
- 🟢 Green = Heal (restores HP)
- 🟡 Gold = Guard (reduces next incoming damage)

**Player turn** — Touch-and-drag to chain 3+ adjacent (orthogonal) matching runes. Release to resolve:
1. Chain effect applies (damage / mana / heal / guard) scaled by chain length.
2. Matched runes removed, board refills from above (gravity + new rune drops via the deterministic seed).
3. Living enemies act → deal damage to player (mitigated by Guard).
4. Turn counter decrements.

**Run ends** when: all enemies defeated (clear bonus), HP reaches 0, or 10 turns elapse.

**Hero classes & passives**

| Class | Passive | Ability (3 Blue charges) |
|---|---|---|
| Warrior | Red chains +25% damage | **Cleave** — damage all enemies |
| Mage | Blue chains +1 mana | **Arc Burst** — heavy single-target |
| Rogue | Chains of 5+ grant +50% score | **Shadowstep** — next attack +dmg & +score |
| Cleric | Green chains +50% heal | **Sanctuary** — heal + 2-turn shield |

**Scoring** — final score = `(damage × 1) + (enemies_defeated × 200) + (hp_remaining × 5) + (turns_remaining × 50) + (longest_chain × 25) + (cleared ? 500 : 0)`.

**Fairness** — XP/level only unlock cosmetic titles and a class-change token; **no stat scaling** affects daily score. All players face the identical seeded board and enemies.

**Determinism** — `dungeons.seed` drives a seeded PRNG (mulberry32) for board layout, enemy stats, and refill draws → all players get the same experience.

---

## 5. Components to build

```text
src/pages/
  RuneDelveHomePage.tsx
  RuneDelvePlayPage.tsx
  RuneDelveResultsPage.tsx
  RuneDelveLeaderboardPage.tsx
  RuneDelveHeroPage.tsx
  RuneDelveHistoryPage.tsx

src/components/runedelve/
  RuneBoard.tsx          -- 5x5 grid, touch chain detection
  RuneCell.tsx           -- single rune w/ animation
  EnemyDisplay.tsx       -- HP bars, damage indicators
  HeroStatusBar.tsx      -- HP, mana orbs, ability button
  TurnIndicator.tsx
  ScoreBreakdown.tsx
  ClassBadge.tsx
  HeroAvatar.tsx
  ChainPreview.tsx       -- shows pending chain effect
  DailyChallengeBanner.tsx

src/hooks/
  useRuneDelveHero.ts    -- ensure + fetch hero
  useTodayDungeon.ts     -- fetch/generate today's dungeon
  useMyTodayRun.ts       -- has user played?
  useDailyLeaderboard.ts
  useRunHistory.ts

src/lib/runedelve/
  prng.ts                -- mulberry32 seeded RNG
  boardEngine.ts         -- chain detection, gravity, refill
  combatEngine.ts        -- damage calc, ability resolution
  scoring.ts
  classConfig.ts         -- class passives & ability defs
  dungeonGenerator.ts    -- seed → board + enemies
```

---

## 6. Mobile-first interaction details

- 5x5 board sized to `min(100vw - 32px, 360px)` so each rune is ~64px touch target on a 411px viewport — well above 44px standard.
- Chain drag uses pointer events with light haptic (existing `useSoundEffect` + `navigator.vibrate(10)`) on each new rune added.
- Single-handed: ability button thumb-reachable bottom-right; back/exit top-left.
- Result screen uses existing `Confetti` on dungeon clear or top-3 placement.
- Glass-card styling, Arena emerald/charcoal palette for chrome; the 4 rune colors are the only saturated game-only hues.

---

## 7. Implementation order

1. **DB migration** — create 3 tables + RLS + a `daily_leaderboard` view; add a SQL function `ensure_today_dungeon()` that inserts a row with a random seed if today's row is missing.
2. **Compete restructure** — convert `CompetePage` content into 3 tabs (Season / Rune Delve / Other), move Lockbox card to Other tab, add Rune Delve hero card to its tab.
3. **Sidebar update** — `AppLayout.tsx` Compete section: add Rune Delve, demote Lockbox below it.
4. **Routes** — register 6 lazy routes in `App.tsx`.
5. **Engine libs** — PRNG, board, combat, scoring, classes (pure TS, unit-testable).
6. **Hero + dungeon hooks** — first-visit hero creation, today's dungeon fetch.
7. **Home page** + leaderboard preview.
8. **Play page** — RuneBoard with drag chains, enemy AI, ability flow.
9. **Results page** with XP/streak update mutation.
10. **Leaderboard + history + hero pages.**
11. **Polish pass** — animations, confetti, sound, haptics, empty states, skeletons.

---

## 8. Out of scope (MVP)

- Practice / unranked mode (schema supports it; UI deferred).
- Cosmetic shop, custom hero portraits beyond initial avatar.
- Multi-encounter dungeon chains.
- Push notification reminders for new daily (can be added via existing push system later).

---

## 9. Manual testing checklist (post-implementation)

- Compete page: 3 tabs render, Rune Delve is default, Lockbox visible under Other.
- New user: hero auto-created on first `/rune-delve` visit; class selection prompt appears.
- Two test users get an identical board for the same date (deterministic seed).
- Chain detection: 3-chain works, 5-chain triggers Rogue bonus, ability charges from Blue.
- Run can only be submitted once per day (UNIQUE enforced + UI shows "Come back tomorrow").
- Leaderboard ranks correctly, my row highlighted, class badges visible.
- History page lists past runs with placement.
- All 6 screens responsive at 360px, 411px, 768px, desktop sidebar.
- Lockbox still fully functional via Other tab and `/lockbox`.

