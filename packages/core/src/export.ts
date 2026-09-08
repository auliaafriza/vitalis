import { formatDuration } from './date';
import type { DaySummary, FoodEntry } from './types';

/**
 * CSV generation.
 *
 * Pure string work, kept here so both apps produce byte-identical files and so
 * the escaping rules are testable — spreadsheet exports are exactly the kind of
 * thing that looks fine until someone's food is called `Nasi "Uduk", spesial`.
 */

/**
 * Escape one field for RFC 4180.
 *
 * The leading-apostrophe rule is not cosmetic: a value beginning with = + - or
 * @ is interpreted as a FORMULA by Excel, Google Sheets and LibreOffice. A food
 * named `=cmd|...` in an exported file is a real attack on whoever opens it, so
 * such values are neutralised before quoting.
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);

  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

export interface CsvOptions {
  /**
   * Prepend a UTF-8 byte-order mark. Excel on Windows reads a BOM-less UTF-8
   * file as the local codepage, which turns every accented character into
   * mojibake — on by default because most people open these in Excel.
   */
  bom?: boolean;
  /** CRLF is what RFC 4180 specifies and what Excel is happiest with. */
  newline?: '\r\n' | '\n';
}

export function toCsv<T>(
  rows: readonly T[],
  columns: readonly CsvColumn<T>[],
  options: CsvOptions = {},
): string {
  const { bom = true, newline = '\r\n' } = options;

  const lines = [
    columns.map((c) => escapeCsvField(c.header)).join(','),
    ...rows.map((row) => columns.map((c) => escapeCsvField(c.value(row))).join(',')),
  ];

  return (bom ? '﻿' : '') + lines.join(newline) + newline;
}

const round = (n: number | null, digits = 0): string =>
  n === null || n === undefined ? '' : n.toFixed(digits);

/** One row per day: the file someone hands to a dietitian. */
export function daySummariesToCsv(days: readonly DaySummary[]): string {
  return toCsv<DaySummary>(days, [
    { header: 'Tanggal', value: (d) => d.loggedOn },
    { header: 'Kalori (kkal)', value: (d) => round(d.kcal) },
    { header: 'Protein (g)', value: (d) => round(d.proteinG) },
    { header: 'Karbohidrat (g)', value: (d) => round(d.carbsG) },
    { header: 'Lemak (g)', value: (d) => round(d.fatG) },
    { header: 'Serat (g)', value: (d) => round(d.fiberG) },
    { header: 'Air (ml)', value: (d) => round(d.waterMl) },
    { header: 'Tidur (menit)', value: (d) => round(d.sleepMin) },
    { header: 'Tidur', value: (d) => (d.sleepMin === null ? '' : formatDuration(d.sleepMin)) },
    { header: 'Langkah', value: (d) => round(d.steps) },
    { header: 'Berat (kg)', value: (d) => round(d.weightKg, 1) },
    { header: 'Suasana hati (1-5)', value: (d) => round(d.moodAvg, 1) },
  ]);
}

/** One row per logged item: the detail behind the daily totals. */
export function foodEntriesToCsv(entries: readonly FoodEntry[]): string {
  const MEAL: Record<string, string> = {
    breakfast: 'Sarapan',
    lunch: 'Makan siang',
    dinner: 'Makan malam',
    snack: 'Camilan',
  };

  return toCsv<FoodEntry>(entries, [
    { header: 'Tanggal', value: (e) => e.loggedOn },
    { header: 'Waktu makan', value: (e) => MEAL[e.meal] ?? e.meal },
    { header: 'Makanan', value: (e) => e.foodName },
    { header: 'Porsi (g)', value: (e) => round(e.quantityG, 1) },
    { header: 'Kalori (kkal)', value: (e) => round(e.kcal, 1) },
    { header: 'Protein (g)', value: (e) => round(e.proteinG, 1) },
    { header: 'Karbohidrat (g)', value: (e) => round(e.carbsG, 1) },
    { header: 'Lemak (g)', value: (e) => round(e.fatG, 1) },
    { header: 'Serat (g)', value: (e) => round(e.fiberG, 1) },
    { header: 'Gula (g)', value: (e) => round(e.sugarG, 1) },
    { header: 'Natrium (mg)', value: (e) => round(e.sodiumMg, 1) },
  ]);
}

/** `calorya-harian-2026-09-01_2026-09-07.csv` */
export function exportFilename(kind: string, from: string, to: string): string {
  return `calorya-${kind}-${from}_${to}.csv`;
}
