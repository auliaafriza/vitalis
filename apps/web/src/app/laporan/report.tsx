'use client';

import {
  daysBetween,
  formatDayLabel,
  formatDuration,
  limitsFor,
  linearTrend,
  MEAL_LABEL,
  type DaySummary,
  type FoodEntry,
} from '@calorya/core';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import {
  useDaySummaries,
  useFoodEntriesRange,
  useProfile,
  useTargets,
  useTier,
  useWeights,
} from '@/lib/hooks';
import { useDay } from '@/lib/use-day';

/**
 * The printable report.
 *
 * This is the PDF half of the export feature: rather than shipping a PDF
 * library to the browser, the report is a page styled for paper and handed to
 * the browser's own print-to-PDF. That keeps selectable text, real fonts and
 * proper page breaks — and adds nothing to the bundle.
 *
 * It lives outside the (app) route group on purpose, so none of the app chrome
 * (bottom navigation, padding for the home indicator) reaches the paper.
 */

const MAX_DETAIL_DAYS = 31;

export default function Report() {
  const params = useSearchParams();
  const { data: profile } = useProfile();
  const day = useDay(profile?.timezone);
  const { data: tier } = useTier();
  const canExport = limitsFor(tier).canExport;

  const to = params.get('to') ?? day.today;
  const from = params.get('from') ?? day.today;

  const summaries = useDaySummaries(from, to);
  const { data: weights } = useWeights(from, to);
  const { data: targets } = useTargets(to);

  const spanDays = Math.max(1, daysBetween(from, to) + 1);
  const withDetail = canExport && spanDays <= MAX_DETAIL_DAYS;
  const { data: entries } = useFoodEntriesRange(from, to, withDetail);

  /**
   * Days with nothing logged are dropped rather than printed as rows of zeros:
   * on paper an empty row reads as "ate nothing", which is a different claim
   * from "did not record".
   */
  const series = useMemo(
    () =>
      [...(summaries.data ?? [])]
        .filter(
          (d) =>
            d.kcal > 0 ||
            d.waterMl > 0 ||
            d.sleepMin !== null ||
            d.steps !== null ||
            d.weightKg !== null,
        )
        .sort((a, b) => a.loggedOn.localeCompare(b.loggedOn)),
    [summaries.data],
  );

  const stats = useMemo(() => summarise(series), [series]);

  const weightTrend = useMemo(
    () =>
      linearTrend((weights ?? []).map((w) => ({ day: w.loggedOn, value: w.weightKg }))),
    [weights],
  );

  const byDay = useMemo(() => groupByDay(entries ?? []), [entries]);

  if (!canExport) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-lg font-semibold">Laporan adalah fitur Premium</h1>
        <p className="mt-2 text-sm text-ink-500">
          Laporan cetak dan ekspor CSV tersedia di paket Premium.
        </p>
        <Link href="/trends" className="mt-6 inline-block text-sm text-brand-400 underline">
          Kembali ke tren
        </Link>
      </main>
    );
  }

  return (
    <main className="report mx-auto max-w-3xl px-8 py-10 text-[12px] leading-relaxed">
      <div className="no-print mb-8 flex items-center justify-between gap-3 rounded-lg bg-[#f3f4f6] px-4 py-3">
        <p className="text-[12px] text-[#374151]">
          Gunakan <strong>Cetak</strong> lalu pilih “Simpan sebagai PDF”.
        </p>
        <div className="flex gap-2">
          <Link
            href="/trends"
            className="rounded-md border border-[#d1d5db] px-3 py-1.5 text-[12px] text-[#374151]"
          >
            Kembali
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md bg-[#111827] px-3 py-1.5 text-[12px] font-medium text-white"
          >
            Cetak
          </button>
        </div>
      </div>

      <header className="mb-6 flex items-end justify-between gap-4 border-b border-[#9ca3af] pb-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[#6b7280] uppercase">
            Calorya
          </p>
          <h1 className="mt-1 text-[19px] font-semibold">
            Laporan Kesehatan &amp; Nutrisi
          </h1>
          <p className="mt-1 text-[#4b5563]">
            {profile?.fullName ?? 'Pengguna'} · {formatDayLabel(from)} –{' '}
            {formatDayLabel(to)} ({spanDays} hari)
          </p>
        </div>
        <p className="text-right text-[11px] text-[#6b7280]">
          Dicetak {formatDayLabel(day.today)}
          <br />
          {stats.loggedDays} hari tercatat
        </p>
      </header>

      {summaries.isLoading ? (
        <p className="py-10 text-center text-[#6b7280]">Menyiapkan laporan…</p>
      ) : series.length === 0 ? (
        <p className="py-10 text-center text-[#6b7280]">
          Tidak ada catatan pada rentang ini.
        </p>
      ) : (
        <>
          <Section title="Ringkasan">
            <dl className="grid grid-cols-3 gap-x-6 gap-y-3">
              <Stat
                label="Rata-rata kalori"
                value={`${Math.round(stats.kcal).toLocaleString('id-ID')} kkal`}
                note={targets ? `target ${targets.kcal.toLocaleString('id-ID')}` : undefined}
              />
              <Stat label="Rata-rata protein" value={`${Math.round(stats.protein)} g`}
                note={targets ? `target ${targets.proteinG} g` : undefined} />
              <Stat label="Rata-rata karbohidrat" value={`${Math.round(stats.carbs)} g`} />
              <Stat label="Rata-rata lemak" value={`${Math.round(stats.fat)} g`} />
              <Stat label="Rata-rata serat" value={`${Math.round(stats.fiber)} g`} />
              <Stat
                label="Rata-rata air"
                value={`${(stats.water / 1000).toFixed(1)} L`}
                note={targets ? `target ${(targets.waterMl / 1000).toFixed(1)} L` : undefined}
              />
              <Stat
                label="Rata-rata tidur"
                value={stats.sleep ? formatDuration(Math.round(stats.sleep)) : '—'}
                note={targets ? `target ${formatDuration(targets.sleepMin)}` : undefined}
              />
              <Stat
                label="Rata-rata langkah"
                value={stats.steps ? Math.round(stats.steps).toLocaleString('id-ID') : '—'}
                note={targets ? `target ${targets.steps.toLocaleString('id-ID')}` : undefined}
              />
              <Stat
                label="Berat badan"
                value={
                  stats.weightLast === null
                    ? '—'
                    : `${stats.weightLast.toFixed(1)} kg`
                }
                note={
                  weightTrend
                    ? `${weightTrend.slopePerWeek > 0 ? '+' : ''}${weightTrend.slopePerWeek} kg/minggu`
                    : undefined
                }
              />
            </dl>
          </Section>

          <Section title="Rincian harian">
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Kkal</th>
                  <th>Prot.</th>
                  <th>Karb.</th>
                  <th>Lemak</th>
                  <th>Serat</th>
                  <th>Air</th>
                  <th>Tidur</th>
                  <th>Langkah</th>
                  <th>Berat</th>
                </tr>
              </thead>
              <tbody>
                {series.map((d) => (
                  <tr key={d.loggedOn}>
                    <td>{formatDayLabel(d.loggedOn)}</td>
                    <td>{d.kcal ? Math.round(d.kcal) : '—'}</td>
                    <td>{d.kcal ? Math.round(d.proteinG) : '—'}</td>
                    <td>{d.kcal ? Math.round(d.carbsG) : '—'}</td>
                    <td>{d.kcal ? Math.round(d.fatG) : '—'}</td>
                    <td>{d.kcal ? Math.round(d.fiberG) : '—'}</td>
                    <td>{d.waterMl ? `${(d.waterMl / 1000).toFixed(1)} L` : '—'}</td>
                    <td>{d.sleepMin === null ? '—' : formatDuration(d.sleepMin)}</td>
                    <td>
                      {d.steps === null ? '—' : d.steps.toLocaleString('id-ID')}
                    </td>
                    <td>{d.weightKg === null ? '—' : d.weightKg.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {withDetail && byDay.length > 0 && (
            <Section title="Rincian makanan" breakBefore>
              {byDay.map(([date, items]) => (
                <div key={date} className="mb-4">
                  <h3 className="mb-1 text-[12px] font-semibold">
                    {formatDayLabel(date)}
                  </h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Makanan</th>
                        <th>Waktu</th>
                        <th>Porsi</th>
                        <th>Kkal</th>
                        <th>Prot.</th>
                        <th>Karb.</th>
                        <th>Lemak</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((e) => (
                        <tr key={e.id}>
                          <td>{e.foodName}</td>
                          <td>{MEAL_LABEL[e.meal]}</td>
                          <td>{Math.round(e.quantityG)} g</td>
                          <td>{Math.round(e.kcal)}</td>
                          <td>{e.proteinG.toFixed(1)}</td>
                          <td>{e.carbsG.toFixed(1)}</td>
                          <td>{e.fatG.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </Section>
          )}

          {canExport && spanDays > MAX_DETAIL_DAYS && (
            <p className="mt-4 text-[11px] text-[#6b7280]">
              Rincian per makanan disembunyikan karena rentang lebih dari{' '}
              {MAX_DETAIL_DAYS} hari. Gunakan ekspor CSV untuk data lengkapnya.
            </p>
          )}
        </>
      )}

      <footer className="mt-8 border-t border-[#e5e7eb] pt-3 text-[10px] text-[#6b7280]">
        Dibuat dengan Calorya. Angka berasal dari catatan mandiri pengguna dan
        bukan pengganti nasihat medis.
      </footer>
    </main>
  );
}

function Section({
  title,
  breakBefore = false,
  children,
}: {
  title: string;
  breakBefore?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`mb-7 ${breakBefore ? 'page-break' : ''}`}>
      <h2 className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-[#6b7280] uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div>
      <dt className="text-[10px] tracking-wide text-[#6b7280] uppercase">{label}</dt>
      <dd className="text-[15px] font-semibold tabular">{value}</dd>
      {note && <dd className="text-[10px] text-[#9ca3af]">{note}</dd>}
    </div>
  );
}

/** Averages over the days that actually have the value, never over zeros. */
function summarise(series: readonly DaySummary[]) {
  const mean = (values: number[]) =>
    values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

  const withFood = series.filter((d) => d.kcal > 0);
  const weighed = series.filter((d) => d.weightKg !== null);

  return {
    loggedDays: withFood.length,
    kcal: mean(withFood.map((d) => d.kcal)),
    protein: mean(withFood.map((d) => d.proteinG)),
    carbs: mean(withFood.map((d) => d.carbsG)),
    fat: mean(withFood.map((d) => d.fatG)),
    fiber: mean(withFood.map((d) => d.fiberG)),
    water: mean(series.map((d) => d.waterMl)),
    sleep: mean(
      series.filter((d) => d.sleepMin !== null).map((d) => d.sleepMin ?? 0),
    ),
    steps: mean(series.filter((d) => d.steps !== null).map((d) => d.steps ?? 0)),
    weightLast: weighed.length === 0 ? null : (weighed[weighed.length - 1]!.weightKg ?? null),
  };
}

function groupByDay(entries: readonly FoodEntry[]): [string, FoodEntry[]][] {
  const map = new Map<string, FoodEntry[]>();
  for (const entry of entries) {
    const list = map.get(entry.loggedOn);
    if (list) list.push(entry);
    else map.set(entry.loggedOn, [entry]);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}
