import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysInMonth,
  dateRange,
  daysBetween,
  formatDuration,
  lastNDays,
  minutesBetween,
  toDateKey,
} from '../date';

describe('toDateKey', () => {
  it('resolves the day in the user timezone, not UTC', () => {
    // 20:00 in Jakarta on 31 Aug is already 1 Sep in UTC+0? No — it is 13:00 UTC.
    expect(toDateKey('2026-08-31T13:00:00Z', 'Asia/Jakarta')).toBe('2026-08-31');
  });

  it('rolls over correctly for late-evening logging', () => {
    // 21:00 UTC on 31 Aug is 04:00 on 1 Sep in Jakarta.
    expect(toDateKey('2026-08-31T21:00:00Z', 'Asia/Jakarta')).toBe('2026-09-01');
  });

  it('gives different keys for the same instant in different zones', () => {
    const instant = '2026-08-31T18:00:00Z';
    expect(toDateKey(instant, 'Asia/Jakarta')).toBe('2026-09-01');
    expect(toDateKey(instant, 'America/New_York')).toBe('2026-08-31');
  });

  it('rejects an invalid input', () => {
    expect(() => toDateKey('not-a-date', 'UTC')).toThrow(RangeError);
  });
});

describe('addDays', () => {
  it('crosses a month boundary', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
  });

  it('crosses a year boundary backwards', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('handles a leap day', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('is stable across a DST transition (pure UTC maths)', () => {
    // Northern-hemisphere clocks change on 2026-03-29; day keys must not skip.
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
  });
});

describe('daysBetween', () => {
  it('counts forward and backward', () => {
    expect(daysBetween('2026-08-01', '2026-08-31')).toBe(30);
    expect(daysBetween('2026-08-31', '2026-08-01')).toBe(-30);
    expect(daysBetween('2026-08-31', '2026-08-31')).toBe(0);
  });
});

describe('ranges', () => {
  it('is inclusive at both ends', () => {
    expect(dateRange('2026-08-29', '2026-08-31')).toEqual([
      '2026-08-29',
      '2026-08-30',
      '2026-08-31',
    ]);
  });

  it('returns nothing for a reversed range', () => {
    expect(dateRange('2026-08-31', '2026-08-01')).toEqual([]);
  });

  it('builds the last N days ending today, oldest first', () => {
    expect(lastNDays(3, '2026-09-01')).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
    ]);
    expect(lastNDays(0, '2026-09-01')).toEqual([]);
  });
});

describe('durations', () => {
  it('measures minutes across midnight', () => {
    expect(
      minutesBetween('2026-08-31T23:15:00Z', '2026-09-01T06:45:00Z'),
    ).toBe(450);
  });

  it('formats hours and minutes in Indonesian', () => {
    expect(formatDuration(487)).toBe('8j 7m');
    expect(formatDuration(480)).toBe('8j');
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(-10)).toBe('0m');
  });
});

describe('helper pemilih tanggal', () => {
  it('menghitung panjang bulan, termasuk tahun kabisat', () => {
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 2)).toBe(28);
    // Kabisat: 2024 habis dibagi 4, 2000 habis dibagi 400, 1900 tidak.
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
  });
});
