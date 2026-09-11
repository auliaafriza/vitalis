import { describe, expect, it } from 'vitest';
import {
  bucketDays,
  niceAxisBounds,
  shouldSyncSteps,
  totalStepsToday,
  bmi,
  bmiCategory,
  currentStreak,
  dayScore,
  fillDays,
  linearTrend,
  longestStreak,
  movingAverage,
  progress,
  sleepDuration,
  sleepScore,
} from '../health';
import type { DaySummary, Targets } from '../types';

describe('bmi', () => {
  it('computes to one decimal', () => {
    expect(bmi(70, 175)).toBe(22.9);
  });

  it('rejects a non-positive height', () => {
    expect(() => bmi(70, 0)).toThrow(RangeError);
  });

  it('uses WHO Asia-Pacific cut-offs, not the global ones', () => {
    // 24.0 is "normal" globally but "overweight" in the Asia-Pacific bands.
    expect(bmiCategory(24)).toBe('overweight');
    expect(bmiCategory(22.9)).toBe('normal');
    expect(bmiCategory(18.4)).toBe('underweight');
    expect(bmiCategory(27)).toBe('obese_1');
    expect(bmiCategory(31)).toBe('obese_2');
  });
});

describe('sleep', () => {
  it('measures a night that crosses midnight', () => {
    expect(
      sleepDuration('2026-08-31T22:30:00Z', '2026-09-01T06:00:00Z'),
    ).toBe(450);
  });

  it('rejects a wake time before bedtime', () => {
    expect(() =>
      sleepDuration('2026-09-01T06:00:00Z', '2026-08-31T22:30:00Z'),
    ).toThrow(RangeError);
  });

  it('scores a full night at 100', () => {
    expect(sleepScore(480, 480)).toBe(100);
  });

  it('scores short sleep proportionally', () => {
    expect(sleepScore(360, 480)).toBe(75);
  });

  it('penalises oversleep, but gently', () => {
    const over = sleepScore(600, 480); // 25% over target
    expect(over).toBeLessThan(100);
    expect(over).toBeGreaterThan(85);
  });

  it('never goes negative', () => {
    expect(sleepScore(0, 480)).toBe(0);
    expect(sleepScore(1440, 480)).toBe(0);
  });
});

describe('progress', () => {
  it('clamps to 0..1', () => {
    expect(progress(500, 2000)).toBe(0.25);
    expect(progress(3000, 2000)).toBe(1);
    expect(progress(-10, 2000)).toBe(0);
  });

  it('does not divide by zero', () => {
    expect(progress(100, 0)).toBe(0);
  });
});

describe('dayScore', () => {
  const targets: Targets = {
    kcal: 2000,
    proteinG: 120,
    carbsG: 220,
    fatG: 60,
    fiberG: 28,
    waterMl: 2500,
    sleepMin: 480,
    steps: 8000,
  };

  const day = (over: Partial<DaySummary>): DaySummary => ({
    loggedOn: '2026-08-31',
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
    ...over,
  });

  it('scores a perfect day near 100', () => {
    const score = dayScore(
      day({ kcal: 2000, waterMl: 2500, sleepMin: 480, steps: 8000 }),
      targets,
    );
    expect(score.total).toBeGreaterThanOrEqual(99);
  });

  it('treats over-eating as a miss, not as extra credit', () => {
    const onTarget = dayScore(day({ kcal: 2000 }), targets).nutrition;
    const wayOver = dayScore(day({ kcal: 3500 }), targets).nutrition;
    expect(wayOver).toBeLessThan(onTarget);
  });

  it('scores an empty day at zero', () => {
    expect(dayScore(day({}), targets).total).toBe(0);
  });
});

describe('streaks', () => {
  const days = ['2026-08-28', '2026-08-29', '2026-08-30', '2026-08-31'];

  it('counts a run ending today', () => {
    expect(currentStreak(days, '2026-08-31')).toBe(4);
  });

  it('does not break the streak just because today has no entry yet', () => {
    expect(currentStreak(days, '2026-09-01')).toBe(4);
  });

  it('breaks after a full missed day', () => {
    expect(currentStreak(days, '2026-09-02')).toBe(0);
  });

  it('returns 0 for no history', () => {
    expect(currentStreak([], '2026-08-31')).toBe(0);
  });

  it('finds the longest historical run', () => {
    expect(
      longestStreak([
        '2026-08-01', '2026-08-02', '2026-08-03',
        '2026-08-10',
        '2026-08-20', '2026-08-21',
      ]),
    ).toBe(3);
  });

  it('ignores duplicate days', () => {
    expect(longestStreak(['2026-08-01', '2026-08-01', '2026-08-02'])).toBe(2);
  });
});

