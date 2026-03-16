

## Problem

The `teams` table contains placeholder/old data (e.g., UConn as 1-seed East, Purdue as 1-seed Midwest). The current sync pipeline fetches real ESPN data but **never updates team names** — it only matches external teams to internal records by seed+region and then updates game schedules/results. So even after syncing, the team names remain stale.

Duke being the real 1-seed in the East means the internal record with `seed=1, region=East` still says "University of Connecticut" instead of "Duke."

## Root Cause

The `buildTeamLookup` function maps ESPN teams to internal teams by `(seed, region)` but never writes the actual team name back. The `syncGames` action updates game records (team IDs, scores, schedule) but skips team metadata.

## Plan

### 1. Update the sync-games edge function to also upsert team data

Add logic inside `syncGames` (or as a new preliminary step in `runFullSync`) that, after fetching external teams from ESPN:
- Matches each external team to an internal team by `(seed, region)` — same as today
- **Updates** the matched internal team's `school_name` and `short_name` with the real ESPN values

This is a ~15-line addition inside the existing `syncGames` function, right after `buildTeamLookup` completes. For each entry in the lookup, update the corresponding team record:

```ts
// After buildTeamLookup, update team names from provider
for (const ext of externalTeams) {
  const internalId = teamLookup.get(ext.externalTeamId);
  if (internalId) {
    await db.from("teams").update({
      school_name: ext.schoolName,
      short_name: ext.shortName,
    }).eq("id", internalId);
  }
}
```

### 2. Add RLS policy for service-role team updates

The `teams` table currently has no UPDATE policy. The edge function uses the service role key, so this should work without RLS changes. I will verify the edge function is using `SUPABASE_SERVICE_ROLE_KEY` (it likely is, since it already writes to `sync_events` and `game_external_mappings` which also lack public write policies).

### 3. Trigger a sync after deployment

After deploying the updated edge function, you can trigger a full sync from the Admin Tools page, which will pull current ESPN data and update all team names to the real 2025/2026 bracket (Duke as 1-seed East, etc.).

## What stays the same
- All existing game reconciliation logic
- All scoring, standings, bracket logic
- No database schema changes needed
- No new tables or migrations

## Summary
One targeted edit to the edge function (~15 lines) to write team names during sync. Then run a sync to pull fresh ESPN data.

