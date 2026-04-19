

User wants to refactor Pick'em away from 2025 (which had no participants) and set up 2026 as the first real season. Since no one picked, we can safely archive/delete the 2025 data and start fresh.

Let me check current state first, then propose.

Current state (from prior context):
- One `nfl_seasons` row for 2025, status likely 'active'
- 16 Week 1 games imported via ESPN sync for 2025
- ESPN team `external_id`s backfilled on `nfl_teams` (reusable, season-agnostic)
- No picks/tiebreakers/standings rows (no participants)

## Plan: Pick'em → 2026 as inaugural season

### 1. Archive 2025 data
- Mark existing `nfl_seasons` row (2025) as `status = 'complete'` and rename to `"2025 NFL Season (Archived – Preview)"` so it's preserved for reference but visually demoted
- Delete the 16 imported `nfl_games` rows + the `nfl_weeks` row(s) for 2025 (zero-impact: no picks reference them)
- Keeps `nfl_teams` untouched (already season-agnostic with ESPN IDs)

### 2. Create 2026 NFL Season as the new active season
- Insert new `nfl_seasons` row:
  - `year: 2026`
  - `name: "2026 NFL Season"`
  - `status: 'upcoming'` (flips to 'active' once Week 1 games sync close to kickoff)
  - `current_week: 1`
  - `starts_at`: ~Sept 10, 2026 (Thursday — NFL Week 1 traditional opener)
  - `ends_at`: ~Jan 4, 2027 (end of regular season)
- Active-season hook (`useActiveSeason`) already prefers `status='active'` and falls back to most recent — so the 2026 row will surface immediately for everyone

### 3. Admin can sync 2026 schedule when ready
- ESPN endpoint already accepts `?dates={year}&seasontype=2&week={n}` — no code change needed
- Admin opens `/pickem/admin`, clicks "Import full season schedule" once 2026 data is published by ESPN (typically May 2026)
- Until then the home page shows the "season hasn't started" empty state

### 4. Optional polish
- Add a small "Inaugural Season" badge/copy on `PickemHomePage` for 2026 to mark it as the first real run
- Keep the archived 2025 row hidden from any selectors (only `status IN ('upcoming','active')` shows in pickers — already the case in `useActiveSeason`)

### Files touched
- One data migration (archive 2025 + insert 2026 + delete stale games/weeks) — single SQL operation
- Optional: `src/pages/PickemHomePage.tsx` — small "Inaugural Season" tag for 2026

### What the user sees after
- `/pickem` shows "2026 NFL Season — Upcoming" with empty-state CTA
- Admin dashboard ready to import the 2026 schedule when ESPN publishes it
- 2025 row archived and out of the way

