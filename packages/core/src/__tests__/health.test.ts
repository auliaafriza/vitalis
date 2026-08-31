import { describe, expect, it } from 'vitest';
import {
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
