

# NFL Pick'em — Mobile-First Plan

A new season-long competition mode added to **Compete → More tab**, fitting alongside Polls/Rankings/Lockbox under the existing Arena identity.

## How it works (product summary)

- One active **NFL season** (e.g., "2025 NFL Season") with weekly slates (Weeks 1–18 regular season, expandable to playoffs later).
- Each user picks one **winner per game** in the current week.
- Picks lock **per game at kickoff** (game-level locking — this is the clean MVP, and what the spec prefers).
- 1 point per correct pick. No spreads, no confidence, no survivor.
- One **featured tiebreaker game** per week: predict total combined points. Used for weekly tiebreaks.
- Season ranking by total correct picks → tiebreakers: best avg weekly finish → cumulative tiebreaker accuracy.

## Where it lives in the app

- New entry on `CompetePage.tsx` "More" tab: **NFL Pick'em** card (amber/gold accent to differentiate from emerald Drafts).
- Routes added under `/pickem`:
  - `/pickem` → Home
  - `/pickem/week/:weekNumber` → Make Picks / Slate
  - `/pickem/week/:weekNumber/results` → Weekly Results
  - `/pickem/standings` → Season Standings
  - `/pickem/history` → My Pick History
  - `/pickem/rules` → Rules
  - `/pickem/admin` → Admin (gated to `is_app_admin`)
- Dashboard "Needs Your Attention" gets a new card: *"Week N picks due — X games unpicked"* when current week is open and user has incomplete picks.

## Mobile-first UX

```text
Home (/pickem)
┌────────────────────────────┐
│ 2025 NFL Pick'em           │
│ Week 7 · Thu 8:20 PM lock  │
│ ┌────────────────────────┐ │
│ │ Make Your Picks   →    │ │  ← big amber CTA
│ │ 3 of 14 picked         │ │
│ └────────────────────────┘ │
│ Your season: 42–28 · #3    │
│ ── Recent Results ──       │
│ Week 6: 11/14 · #2         │
└────────────────────────────┘

Week Slate (/pickem/week/7)
┌────────────────────────────┐
│ ← Week 7      [3/14 ✓]     │
│                            │
│ Sun 1:00 PM     [UNLOCKED] │
│ ┌──────────┬──────────┐    │
│ │ ● BUF 🦬 │   KC 🏈  │    │  ← tap team to pick
│ │ selected │          │    │
│ └──────────┴──────────┘    │
│                            │
│ Sun 4:25 PM     [LOCKED]   │
│ ┌──────────┬──────────┐    │
│ │   PHI    │ ● DAL ✓  │    │  ← post-game: green ✓ or red ✗
│ └──────────┴──────────┘    │
│                            │
│ ⭐ Tiebreaker (SNF):       │
│ Total points: [  45  ]     │
└────────────────────────────┘
```

Game cards: full-width, two big tap targets (away | home), ≥56px tall. Selected state = amber fill + ring. Locked = muted + lock icon, no taps. Final = green check on correct, red X on wrong, neutral on unpicked locked games.

## Data model (new tables)

```text
nfl_seasons
  id, year, name, status (upcoming|active|complete),
  current_week, starts_at, ends_at, created_at

nfl_teams
  id, abbr (BUF), name (Bills), city, conference (AFC/NFC),
  division, primary_color, logo_url

nfl_weeks
  id, season_id, week_number, label ("Week 7"),
  starts_at, ends_at, status (upcoming|open|partially_locked|closed|scored),
  featured_game_id (tiebreaker)

nfl_games
  id, season_id, week_id, away_team_id, home_team_id,
  kickoff_at, status (scheduled|live|final),
  away_score, home_score, winner_team_id,
  external_provider, external_id

nfl_picks
  id, user_id, game_id, week_id, season_id,
  picked_team_id, is_correct (nullable), points_awarded,
  created_at, updated_at
  UNIQUE(user_id, game_id)

nfl_tiebreakers
  id, user_id, week_id, predicted_total,
  actual_total (nullable), delta (nullable)
  UNIQUE(user_id, week_id)

nfl_weekly_standings
  id, user_id, week_id, season_id,
  correct_picks, total_picks, accuracy, tiebreak_delta,
  rank, updated_at

nfl_season_standings
  id, user_id, season_id,
  total_correct, total_picked, accuracy,
  weekly_wins, avg_weekly_rank, rank, updated_at
```

