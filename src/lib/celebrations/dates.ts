// Birthdays & Milestones — Date math helpers
//
// Pure functions used by the celebrations hooks, widget, and page. No
// DB access. All callers should pass timezone-naive Y/M/D — we deal in
// the local calendar.
//
// Leap-day policy: Feb 29 birthdays fall back to Feb 28 in non-leap
// years (most common convention, matches calendar apps). The opposite
// fallback (Mar 1) would be ambiguous on calendar grids.

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Days in a month, accounting for leap years. */
export function daysInMonth(year: number, month1Based: number): number {
  return new Date(year, month1Based, 0).getDate();
}

/**
 * Compute the next occurrence of a recurring (month, day) anchor.
 * - "from" defaults to today (local).
 * - Returns a Date set to the next on-or-after match.
 * - Feb 29 maps to Feb 28 in non-leap years.
 */
export function nextOccurrenceOf(
  month: number,
  day: number,
  from: Date = new Date(),
): Date {
  const todayY = from.getFullYear();
  const todayM = from.getMonth() + 1;
  const todayD = from.getDate();

  // Try this calendar year first, then next year.
  for (const year of [todayY, todayY + 1]) {
    let m = month;
    let d = day;
    // Leap-day fallback in non-leap years.
    if (m === 2 && d === 29 && !isLeapYear(year)) d = 28;
    // Same-year, on or after today.
    if (year > todayY || m > todayM || (m === todayM && d >= todayD)) {
      return new Date(year, m - 1, d);
    }
  }
  // Fallback (shouldn't reach) — same-day next year.
  return new Date(todayY + 1, month - 1, day);
}

/**
 * Days until a specific date from "from" (default today). Both dates are
 * normalized to midnight local so the count is calendar-day exact.
 */
export function daysUntil(target: Date, from: Date = new Date()): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/** True if (month, day) is "today" in the caller's local calendar. */
export function isTodayMD(month: number, day: number, now: Date = new Date()): boolean {
  // Leap-day handling: a Feb 29 birthday is "today" on Feb 28 in non-leap years.
  if (month === 2 && day === 29 && !isLeapYear(now.getFullYear())) {
    return now.getMonth() === 1 && now.getDate() === 28;
  }
  return now.getMonth() + 1 === month && now.getDate() === day;
}

/** True if a fixed date (one-time milestone) falls on today. */
export function isTodayDate(d: Date | string, now: Date = new Date()): boolean {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return (
    dt.getFullYear() === now.getFullYear() &&
    dt.getMonth() === now.getMonth() &&
    dt.getDate() === now.getDate()
  );
}

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** "May 11" — used everywhere we show a recurring birthday/anniversary. */
export function formatMonthDay(month: number, day: number): string {
  if (month < 1 || month > 12) return '';
  return `${MONTHS_SHORT[month - 1]} ${day}`;
}

/** "May 11, 2025" — used for one-time milestone dates with year. */
export function formatFullDate(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return `${MONTHS_SHORT[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
}

/** "Today" / "Tomorrow" / "In 5 days" / "May 11" — used by Upcoming lists. */
export function formatRelativeUpcoming(target: Date, now: Date = new Date()): string {
  const d = daysUntil(target, now);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d > 0 && d <= 7) return `In ${d} days`;
  return formatMonthDay(target.getMonth() + 1, target.getDate());
}

/**
 * Best-effort age calculation. Returns null if year is missing or the
 * member doesn't want age shown — callers should also consult the
 * `show_age` flag, this is a safety net.
 */
export function computeAge(
  birthYear: number | null | undefined,
  birthMonth: number,
  birthDay: number,
  now: Date = new Date(),
): number | null {
  if (!birthYear) return null;
  let age = now.getFullYear() - birthYear;
  const beforeBirthday =
    now.getMonth() + 1 < birthMonth ||
    (now.getMonth() + 1 === birthMonth && now.getDate() < birthDay);
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}
