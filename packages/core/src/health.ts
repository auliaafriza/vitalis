import { addDays, daysBetween, minutesBetween } from './date';
import type { DateKey, DaySummary, Targets } from './types';

/**
 * Health metrics that are not about food: body composition, sleep, streaks,
 * and the trend maths behind the charts.
 */

// --- Body composition -------------------------------------------------------

export function bmi(weightKg: number, heightCm: number): number {
  if (heightCm <= 0) throw new RangeError('height must be positive');
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export type BmiCategory =
  | 'underweight'
  | 'normal'
  | 'overweight'
  | 'obese_1'
  | 'obese_2';

/**
 * WHO Asia-Pacific BMI cut-offs, which are lower than the global ones and are
 * the correct reference for Indonesian users (WHO/IASO/IOTF, 2000).
 * Using the global thresholds here would tell a large share of the intended
 * users they are fine when clinically they are not.
 */
export function bmiCategory(value: number): BmiCategory {
  if (value < 18.5) return 'underweight';
  if (value < 23) return 'normal';
  if (value < 25) return 'overweight';
  if (value < 30) return 'obese_1';
  return 'obese_2';
}

// --- Sleep ------------------------------------------------------------------

/**
 * Duration of a night's sleep. Handles the ordinary case where bedtime is on
 * the previous calendar day.
 */
export function sleepDuration(bedtime: string | Date, wakeAt: string | Date): number {
  const minutes = minutesBetween(bedtime, wakeAt);
  if (minutes < 0) throw new RangeError('wake time must be after bedtime');
  return minutes;
}

/**
 * 0-100 score for a night's sleep.
 *
 * Under-sleeping scores proportionally. Over-sleeping is penalised too, but
 * more gently — an extra hour is a minor miss, not a failure. The 50x factor
 * is chosen so that sleeping twice the target reaches 0: a flatter curve left
 * a 24-hour "night" scoring 20, which is plainly wrong.
 */
export function sleepScore(durationMin: number, targetMin: number): number {
  if (targetMin <= 0) return 0;
  const ratio = durationMin / targetMin;
  const score = ratio <= 1 ? ratio * 100 : 100 - (ratio - 1) * 50;
  return Math.max(0, Math.min(100, Math.round(score)));
}

// --- Progress ---------------------------------------------------------------

/** Fraction of a target achieved, clamped to [0, 1] — for progress rings. */
export function progress(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(1, current / target));
}

/** Unclamped ratio, so the UI can show "118% of target" in red. */
export function progressRaw(current: number, target: number): number {
  if (target <= 0) return 0;
  return current / target;
}

export interface DayScoreBreakdown {
  nutrition: number;
  water: number;
  sleep: number;
  steps: number;
  total: number;
}

/**
 * A single 0-100 number for a day, so the calendar heatmap has something to
 * colour. Nutrition is scored on *closeness* to the calorie target rather
 * than on eating as much as possible — over-eating and under-eating are both
 * misses, which a naive progress bar would get backwards.
 */
export function dayScore(day: DaySummary, targets: Targets): DayScoreBreakdown {
  const closeness = (current: number, target: number): number => {
    if (target <= 0) return 0;
    const deviation = Math.abs(current - target) / target;
    return Math.max(0, Math.min(1, 1 - deviation));
  };

  const nutrition = day.kcal > 0 ? closeness(day.kcal, targets.kcal) : 0;
  const water = progress(day.waterMl, targets.waterMl);
  const sleep = day.sleepMin === null ? 0 : sleepScore(day.sleepMin, targets.sleepMin) / 100;
  const steps = progress(day.steps ?? 0, targets.steps);

  const weights = { nutrition: 0.4, water: 0.2, sleep: 0.25, steps: 0.15 };
  const total =
    nutrition * weights.nutrition +
    water * weights.water +
    sleep * weights.sleep +
    steps * weights.steps;

  return {
    nutrition: Math.round(nutrition * 100),
    water: Math.round(water * 100),
    sleep: Math.round(sleep * 100),
    steps: Math.round(steps * 100),
    total: Math.round(total * 100),
  };
}

// --- Streaks ----------------------------------------------------------------

/**
 * Consecutive-day streak ending today (or yesterday — a streak is not broken
 * until today is over, otherwise every user sees "0" every morning, which is
 * demoralising and wrong).
 */
