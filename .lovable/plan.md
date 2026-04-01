

## Fix Lockbox Score Persistence & Day Finalization

### Problem

Scores are **never written** to the `lockbox_scores` table. The leaderboard works in real-time via computed data from `lockbox_attempts` + `lockbox_locks`, but when the day ends:

- **History** shows "No scores recorded" for past days
- **Player stats** (lifetime totals, daily wins, top-3 finishes) are always empty/zero
- **Past days** are never marked as `complete`
- **Rankings** are never persisted

### Solution

Create a **score finalization edge function** (`finalize-lockbox-day`) that runs daily via cron and also add a **client-side fallback** that finalizes when users view stale days.

---

### Changes

#### 1. New Edge Function: `supabase/functions/finalize-lockbox-day/index.ts`
- Find yesterday's `lockbox_weeks` row (or any `active` day whose `ends_at` has passed)
- Query all locks + solved attempts for that day
- Compute each player's crack points, defense points, best-crack bonuses, and total
- Rank players by total points (with tiebreakers)
- Upsert rows into `lockbox_scores` with `user_id`, `week_id`, `crack_points`, `defense_points`, `total_points`, `rank`
- Update the `lockbox_weeks` row to `status = 'complete'`

#### 2. Database Migration
- Add an UPDATE policy on `lockbox_weeks` for service role (or use service role key in edge function — already bypasses RLS)
- No schema changes needed — existing tables support everything

#### 3. Schedule Cron Job
- Use `pg_cron` + `pg_net` to invoke `finalize-lockbox-day` daily at 00:05 UTC (5 minutes after day reset)

#### 4. Client-side Fallback: `src/hooks/useLockbox.ts`
- In `useComputedLeaderboard`: when `scores.data` is empty AND the day's `ends_at` has passed, call the finalization edge function once, then refetch scores
- This handles cases where the cron missed or the function failed

#### 5. Update `usePastDays` to Include Status
- Already fetches `status` — no change needed, but history will now show "COMPLETE" correctly since finalization sets the status

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/finalize-lockbox-day/index.ts` | New — computes & persists daily scores |
| `src/hooks/useLockbox.ts` | Add client-side finalization fallback in `useComputedLeaderboard` |
| Migration SQL | Cron job schedule for daily finalization |

### Technical Details

The finalization logic reuses the same scoring functions from `lockboxScoring.ts` but implemented server-side:
- Base 6 pts per crack + efficiency bonus (up to +4) + best-crack bonus (+2)
- Defense: 8 pts uncracked, or +3/+2/+1/+0 scaled by best crack attempts
- Rank by total points → locks cracked → avg attempts (tiebreaker)
- Uses service role key to bypass RLS for writes

