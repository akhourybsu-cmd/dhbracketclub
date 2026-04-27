// Daily Challenge logic — endless survival mode.
//
// HISTORICAL NOTE: This module previously rolled per-day modifiers and a
// seeded campaign level. Daily is now a 2-minute timed survival arena
// (see endlessMode.ts), so this file is reduced to date helpers and a
// thin re-export of reward/star utilities.

export { ENDLESS_TIME_LIMIT_SEC, endlessRewardFor, endlessStarsFor } from './endlessMode';

/** Today's UTC date in YYYY-MM-DD form (matches the DB `daily_date` column). */
export function todayUtcDateString(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
