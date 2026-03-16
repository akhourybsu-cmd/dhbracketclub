

## Problem

The app's tournament is configured as `season_year: 2026`, so the ESPN sync fetches scoreboard data for dates March 17–April 10, **2026**. But ESPN's API only has real bracket data for completed/current seasons (through 2025). The 67 events returned for 2026 dates appear to be projection/placeholder data — not the actual announced bracket. This is why the First Four matchups (and likely other games) don't match reality.

The real 2025 NCAA tournament data lives at 2025 dates (e.g., `20250318`), not 2026.

## Root Cause

`generateTournamentDates(seasonYear)` uses the `season_year` directly as the calendar year. Since `season_year = 2026` and ESPN doesn't have real 2026 tournament data yet, the API returns incorrect/projected data.

## Plan

### 1. Update the tournament's `season_year` to 2025

The simplest fix: update the tournament record to `season_year = 2025` so the ESPN provider queries dates in March–April 2025 where real bracket data exists.

This is a single database update:
```sql
UPDATE tournaments 
SET season_year = 2025, external_season_id = '2025' 
WHERE id = '00000000-0000-0000-0000-000000000001';
```

### 2. Clear stale game-external mappings

Since the current mappings point to incorrect 2026 ESPN event IDs, they need to be cleared so the reconciliation engine can re-match against real 2025 data:
```sql
DELETE FROM game_external_mappings 
WHERE tournament_id = '00000000-0000-0000-0000-000000000001';
```

### 3. Trigger a full sync

After the DB update and mapping cleanup, trigger a full sync from Admin Tools. This will:
- Fetch real 2025 ESPN scoreboard data (correct First Four matchups, correct seeds, correct regions)
- Re-map all 67 games via the reconciliation engine
- Update team names from real 2025 data (Auburn, Duke, Houston, Florida as 1-seeds)

### 4. Optional: Add season year fallback logic in the edge function

To prevent this issue in the future, add a small guard in `generateTournamentDates` that checks if the season year is in the future relative to the current ESPN data, and falls back to `year - 1`. This is a minor improvement for resilience.

## What stays the same
- All game reconciliation logic
- All bracket/scoring/standings logic  
- No schema changes needed
- No code changes required (just DB update + re-sync)

