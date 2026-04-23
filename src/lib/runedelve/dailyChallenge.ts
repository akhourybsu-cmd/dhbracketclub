// Daily Challenge logic — date-seeded modifier roll, scoring helpers, and
// reward calculations. Single source of truth for what "today's daily" looks
// like across the codex, the daily page, and the (future) play integration.

import { mulberry32, rngInt } from './prng';
import { DAILY_MODIFIER_LIST, type DailyModifierId } from './dailyModifiers';

/** Today's UTC date in YYYY-MM-DD form (matches the DB `daily_date` column). */
export function todayUtcDateString(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Day-of-week in UTC (0 = Sunday … 6 = Saturday). */
export function utcDayOfWeek(d: Date = new Date()): number {
  return d.getUTCDay();
}

/** Hash a YYYY-MM-DD string into a stable 32-bit integer seed. */
export function dailySeedFor(dateStr: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < dateStr.length; i += 1) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h || 1;
}

/**
 * Roll today's modifiers. Returns 2 ids on most days, 3 on Sundays
 * ("Weekend Gauntlet"). Always deterministic per date.
 */
export function rollDailyModifiers(dateStr: string): DailyModifierId[] {
  const seed = dailySeedFor(dateStr);
  const rng = mulberry32(seed);
  const utcDate = new Date(dateStr + 'T00:00:00Z');
  const isSunday = utcDate.getUTCDay() === 0;
  const count = isSunday ? 3 : 2;
  const pool = [...DAILY_MODIFIER_LIST];
  const picked: DailyModifierId[] = [];
  while (picked.length < count && pool.length > 0) {
    const idx = rngInt(rng, pool.length);
    const [chosen] = pool.splice(idx, 1);
    picked.push(chosen.id);
  }
  return picked;
}

/** What level number does today's daily run? Cycles through L20-L60 by date. */
export function dailyLevelFor(dateStr: string): number {
  const seed = dailySeedFor(dateStr);
  const rng = mulberry32(seed + 333);
  return 20 + rngInt(rng, 41); // 20..60
}

/**
 * Star rating for a daily run. 3★ on cleared + score ≥ target × 1.5,
 * 2★ on cleared + score ≥ target, 1★ on any clear, 0★ on loss.
 * Targets are slightly stiffer than the campaign equivalent.
 */
export function dailyStarsFor(score: number, level: number, cleared: boolean): 0 | 1 | 2 | 3 {
  if (!cleared) return 0;
  const baseTarget = 700 + level * 35; // ~17% stiffer than campaign starsFor
  if (score >= baseTarget * 1.5) return 3;
  if (score >= baseTarget) return 2;
  return 1;
}

export interface DailyReward {
  shards: number;
  xp: number;
  /** Cosmetic title unlocked by this clear, if any. */
  title?: string;
}

/** Compute base + bonus rewards for completing the daily at a given star count. */
export function computeDailyReward(stars: 0 | 1 | 2 | 3, currentStreakAfter: number): DailyReward {
  if (stars === 0) return { shards: 0, xp: 0 };
  let shards = 50;
  const xp = 100;
  if (stars >= 2) shards += 25;
  if (stars >= 3) shards += 50;
  let title: string | undefined;
  if (currentStreakAfter === 7) { shards += 200; title = 'Daily Devotee'; }
  if (currentStreakAfter === 30) { shards += 1000; title = 'Eternal Pilgrim'; }
  return { shards, xp, title };
}