**RLS pattern:** all tables `SELECT` open to authenticated. `picks`/`tiebreakers` INSERT/UPDATE gated by `auth.uid() = user_id` AND a security-definer function `is_pick_unlocked(game_id)` that checks `kickoff_at > now()`. Admin-only writes on seasons/weeks/games/teams via `is_app_admin(auth.uid())`.

**Provider abstraction:** `nfl_games.external_provider` + `external_id` mirror the bracket sync pattern. MVP: admin manually enters/edits via Admin page, with seed CSV for the season schedule. Future: ESPN/SportsDataIO edge function. Scoring runs in a `score-nfl-week` edge function — idempotent upsert, recomputes both standings tables.

## Lock logic

- Per-game lock: pick can only be inserted/updated where `nfl_games.kickoff_at > now()`.
- Enforced in **3 layers**: RLS policy (definer function), edge function validation, and UI disable.
- Week status auto-derived: `open` (no games kicked) → `partially_locked` (some live/final) → `closed` (all kicked) → `scored` (admin/cron finalized).

## Scoring flow

1. Admin enters final score in Admin page (or future cron syncs).
2. Trigger on `nfl_games` UPDATE when `status → final`: sets `winner_team_id`, then calls scoring edge function for that week.
3. Edge function: marks `nfl_picks.is_correct`, recomputes `nfl_weekly_standings` and `nfl_season_standings`, ranks with tiebreakers.
4. Realtime: subscribe `nfl_weekly_standings` + `nfl_games` so leaderboards/results update live during Sunday games.

## Screens summary

| Screen | File | Purpose |
|---|---|---|
| Home | `pages/PickemHomePage.tsx` | Week status, CTA, season snapshot, recent results |
| Week Slate | `pages/PickemWeekPage.tsx` | Game cards + tiebreaker input |
| Weekly Results | `pages/PickemWeekResultsPage.tsx` | Per-game ✓/✗, weekly leaderboard |
| Season Standings | `pages/PickemStandingsPage.tsx` | Full season leaderboard |
| Pick History | `pages/PickemHistoryPage.tsx` | Weekly accordion of past picks |
| Rules | `pages/PickemRulesPage.tsx` | Static, mobile-readable |
| Admin | `pages/PickemAdminPage.tsx` | Season/week/game CRUD, set finals, set tiebreaker game |

Plus components: `GamePickCard`, `WeekNavigator`, `PickemStandingsRow`, `TiebreakerInput`, `WeekStatusPill`.

## What we're seeding

- 32 NFL teams (abbr, name, city, colors, logos via static asset URLs).
- One placeholder season: "2025 NFL Season" in `upcoming` status. Admin populates schedule via the Admin page (paste/import flow — JSON paste for MVP, with a parse helper).

## Future expansion preserved

- `nfl_seasons` allows multiple seasons (archive past years).
- Pick/standings tables are season-scoped → ready for multiple leagues by adding `league_id`.
- Provider fields ready for live sync edge function.
- Scoring function is single-source — adding confidence points = one column + formula change.
- Survivor mode = new picks table variant, won't conflict.
- Playoff weeks = same model with `week.label = "Wild Card"` etc.

## Manual testing checklist (post-build)

1. Mobile: tap targets ≥44px, week navigator swipe-friendly.
2. Lock enforcement: try picking after kickoff (UI + RLS).
3. Update pick before lock — works.
4. Admin enters final → standings recompute, realtime updates.
5. Tiebreaker tie scenario.
6. Empty states (no week, no picks, season not started).
7. Safe-area insets on iPhone PWA, fixed bottom nav doesn't cover CTA.
8. Dashboard "Attention" card appears when picks incomplete.

