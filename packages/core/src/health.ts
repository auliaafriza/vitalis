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
