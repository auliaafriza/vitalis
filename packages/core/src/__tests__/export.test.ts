import { describe, expect, it } from 'vitest';
import {
  daySummariesToCsv,
  escapeCsvField,
  exportFilename,
  foodEntriesToCsv,
  toCsv,
  type CsvColumn,
} from '../export';
import type { DaySummary, FoodEntry } from '../types';

describe('escapeCsvField', () => {
  it('leaves plain values alone', () => {
    expect(escapeCsvField('Nasi putih')).toBe('Nasi putih');
    expect(escapeCsvField(195)).toBe('195');
  });

  it('renders null and undefined as empty, not as the word "null"', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('quotes fields containing a comma, quote or newline', () => {
    expect(escapeCsvField('Nasi, spesial')).toBe('"Nasi, spesial"');
    expect(escapeCsvField('Nasi "Uduk"')).toBe('"Nasi ""Uduk"""');
    expect(escapeCsvField('baris1\nbaris2')).toBe('"baris1\nbaris2"');
  });

  it('neutralises spreadsheet formula injection', () => {
    // A food named =cmd|… would execute when the dietitian opens the file.
    expect(escapeCsvField('=1+1')).toBe("'=1+1");
    expect(escapeCsvField('+62812')).toBe("'+62812");
    expect(escapeCsvField('-5')).toBe("'-5");
    expect(escapeCsvField('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('quotes a neutralised value that also needs quoting', () => {
    expect(escapeCsvField('=a,b')).toBe('"\'=a,b"');
  });
});

describe('toCsv', () => {
  interface Row {
    a: string;
    b: number;
  }
  const rows: Row[] = [{ a: 'satu', b: 1 }, { a: 'dua, koma', b: 2 }];
  const cols: CsvColumn<Row>[] = [
    { header: 'Kolom A', value: (r) => r.a },
    { header: 'Kolom B', value: (r) => r.b },
  ];

  it('writes a header row and CRLF line endings', () => {
    const csv = toCsv(rows, cols, { bom: false });
    expect(csv).toBe('Kolom A,Kolom B\r\nsatu,1\r\n"dua, koma",2\r\n');
  });

  it('prepends a BOM by default so Excel reads UTF-8 correctly', () => {
    expect(toCsv(rows, cols).startsWith('﻿')).toBe(true);
    expect(toCsv(rows, cols, { bom: false }).startsWith('﻿')).toBe(false);
  });

  it('still emits headers for an empty export', () => {
    const csv = toCsv([], cols, { bom: false });
    expect(csv).toBe('Kolom A,Kolom B\r\n');
  });
});

const day = (over: Partial<DaySummary>): DaySummary => ({
  loggedOn: '2026-09-01',
  kcal: 1850, proteinG: 120, carbsG: 200, fatG: 60, fiberG: 25,
  waterMl: 2000, sleepMin: 450, steps: 8200, moodAvg: 4, weightKg: 70.4,
  ...over,
});

describe('daySummariesToCsv', () => {
  it('includes every tracked column', () => {
    const csv = daySummariesToCsv([day({})]);
    const [header, row] = csv.replace('﻿', '').trim().split('\r\n');
    expect(header).toContain('Tanggal');
    expect(header).toContain('Kalori (kkal)');
    expect(header).toContain('Berat (kg)');
    expect(row).toContain('2026-09-01');
    expect(row).toContain('70.4');
    expect(row).toContain('7j 30m'); // sleep rendered readably as well as raw
  });

  it('leaves untracked values blank rather than writing 0', () => {
    // A day with no weigh-in is not a day the user weighed 0 kg.
    const csv = daySummariesToCsv([day({ weightKg: null, sleepMin: null, steps: null })]);
    const row = csv.replace('﻿', '').trim().split('\r\n')[1]!;
    expect(row.endsWith(',,')).toBe(false);
    expect(row).toContain(',,'); // empty fields present
    expect(row).not.toContain('0.0');
  });
});

describe('foodEntriesToCsv', () => {
  const entry: FoodEntry = {
    id: 'e1', foodId: 'f1', foodName: 'Nasi putih',
    loggedOn: '2026-09-01', loggedAt: '2026-09-01T05:00:00Z',
    meal: 'lunch', quantityG: 150,
    kcal: 195, proteinG: 4.1, carbsG: 42.3, fatG: 0.5,
    fiberG: 0.6, sugarG: 0.2, sodiumMg: 1.5,
  };

  it('translates the meal name and keeps one row per item', () => {
    const csv = foodEntriesToCsv([entry, { ...entry, id: 'e2', meal: 'breakfast' }]);
    const lines = csv.replace('﻿', '').trim().split('\r\n');
    expect(lines).toHaveLength(3); // header + 2
    expect(lines[1]).toContain('Makan siang');
    expect(lines[2]).toContain('Sarapan');
    expect(lines[1]).toContain('Nasi putih');
  });

  it('escapes a food name that would break the file', () => {
    const csv = foodEntriesToCsv([{ ...entry, foodName: 'Nasi "Uduk", spesial' }]);
    expect(csv).toContain('"Nasi ""Uduk"", spesial"');
  });
});

describe('exportFilename', () => {
  it('names the file by kind and range', () => {
    expect(exportFilename('harian', '2026-09-01', '2026-09-07'))
      .toBe('calorya-harian-2026-09-01_2026-09-07.csv');
  });
});
