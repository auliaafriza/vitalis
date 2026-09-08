import { describe, expect, it } from 'vitest';
import {
  allowedRanges,
  clampRange,
  isPremium,
  isRangeAllowed,
  limitsFor,
  lockedRanges,
  LIMITS,
  TREND_RANGES,
  widestAllowedRange,
} from '../entitlements';

describe('isRangeAllowed', () => {
  it('gives free exactly one week', () => {
    expect(isRangeAllowed('free', 7)).toBe(true);
    expect(isRangeAllowed('free', 30)).toBe(false);
    expect(isRangeAllowed('free', 90)).toBe(false);
    expect(isRangeAllowed('free', 365)).toBe(false);
  });

  it('never lets free ask for everything', () => {
    // `null` means all history — the one value a naive `days <= max` check
    // would let through, since null coerces to 0.
    expect(isRangeAllowed('free', null)).toBe(false);
  });

  it('lets premium ask for anything, including all history', () => {
    for (const range of TREND_RANGES) {
      expect(isRangeAllowed('premium', range.days)).toBe(true);
    }
  });

  it('allows a shorter window than the cap', () => {
    expect(isRangeAllowed('free', 1)).toBe(true);
  });
});

describe('allowedRanges / lockedRanges', () => {
  it('splits the range list without losing or duplicating any', () => {
    for (const tier of ['free', 'premium'] as const) {
      const allowed = allowedRanges(tier);
      const locked = lockedRanges(tier);
      expect(allowed.length + locked.length).toBe(TREND_RANGES.length);
      expect(allowed.some((r) => locked.includes(r))).toBe(false);
    }
  });

  it('offers free only the 7-day range', () => {
    expect(allowedRanges('free').map((r) => r.days)).toEqual([7]);
    expect(lockedRanges('free').map((r) => r.days)).toEqual([30, 90, 365, null]);
  });

  it('locks nothing for premium', () => {
    expect(lockedRanges('premium')).toEqual([]);
  });
});

describe('clampRange', () => {
  it('leaves an allowed range alone', () => {
    expect(clampRange('free', 7)).toBe(7);
    expect(clampRange('premium', 365)).toBe(365);
    expect(clampRange('premium', null)).toBeNull();
  });

  it('degrades a stale premium selection when the plan lapses', () => {
    // The exact case that matters: the user was looking at a year of data when
    // their subscription expired. They should see 7 days, not an empty chart.
    expect(clampRange('free', 365)).toBe(7);
    expect(clampRange('free', null)).toBe(7);
  });
});

describe('widestAllowedRange', () => {
  it('is 7 days for free and all-history for premium', () => {
    expect(widestAllowedRange('free').days).toBe(7);
    expect(widestAllowedRange('premium').days).toBeNull();
  });
});

describe('limits', () => {
  it('matches the window the RLS policy enforces', () => {
    // If this number changes, supabase/migrations/…_entitlements.sql must
    // change with it — this assertion is the reminder.
    expect(LIMITS.free.historyDays).toBe(7);
    expect(LIMITS.premium.historyDays).toBeNull();
  });

  it('keeps export and body tracking behind premium', () => {
    expect(limitsFor('free').canExport).toBe(false);
    expect(limitsFor('free').canTrackBody).toBe(false);
    expect(limitsFor('premium').canExport).toBe(true);
    expect(limitsFor('premium').canTrackBody).toBe(true);
  });

  it('never caps the daily logging loop', () => {
    // Limiting entries per day would break the habit that makes premium worth
    // buying, so there is deliberately no such limit to assert against.
    expect(Object.keys(LIMITS.free)).not.toContain('entriesPerDay');
  });

  it('identifies the tier', () => {
    expect(isPremium('premium')).toBe(true);
    expect(isPremium('free')).toBe(false);
  });
});