export function currentStreak(activeDays: Iterable<DateKey>, today: DateKey): number {
  const days = new Set(activeDays);
  if (days.size === 0) return 0;

  let cursor = days.has(today) ? today : addDays(today, -1);
  if (!days.has(cursor)) return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Longest run of consecutive days in the set — the "personal best" stat. */
export function longestStreak(activeDays: Iterable<DateKey>): number {
  const sorted = [...new Set(activeDays)].sort();
  let best = 0;
  let run = 0;
  let previous: DateKey | null = null;

  for (const day of sorted) {
    run = previous !== null && daysBetween(previous, day) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

// --- Trends -----------------------------------------------------------------

/**
 * Centred moving average, keeping the series the same length.
 * Daily weight is dominated by water and gut contents; the 7-day average is
 * the only line worth showing a user who is trying not to panic.
 */
export function movingAverage(
  values: readonly (number | null)[],
  window: number,
): (number | null)[] {
  if (window < 1) throw new RangeError('window must be >= 1');
  const half = Math.floor(window / 2);

  return values.map((_, i) => {
    const slice: number[] = [];
    for (let j = i - half; j <= i + half; j += 1) {
      const v = values[j];
      if (j >= 0 && j < values.length && v !== null && v !== undefined) slice.push(v);
    }
    if (slice.length === 0) return null;
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    return Math.round(mean * 100) / 100;
  });
}

export interface Trend {
  /** Change per day, in the unit of the input series. */
  slopePerDay: number;
  /** Change per week — the number actually worth showing. */
  slopePerWeek: number;
  direction: 'up' | 'down' | 'flat';
  /** Number of points the fit is based on. */
  sampleSize: number;
}

/**
 * Ordinary least-squares fit over a sparse series, using each point's real
 * day offset so gaps do not distort the slope.
 */
export function linearTrend(
  points: readonly { day: DateKey; value: number }[],
): Trend | null {
  if (points.length < 2) return null;

  const sorted = [...points].sort((a, b) => a.day.localeCompare(b.day));
  const origin = sorted[0]!.day;
  const xs = sorted.map((p) => daysBetween(origin, p.day));
  const ys = sorted.map((p) => p.value);

  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i]! - meanX;
    numerator += dx * (ys[i]! - meanY);
    denominator += dx * dx;
  }

  if (denominator === 0) return null;

  const slopePerDay = numerator / denominator;
  const slopePerWeek = slopePerDay * 7;
  const direction =
    Math.abs(slopePerWeek) < 0.05 ? 'flat' : slopePerWeek > 0 ? 'up' : 'down';

  return {
    slopePerDay: Math.round(slopePerDay * 1000) / 1000,
    slopePerWeek: Math.round(slopePerWeek * 100) / 100,
    direction,
    sampleSize: n,
  };
}

/**
 * Fill gaps in a summary series so charts have one point per day.
 * Missing days become nulls rather than zeros: a day with no data is not a
 * day with no sleep, and drawing it as zero is a lie.
 */
export function fillDays(
  summaries: readonly DaySummary[],
  days: readonly DateKey[],
): DaySummary[] {
  const byDay = new Map(summaries.map((s) => [s.loggedOn, s]));
  return days.map(
    (day) =>
      byDay.get(day) ?? {
        loggedOn: day,
        kcal: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        fiberG: 0,
        waterMl: 0,
        sleepMin: null,
        steps: null,
        moodAvg: null,
        weightKg: null,
      },
  );
}

// --- Pedometer ---------------------------------------------------------------

/**
 * Today's total step count, given a baseline and what this session has counted.
 *
 * The two platforms hand back very different things, and the difference is why
 * the Android build showed no steps at all:
 *
 *   - iOS can answer "how many steps since midnight?" directly
 *     (`getStepCountAsync`), so the baseline is that answer.
 *   - Android cannot. `getStepCountAsync` throws NotSupportedException there —
 *     it is an iOS-only API — and its hardware sensor (TYPE_STEP_COUNTER)
 *     only reports a running total since the device booted. Expo turns that
 *     into "steps since you subscribed", which is zero every time the app
 *     opens. So on Android the baseline has to be whatever was already saved
 *     for today, and this session's count is added on top.
 *
 * The critical property is that `sessionSteps` is *cumulative since the
 * subscription started*, not a per-event delta. The old code added each event
 * to a running total, which meant a walk reporting 1, 2, 3 steps was recorded
 * as 1 + 3 + 6 = 10. Taking the latest value instead of summing is the whole
 * fix.
 *
 * The baseline is captured once and then held, so repeated syncs during a
 * session never count the same steps twice.
 */
export function totalStepsToday(baseline: number, sessionSteps: number): number {
  const safeBaseline = Number.isFinite(baseline) && baseline > 0 ? baseline : 0;
  const safeSession = Number.isFinite(sessionSteps) && sessionSteps > 0 ? sessionSteps : 0;
  return Math.round(safeBaseline + safeSession);
}

export interface StepSyncState {
  /** The value most recently written to the database. */
  lastValue: number;
  /** When that write happened, as an epoch millisecond timestamp. */
  lastAt: number;
}

/**
 * Should this step count be written to the database right now?
 *
 * The sensor fires several times a second while someone walks, and each write
 * is a network round trip, so writes are rate-limited. Two rules beyond the
 * obvious "has it changed":
 *
 *   - `force` bypasses the interval. It is what a screen calls when it is
 *     going away — leaving the app, or the day rolling over. Without it the
 *     last stretch of a walk is silently dropped, which is precisely the
 *     "steps do not sync" symptom: the throttle discarded updates instead of
 *     deferring them, so whatever happened in the final minute never landed.
 *   - A count that has gone *down* is not written. That happens when the
 *     phone reboots and the hardware counter resets; overwriting a real total
 *     with a smaller one would lose the day's progress.
 */
export function shouldSyncSteps(
  steps: number,
  state: StepSyncState,
  now: number,
  { minIntervalMs = 60_000, force = false }: { minIntervalMs?: number; force?: boolean } = {},
): boolean {
  if (!Number.isFinite(steps) || steps <= 0) return false;
  if (steps <= state.lastValue) return false;
  if (force) return true;
  // Nothing written yet this session: the first real count goes straight out.
  // Stated as its own rule rather than left to `now - 0 >= interval`, which
  // only happens to be true because the epoch is decades ago.
  if (state.lastAt === 0) return true;
  return now - state.lastAt >= minIntervalMs;
}

// --- Chart scales ------------------------------------------------------------

export interface AxisBounds {
  min: number;
  max: number;
  /** Values to draw a gridline and a label at, low to high. */
  ticks: number[];
}

/**
 * A y-axis that reads as deliberate rather than as whatever the data happened
 * to be.
 *
 * Two rules do the work. Ticks land on round numbers — 1, 2, 2.5 or 5 times a
 * power of ten — because "78,4 / 79,7 / 81,0" is a scale nobody can hold in
 * their head, while "78 / 80 / 82" is read at a glance. And the range is
 * padded slightly so the highest point is not welded to the top edge.
 *
 * `includeZero` is the honesty switch, and it matters more than it looks:
 *
 *   - Bars MUST start at zero. A bar's length is its value, so a truncated
 *     baseline makes 2100 kcal look like twice 1900.
 *   - Lines must NOT be forced to zero. Bodyweight lives between 78 and 81;
 *     stretching that axis down to 0 flattens a real month of progress into a
 *     horizontal line, which is the opposite of what someone tracking weight
 *     needs to see.
 */
export function niceAxisBounds(
  values: readonly number[],
  { includeZero = false, targetTicks = 4 }: { includeZero?: boolean; targetTicks?: number } = {},
): AxisBounds {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return { min: 0, max: 1, ticks: [0, 1] };

  let low = Math.min(...finite);
  let high = Math.max(...finite);
  if (includeZero) low = Math.min(0, low);

  // A perfectly flat series has no range to divide by; give it one.
  if (high === low) {
    const pad = Math.abs(high) > 0 ? Math.abs(high) * 0.05 : 1;
    high += pad;
    low = includeZero ? Math.min(0, low) : low - pad;
  }

  const step = niceStep((high - low) / targetTicks);
  const min = includeZero ? 0 : Math.floor(low / step) * step;
  const max = Math.ceil(high / step) * step;

  const ticks: number[] = [];
  // Rounded each time: repeated addition of 2.5 drifts into 7.500000000000001,
  // which then prints as a nonsense axis label.
  for (let t = min; t <= max + step / 2; t += step) {
    ticks.push(Math.round(t * 1000) / 1000);
  }

  return { min, max, ticks };
}

/** The nearest 1/2/2.5/5 x 10^n at or above `rough`. */
function niceStep(rough: number): number {
  if (!Number.isFinite(rough) || rough <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;
  const nice = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10;
  return nice * magnitude;
}

export interface DayBucket<T> {
  /** First day in the bucket — what the x-axis is labelled with. */
  from: DateKey;
  /** Last day in the bucket. Equal to `from` when nothing was grouped. */
  to: DateKey;
  /** Mean of the non-null values, or null when the whole bucket is empty. */
  value: number | null;
  /** How many days in the bucket actually had a value. */
  samples: number;
  /** Whatever the caller wants to carry through. */
  items: readonly T[];
}

/**
 * Group a daily series into at most `maxBuckets` columns.
 *
 * A year of data is 365 bars. On a phone that is under a pixel each — not a
 * chart, a texture. Averaging consecutive days into weeks keeps the shape of
 * the year while leaving marks wide enough to see and to tap.
 *
 * Empty days average as absent rather than as zero, so a week with one
 * missing day is not dragged down by it; a bucket with no data at all stays
 * null, and the chart can draw a gap instead of inventing a floor.
 */
export function bucketDays<T extends { day: DateKey; value: number | null }>(
  points: readonly T[],
  maxBuckets: number,
): DayBucket<T>[] {
  if (maxBuckets < 1) throw new RangeError('maxBuckets must be >= 1');
  if (points.length === 0) return [];

  const size = Math.ceil(points.length / maxBuckets);
  const buckets: DayBucket<T>[] = [];

  for (let i = 0; i < points.length; i += size) {
    const slice = points.slice(i, i + size);
    const present = slice.filter((p) => p.value !== null).map((p) => p.value as number);
    buckets.push({
      from: slice[0]!.day,
      to: slice[slice.length - 1]!.day,
      value:
        present.length === 0
          ? null
          : Math.round((present.reduce((a, b) => a + b, 0) / present.length) * 100) / 100,
      samples: present.length,
      items: slice,
    });
  }

  return buckets;
}
