

## NFL Pick'em — Comprehensive Test Plan

I'll test the new feature end-to-end across DB, edge functions, and UI. Read-only mode means I can inspect data and call edge functions, but any bugs found will be reported back for fixes in default mode.

### Test sequence

**1. Database integrity** (via `supabase--read_query`)
- Confirm all 8 `nfl_*` tables exist and are populated correctly
- Verify 32 teams seeded with ESPN `external_id` backfilled
- Check season row exists with sane defaults
- Verify `is_pick_unlocked`, `recompute_nfl_week_status` functions present
- Inspect RLS policies on picks/tiebreakers

**2. Edge functions** (via `supabase--curl_edge_functions` + logs)
- `sync-nfl-week`: call for 2025 season Week 1 — confirm games upserted, week row created, ESPN team mapping works
- Check `nfl_games` populated, `nfl_weeks.status` auto-derived by trigger
- `score-nfl-week`: call against a synced week — confirm idempotent, no errors when no finals yet
- Check function logs for any silent failures

**3. UI flow** (via browser tools)
- Navigate `/compete` → More tab → confirm NFL Pick'em card visible
- `/pickem` home: season header, CTA, standings snapshot render
- `/pickem/week/1`: game cards render, team logos load, tap-to-pick works, lock states correct, tiebreaker input visible
- `/pickem/standings`, `/pickem/history`, `/pickem/rules`: render without errors
- `/pickem/admin` (Alex K only): sync buttons work, "Import full season" present
- Mobile viewport (411×734): tap targets ≥44px, no overflow, safe-area respected
- Console clean of errors

**4. Lock enforcement**
- Verify `is_pick_unlocked` blocks picks on past kickoffs (RLS test via direct query)

**5. Realtime**
- Confirm subscriptions on `nfl_games` and standings tables fire (passive check via channel registration)

### Reporting

After the run I'll deliver: ✅ what works, ⚠️ what's flaky, ❌ what's broken — plus a prioritized fix list. If issues are found I'll stop and surface them before any code changes.

