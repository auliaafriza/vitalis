import { describe, expect, it } from 'vitest';
import { formatFullDate, MONTH_NAMES_FULL } from '../format';

describe('formatFullDate', () => {
  it('menulis tanggal panjang dalam bahasa Indonesia', () => {
    expect(formatFullDate('2026-04-12')).toBe('12 April 2026');
    expect(formatFullDate('1998-01-01')).toBe('1 Januari 1998');
    expect(formatFullDate('2000-12-31')).toBe('31 Desember 2000');
  });

  it('mengembalikan masukan yang rusak apa adanya, bukan "NaN undefined"', () => {
    expect(formatFullDate('bukan-tanggal')).toBe('bukan-tanggal');
    expect(formatFullDate('')).toBe('');
  });

  it('punya dua belas nama bulan', () => {
    expect(MONTH_NAMES_FULL).toHaveLength(12);
    expect(MONTH_NAMES_FULL[0]).toBe('Januari');
    expect(MONTH_NAMES_FULL[11]).toBe('Desember');
  });
});
