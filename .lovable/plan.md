

## Switch Tournament to 2026 Season

The tournament is currently set to `season_year = 2025` (from our previous fix). Since it's now March 16, 2026, ESPN should have real 2026 bracket data available. We need to:

### Steps

1. **Update tournament record** back to 2026:
   ```sql
   UPDATE tournaments 
   SET season_year = 2026, external_season_id = '2026' 
   WHERE id = '00000000-0000-0000-0000-000000000001';
   ```

2. **Clear stale game-external mappings** so the reconciliation engine re-maps against 2026 ESPN data:
   ```sql
   DELETE FROM game_external_mappings 
   WHERE tournament_id = '00000000-0000-0000-0000-000000000001';
   ```

3. **Trigger a full sync** from Admin Tools to pull the real 2026 bracket data from ESPN — correct teams, seeds, regions, and First Four matchups.

No code changes needed — just two data updates and a sync trigger.