describe('movingAverage', () => {
  it('smooths a series and keeps its length', () => {
    const result = movingAverage([1, 2, 3, 4, 5], 3);
    expect(result).toHaveLength(5);
    expect(result[2]).toBe(3);
  });

  it('skips nulls rather than treating them as zero', () => {
    const result = movingAverage([10, null, 12], 3);
    expect(result[1]).toBe(11);
  });

  it('returns null where a window has no data at all', () => {
    expect(movingAverage([null, null], 1)).toEqual([null, null]);
  });
});

describe('linearTrend', () => {
  it('detects a downward weight trend', () => {
    const trend = linearTrend([
      { day: '2026-08-01', value: 80.0 },
      { day: '2026-08-08', value: 79.4 },
      { day: '2026-08-15', value: 78.9 },
      { day: '2026-08-22', value: 78.3 },
    ]);
    expect(trend).not.toBeNull();
    expect(trend!.direction).toBe('down');
    expect(trend!.slopePerWeek).toBeCloseTo(-0.56, 1);
    expect(trend!.sampleSize).toBe(4);
  });

  it('calls a flat series flat', () => {
    const trend = linearTrend([
      { day: '2026-08-01', value: 70 },
      { day: '2026-08-08', value: 70 },
    ]);
    expect(trend!.direction).toBe('flat');
  });

  it('needs at least two points', () => {
    expect(linearTrend([{ day: '2026-08-01', value: 70 }])).toBeNull();
    expect(linearTrend([])).toBeNull();
  });

  it('is not distorted by unevenly spaced entries', () => {
    const trend = linearTrend([
      { day: '2026-08-01', value: 80 },
      { day: '2026-08-02', value: 79.9 },
      { day: '2026-08-29', value: 77.2 },
    ]);
    expect(trend!.direction).toBe('down');
  });
});

describe('fillDays', () => {
  it('inserts placeholder days without inventing zeros for sleep', () => {
    const filled = fillDays(
      [
        {
          loggedOn: '2026-08-30',
          kcal: 1900, proteinG: 120, carbsG: 200, fatG: 60, fiberG: 25,
          waterMl: 2000, sleepMin: 450, steps: 9000, moodAvg: 4, weightKg: 70,
        },
      ],
      ['2026-08-30', '2026-08-31'],
    );

    expect(filled).toHaveLength(2);
    expect(filled[1]!.kcal).toBe(0);
    expect(filled[1]!.sleepMin).toBeNull();
    expect(filled[1]!.steps).toBeNull();
  });
});

describe('totalStepsToday', () => {
  it('adds the session count to the baseline', () => {
    expect(totalStepsToday(3200, 480)).toBe(3680);
  });

  it('takes the session value as-is, never as a running sum', () => {
    // The Android bug: watchStepCount reports 1, then 2, then 3 — each one the
    // cumulative total since subscribing. Adding them gave 1 + 3 + 6 = 10.
    const events = [1, 2, 3];
    const totals = events.map((s) => totalStepsToday(0, s));
    expect(totals).toEqual([1, 2, 3]);
  });

  it('starts from zero when nothing was saved today', () => {
    expect(totalStepsToday(0, 250)).toBe(250);
  });

  it('shrugs off nonsense from the sensor', () => {
    expect(totalStepsToday(Number.NaN, 100)).toBe(100);
    expect(totalStepsToday(500, Number.NaN)).toBe(500);
    expect(totalStepsToday(-5, -5)).toBe(0);
  });
});

describe('shouldSyncSteps', () => {
  const fresh = { lastValue: 0, lastAt: 0 };

  it('writes the first real count immediately', () => {
    expect(shouldSyncSteps(120, fresh, 1_000)).toBe(true);
  });

  it('holds back a second write inside the interval', () => {
    const state = { lastValue: 120, lastAt: 1_000 };
    expect(shouldSyncSteps(140, state, 30_000)).toBe(false);
  });

  it('allows it once the interval has passed', () => {
    const state = { lastValue: 120, lastAt: 1_000 };
    expect(shouldSyncSteps(140, state, 61_001)).toBe(true);
  });

  it('forces a write when the app is going away', () => {
    // The "steps do not sync" bug: the throttle dropped the last minute of a
    // walk instead of deferring it, so closing the app lost it.
    const state = { lastValue: 120, lastAt: 1_000 };
    expect(shouldSyncSteps(140, state, 30_000, { force: true })).toBe(true);
  });

  it('never writes a count that has not moved', () => {
    const state = { lastValue: 140, lastAt: 1_000 };
    expect(shouldSyncSteps(140, state, 999_999, { force: true })).toBe(false);
  });

  it('refuses to overwrite a real total with a smaller one', () => {
    // A phone reboot resets the hardware counter; the day's progress must not
    // be reset with it.
    const state = { lastValue: 8_000, lastAt: 1_000 };
    expect(shouldSyncSteps(12, state, 999_999, { force: true })).toBe(false);
  });

  it('ignores zero and nonsense', () => {
    expect(shouldSyncSteps(0, fresh, 1_000, { force: true })).toBe(false);
    expect(shouldSyncSteps(Number.NaN, fresh, 1_000, { force: true })).toBe(false);
  });
});

