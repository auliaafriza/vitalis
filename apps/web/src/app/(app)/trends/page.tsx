'use client';

import {
  fillDays,
  formatDuration,
  formatShortDay,
  formatWeight,
  lastNDays,
  linearTrend,
  movingAverage,
} from '@vitalis/core';
import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Card,
  EmptyState,
  ErrorNote,
  SectionTitle,
  Skeleton,
  StatTile,
} from '@/components/ui';
import { useDaySummaries, useProfile, useTargets, useWeights } from '@/lib/hooks';
import { useDay } from '@/lib/use-day';

const RANGES = [
  { days: 7, label: '7 hari' },
  { days: 30, label: '30 hari' },
  { days: 90, label: '90 hari' },
] as const;

export default function TrendsPage() {
  const { data: profile } = useProfile();
  const day = useDay(profile?.timezone);
  const [range, setRange] = useState<number>(30);

  const days = useMemo(() => lastNDays(range, day.today), [range, day.today]);
  const from = days[0] ?? day.today;

  const { data: summaries, isLoading, error } = useDaySummaries(from, day.today);
  const { data: weights } = useWeights(from, day.today);
  const { data: targets } = useTargets(day.today);

  const series = useMemo(
    () => fillDays(summaries ?? [], days),
    [summaries, days],
  );

  /**
   * Weight is noisy day to day, so the chart shows the raw points faintly and
   * a 7-day moving average as the line people should actually read.
   */
  const weightSeries = useMemo(() => {
    const byDay = new Map((weights ?? []).map((w) => [w.loggedOn, w.weightKg]));
    const raw = days.map((d) => byDay.get(d) ?? null);
    const smoothed = movingAverage(raw, 7);
    return days.map((d, i) => ({
      day: d,
      label: formatShortDay(d),
      weight: raw[i],
      average: smoothed[i],
    }));
  }, [weights, days]);

  const weightTrend = useMemo(
    () =>
      linearTrend(
        (weights ?? []).map((w) => ({ day: w.loggedOn, value: w.weightKg })),
      ),
    [weights],
  );

  const averages = useMemo(() => {
    const withFood = series.filter((s) => s.kcal > 0);
    const withSleep = series.filter((s) => s.sleepMin !== null);
    const withSteps = series.filter((s) => s.steps !== null);
    const mean = (values: number[]) =>
      values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

    return {
      kcal: Math.round(mean(withFood.map((s) => s.kcal))),
      protein: Math.round(mean(withFood.map((s) => s.proteinG))),
      water: Math.round(mean(series.map((s) => s.waterMl))),
      sleep: Math.round(mean(withSleep.map((s) => s.sleepMin ?? 0))),
      steps: Math.round(mean(withSteps.map((s) => s.steps ?? 0))),
      loggedDays: withFood.length,
    };
  }, [series]);

  const chartData = series.map((s) => ({
    label: formatShortDay(s.loggedOn),
    kcal: s.kcal,
    water: s.waterMl,
    sleepHours: s.sleepMin === null ? null : Math.round((s.sleepMin / 60) * 10) / 10,
    steps: s.steps,
  }));

  if (error) return <ErrorNote error={error} />;

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Tren</h1>
        <div className="flex gap-1 rounded-xl border border-ink-800 p-1">
          {RANGES.map((option) => (
            <button
              key={option.days}
              type="button"
              onClick={() => setRange(option.days)}
              aria-pressed={range === option.days}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                range === option.days
                  ? 'bg-ink-800 text-ink-100'
                  : 'text-ink-500 hover:text-ink-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      ) : averages.loggedDays === 0 ? (
        <EmptyState
          title="Belum ada data untuk digrafikkan"
          description="Catat makanan dan kebiasaan harianmu beberapa hari, lalu tren akan muncul di sini."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label="Rata-rata kalori"
              value={averages.kcal.toLocaleString('id-ID')}
              unit="kkal"
              hint={`${averages.loggedDays} hari tercatat`}
              accent="var(--color-food)"
            />
            <StatTile
              label="Rata-rata protein"
              value={String(averages.protein)}
              unit="g"
              accent="var(--color-body)"
            />
            <StatTile
              label="Rata-rata air"
              value={(averages.water / 1000).toFixed(1)}
              unit="L"
              accent="var(--color-water)"
            />
            <StatTile
              label="Rata-rata tidur"
              value={averages.sleep ? formatDuration(averages.sleep) : '—'}
              accent="var(--color-sleep)"
            />
          </div>

          <Card>
            <SectionTitle
              action={
                weightTrend && (
                  <span
                    className={`tabular text-sm ${
                      weightTrend.direction === 'down'
                        ? 'text-brand-400'
                        : weightTrend.direction === 'up'
                          ? 'text-move'
                          : 'text-ink-500'
                    }`}
                  >
                    {weightTrend.slopePerWeek > 0 ? '+' : ''}
                    {weightTrend.slopePerWeek} kg/minggu
                  </span>
                )
              }
            >
              Berat badan
            </SectionTitle>

            {weights && weights.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={weightSeries} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-body)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--color-body)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-ink-800)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'var(--color-ink-500)', fontSize: 11 }}
                    interval="preserveStartEnd"
                    minTickGap={24}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={['dataMin - 1', 'dataMax + 1']}
                    tick={{ fill: 'var(--color-ink-500)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={weightFormatter}
                  />
                  <Area
                    type="monotone"
                    dataKey="average"
                    stroke="var(--color-body)"
                    strokeWidth={2}
                    fill="url(#weightFill)"
                    connectNulls
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="var(--color-ink-500)"
                    strokeWidth={0}
                    dot={{ r: 2, fill: 'var(--color-ink-500)' }}
                    connectNulls={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-sm text-ink-500">
                Belum ada catatan berat badan pada rentang ini.
              </p>
            )}
          </Card>

          <Card>
            <SectionTitle>Kalori harian</SectionTitle>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-ink-800)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--color-ink-500)', fontSize: 11 }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--color-ink-500)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={kcalFormatter}
                  cursor={{ fill: 'var(--color-ink-800)', opacity: 0.4 }}
                />
                {targets && (
                  <ReferenceLine
                    y={targets.kcal}
                    stroke="var(--color-brand-500)"
                    strokeDasharray="4 4"
                    label={{
                      value: 'target',
                      fill: 'var(--color-brand-500)',
                      fontSize: 10,
                      position: 'right',
                    }}
                  />
                )}
                <Bar dataKey="kcal" fill="var(--color-food)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <SectionTitle>Tidur (jam)</SectionTitle>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-ink-800)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--color-ink-500)', fontSize: 11 }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 12]}
                  tick={{ fill: 'var(--color-ink-500)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={sleepFormatter}
                  cursor={{ fill: 'var(--color-ink-800)', opacity: 0.4 }}
                />
                {targets && (
                  <ReferenceLine
                    y={targets.sleepMin / 60}
                    stroke="var(--color-sleep)"
                    strokeDasharray="4 4"
                  />
                )}
                <Bar dataKey="sleepHours" fill="var(--color-sleep)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}
    </div>
  );
}

/**
 * Recharts types tooltip values very loosely (they can be numbers, strings,
 * arrays, or undefined), so the formatters take `unknown` and narrow here
 * rather than lying to the compiler with a cast.
 */
function weightFormatter(value: unknown, name: unknown): [string, string] {
  const label = name === 'average' ? 'Rata-rata 7 hari' : 'Timbangan';
  return typeof value === 'number' ? [formatWeight(value), label] : ['—', label];
}

function kcalFormatter(value: unknown): [string, string] {
  return [
    typeof value === 'number' ? `${Math.round(value)} kkal` : '—',
    'Kalori',
  ];
}

function sleepFormatter(value: unknown): [string, string] {
  return [typeof value === 'number' ? `${value} jam` : '—', 'Tidur'];
}

const tooltipStyle = {
  background: 'var(--color-ink-900)',
  border: '1px solid var(--color-ink-700)',
  borderRadius: 12,
  fontSize: 12,
  color: 'var(--color-ink-100)',
} as const;
