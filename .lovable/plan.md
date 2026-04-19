

## Pick'em Schedule Hookup — Gap Scan & Free-Source Plan

### What's already in place
- ✅ Tables: `nfl_seasons`, `nfl_weeks`, `nfl_games`, `nfl_teams` (32 seeded), picks, tiebreakers, standings
- ✅ Admin page: manual one-game-at-a-time entry, set finals, score week
- ✅ Scoring edge function (`score-nfl-week`) — works idempotently
- ✅ `external_provider` + `external_id` columns already on `nfl_games` (provider-agnostic, ready)

### What's missing for a real season import
1. **No bulk schedule import** — admin would have to add ~272 regular-season games one by one
2. **No live score sync** — admin must hand-enter every final score
3. **No automated week locking / current-week advance** — relies on manual status changes
4. **No `external_id` on `nfl_teams`** — can't reliably match a provider's team to ours
5. **No scheduled job** to fetch scores during Sunday windows
6. **No "Sync now" button** in admin to pull this week's results on demand

### Free, no-key data sources (ranked)

| Source | Cost | What it gives | Good for | Gotchas |
|---|---|---|---|---|
| **ESPN hidden JSON API** (`site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=N&seasontype=2`) | Free, no key, no signup | Full schedule, kickoffs, live + final scores, team abbrs, week structure | **Best fit for MVP** — schedule import + live scoring | Unofficial; could change. Rate-limit politely. |
| **NFLverse `nflverse-data` GitHub releases** (`schedules.csv`) | Free, no key | Full historical + upcoming schedule CSV | Bulk preseason import | No live scores; updated daily |
| **TheSportsDB v1** (used elsewhere in app for player images) | Free key | Schedule + scores | Backup | Slower updates, less reliable for live |
| **MySportsFeeds / SportsDataIO** | Paid free tier (limited) | Everything | Future upgrade | Requires signup + key |

**Recommendation:** ESPN scoreboard endpoint as primary (schedule + live scores in one call), NFLverse CSV as a one-shot preseason backup. Both are free, no API key, no user signup.

### Build plan

**1. Migration**
- Add `external_id text` and `external_provider text` to `nfl_teams`
- Backfill ESPN team IDs for all 32 teams (one SQL UPDATE)

**2. New edge function: `sync-nfl-week`** (admin-only, also cron-callable)
- Input: `{ season_year, week_number }`
- Calls ESPN: `/scoreboard?dates={year}&seasontype=2&week={n}`
- For each event:
  - Find/create `nfl_week` row
  - Upsert `nfl_games` keyed on `(week_id, external_id)` — idempotent
  - When `status=final`, set `winner_team_id`, `away_score`, `home_score`
- After sync: invoke `score-nfl-week` for that week automatically

**3. Admin UI additions** (`PickemAdminPage.tsx`)
- **"Import full season schedule"** button → loops weeks 1-18, calls `sync-nfl-week`
- **"Sync this week now"** button on the active week
- Shows last-synced timestamp per week

**4. Optional cron (pg_cron + pg_net)**
- Sundays every 15 min during game windows: call `sync-nfl-week` for `season.current_week`
- Tuesday 6 AM: advance `season.current_week` if all prior week's games are final

**5. Auto-derived week status**
- Trigger on `nfl_games` UPDATE: recompute parent `nfl_weeks.status` (open → partially_locked → closed → scored) so admin doesn't manage it manually

### What user needs to decide
- Do you want the **cron auto-sync** during Sundays, or just a manual "Sync Now" button for the MVP? Cron requires `pg_cron`/`pg_net` (already used in the app for Lockbox, so available).
- Should we import the **full 2025 schedule now** (preseason + regular season weeks 1-18) or wait until you're closer to Week 1?

### Files to touch
- New: `supabase/functions/sync-nfl-week/index.ts`
- New migration: add `external_id` to `nfl_teams` + backfill ESPN IDs + week-status trigger
- Edit: `src/pages/PickemAdminPage.tsx` — add sync buttons
- Optional new migration: pg_cron schedule rows