describe('niceAxisBounds', () => {
  it('lands ticks on round numbers', () => {
    const axis = niceAxisBounds([78.4, 79.7, 81.0]);
    // Not 78.4 / 79.7 / 81.0 — a scale nobody can hold in their head.
    expect(axis.ticks.every((t) => Number.isInteger(t * 2))).toBe(true);
    expect(axis.min).toBeLessThanOrEqual(78.4);
    expect(axis.max).toBeGreaterThanOrEqual(81);
  });

  it('starts bars at zero, because a bar length IS its value', () => {
    const axis = niceAxisBounds([1900, 2100, 2050], { includeZero: true });
    expect(axis.min).toBe(0);
    expect(axis.max).toBeGreaterThanOrEqual(2100);
  });

  it('does NOT drag a weight axis down to zero', () => {
    // The whole month of progress lives between 78 and 81; an axis from 0
    // would flatten it into a horizontal line.
    const axis = niceAxisBounds([78.2, 80.9]);
    expect(axis.min).toBeGreaterThan(70);
  });

  it('gives a flat series a range instead of dividing by zero', () => {
    const axis = niceAxisBounds([70, 70, 70]);
    expect(axis.max).toBeGreaterThan(axis.min);
    expect(Number.isFinite(axis.min)).toBe(true);
  });

  it('never prints a floating-point artefact as an axis label', () => {
    // Repeated addition of 2.5 drifts to 7.500000000000001 without rounding.
    const axis = niceAxisBounds([0, 10], { includeZero: true });
    for (const tick of axis.ticks) {
      expect(String(tick).length).toBeLessThan(8);
    }
  });

  it('survives an empty series', () => {
    const axis = niceAxisBounds([]);
    expect(axis.ticks.length).toBeGreaterThan(0);
    expect(axis.max).toBeGreaterThan(axis.min);
  });

  it('covers every value it was given', () => {
    const values = [3, 17, 42, 8];
    const axis = niceAxisBounds(values, { includeZero: true });
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(axis.min);
      expect(v).toBeLessThanOrEqual(axis.max);
    }
  });
});

describe('bucketDays', () => {
  const day = (n: number) => `2026-03-${String(n).padStart(2, '0')}`;
  const series = (n: number, value: (i: number) => number | null) =>
    Array.from({ length: n }, (_, i) => ({ day: day(i + 1), value: value(i) }));

  it('leaves a short series alone', () => {
    const buckets = bucketDays(series(7, () => 2000), 14);
    expect(buckets).toHaveLength(7);
    expect(buckets[0]!.from).toBe(buckets[0]!.to);
  });

  it('groups a long series down to the cap', () => {
    // A year on a phone is 365 bars — under a pixel each. Not a chart.
    const buckets = bucketDays(series(28, () => 2000), 14);
    expect(buckets.length).toBeLessThanOrEqual(14);
    expect(buckets[0]!.from).not.toBe(buckets[0]!.to);
  });

  it('averages over the days that have data, not over the calendar', () => {
    // One logged day of 2100 in a week is a 2100 average, not 300.
    const buckets = bucketDays(
      series(7, (i) => (i === 0 ? 2100 : null)),
      1,
    );
    expect(buckets[0]!.value).toBe(2100);
    expect(buckets[0]!.samples).toBe(1);
  });

  it('keeps an empty bucket null rather than inventing a zero', () => {
    const buckets = bucketDays(series(7, () => null), 1);
    expect(buckets[0]!.value).toBeNull();
    expect(buckets[0]!.samples).toBe(0);
  });

  it('spans the whole range without dropping or duplicating a day', () => {
    const input = series(30, (i) => i);
    const buckets = bucketDays(input, 7);
    const covered = buckets.flatMap((b) => b.items);
    expect(covered).toHaveLength(30);
    expect(buckets[0]!.from).toBe(day(1));
    expect(buckets[buckets.length - 1]!.to).toBe(day(30));
  });

  it('handles an empty series and rejects a nonsense cap', () => {
    expect(bucketDays([], 10)).toEqual([]);
    expect(() => bucketDays(series(3, () => 1), 0)).toThrow(RangeError);
  });
});
