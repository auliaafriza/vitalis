import type { DateKey } from './types';

/**
 * Timezone-correct day keys.
 *
 * The whole app hinges on one question: "which day does this belong to?"
 * Getting it wrong with `new Date().toISOString().slice(0, 10)` means a user
 * in Jakarta logging dinner at 20:00 sees it land on tomorrow. So every day
 * key is derived in the user's own timezone via Intl, never via UTC.
 */

const KEY_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function keyFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = KEY_FORMATTERS.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    KEY_FORMATTERS.set(timeZone, fmt);
  }
  return fmt;
}

/** Convert an instant to the YYYY-MM-DD it falls on in `timeZone`. */
export function toDateKey(instant: Date | string | number, timeZone: string): DateKey {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid date: ${String(instant)}`);
  }
  // en-CA already formats as YYYY-MM-DD.
  return keyFormatter(timeZone).format(date);
}

/** Today's day key in `timeZone`. */
export function todayKey(timeZone: string, now: Date = new Date()): DateKey {
  return toDateKey(now, timeZone);
}

/** Shift a day key by whole days. Pure string/UTC math — no timezone drift. */
export function addDays(key: DateKey, days: number): DateKey {
  const [y, m, d] = key.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined) {
    throw new RangeError(`Invalid date key: ${key}`);
  }
  const utc = Date.UTC(y, m - 1, d + days);
  return new Date(utc).toISOString().slice(0, 10);
}

/** Whole days between two keys (b - a). */
export function daysBetween(a: DateKey, b: DateKey): number {
  const toUtc = (key: DateKey): number => {
    const [y, m, d] = key.split('-').map(Number);
    if (y === undefined || m === undefined || d === undefined) {
      throw new RangeError(`Invalid date key: ${key}`);
    }
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** Inclusive list of day keys from `start` to `end`. */
export function dateRange(start: DateKey, end: DateKey): DateKey[] {
  const span = daysBetween(start, end);
  if (span < 0) return [];
  return Array.from({ length: span + 1 }, (_, i) => addDays(start, i));
}

/** The last `count` days ending at `end` (inclusive), oldest first. */
export function lastNDays(count: number, end: DateKey): DateKey[] {
  if (count <= 0) return [];
  return dateRange(addDays(end, -(count - 1)), end);
}

/** Minutes between two instants; tolerates a wake time past midnight. */
export function minutesBetween(from: string | Date, to: string | Date): number {
  const a = from instanceof Date ? from : new Date(from);
  const b = to instanceof Date ? to : new Date(to);
  return Math.round((b.getTime() - a.getTime()) / 60_000);
}

/** 487 -> "8j 7m" */
export function formatDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}j`;
  return `${h}j ${m}m`;
}

/**
 * How many days a month has, leap years included.
 *
 * Day 0 of the *next* month is the last day of this one — the standard trick,
 * and the reason this needs no leap-year rule of its own to get 2024, 2000
 * and 1900 right. `month1` is 1-based, like a person would write it.
 */
export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}
