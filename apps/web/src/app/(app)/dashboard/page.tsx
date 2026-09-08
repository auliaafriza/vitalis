'use client';

import {
  currentStreak,
  dayScore,
  formatDuration,
  formatKcal,
  formatVolume,
  formatWeight,
  lastNDays,
  MEAL_LABEL,
  relativeDayLabel,
  type DaySummary,
  type MealType,
} from '@calorya/core';
import Link from 'next/link';
import { useMemo } from 'react';
import { DayNav } from '@/components/nav';
import {
  Card,
  ErrorNote,
  ProgressBar,
  ProgressRing,
  SectionTitle,
  Skeleton,
  StatTile,
} from '@/components/ui';
import {
  useAddWater,
  useDaySummaries,
  useDaySummary,
  useFoodEntries,
  useLatestWeight,
  useProfile,
  useTargets,
} from '@/lib/hooks';
import { useDay } from '@/lib/use-day';

const QUICK_WATER = [200, 350, 500] as const;
const MEAL_ORDER: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_EMOJI: Record<MealType, string> = {
  breakfast: '\u{1F963}',
  lunch: '\u{1F371}',
  dinner: '\u{1F372}',
  snack: '\u{1F34E}',
};

export default function DashboardPage() {
  const { data: profile } = useProfile();
  const day = useDay(profile?.timezone);

  const { data: targets, isLoading: targetsLoading } = useTargets(day.selected);
  const { data: summary, isLoading: summaryLoading, error } = useDaySummary(day.selected);
  const { data: latestWeight } = useLatestWeight();
  const { data: entries } = useFoodEntries(day.selected);

  const window = useMemo(() => lastNDays(30, day.today), [day.today]);
  const { data: recent } = useDaySummaries(window[0] ?? day.today, day.today);
  const addWater = useAddWater(day.selected);

  const streak = useMemo(
    () => currentStreak((recent ?? []).map((s) => s.loggedOn), day.today),
    [recent, day.today],
  );

  /**
   * Calories per meal, so the day reads as a story rather than one number.
   * Meals with nothing logged are dropped: an empty row says "ate nothing",
   * which is a different claim from "did not record".
   */
  const byMeal = useMemo(() => {
    const totals = new Map<MealType, number>();
    for (const entry of entries ?? []) {
      totals.set(entry.meal, (totals.get(entry.meal) ?? 0) + entry.kcal);
    }
    return MEAL_ORDER.map((meal) => ({ meal, kcal: totals.get(meal) ?? 0 })).filter(
      (row) => row.kcal > 0,
    );
  }, [entries]);

  const today: DaySummary = summary ?? {
    loggedOn: day.selected,
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
  };

  if (error) return <ErrorNote error={error} />;

  if (targetsLoading || summaryLoading || !targets) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10" />
        <Skeleton className="h-64" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  const score = dayScore(today, targets);
  const remaining = targets.kcal - today.kcal;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-sm text-ink-500">
              Halo{profile?.fullName ? `, ${profile.fullName.split(' ')[0]}` : ''}
            </p>
            <h1 className="text-xl font-semibold">
              {relativeDayLabel(day.selected, day.today)}
            </h1>
          </div>
          {streak > 0 && (
            <span className="rounded-full bg-move/10 px-3 py-1 text-sm font-medium text-move">
              🔥 {streak} hari
            </span>
          )}
        </div>
        <DayNav
          selected={day.selected}
          today={day.today}
          canGoForward={day.canGoForward}
          onPrevious={day.goToPreviousDay}
          onNext={day.goToNextDay}
          onToday={day.goToToday}
        />
      </header>

      <Card className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-8">
        <ProgressRing
          value={today.kcal}
          max={targets.kcal}
          size={150}
          stroke={12}
          color="var(--color-food)"
          label={`${Math.round(today.kcal)} dari ${targets.kcal} kalori`}
          center={
            <>
              <span className="tabular text-3xl font-semibold">
                {Math.round(today.kcal)}
              </span>
              <span className="text-xs text-ink-500">dari {targets.kcal} kkal</span>
            </>
          }
        />

        <div className="w-full flex-1 space-y-3">
          <p className="text-sm text-ink-300">
            {remaining >= 0 ? (
              <>
                Sisa <strong className="text-ink-100">{formatKcal(remaining)}</strong>{' '}
                untuk hari ini
              </>
            ) : (
              <>
                Lewat <strong className="text-body">{formatKcal(-remaining)}</strong> dari
                target
              </>
            )}
          </p>

          <MacroRow
            label="Protein"
            value={today.proteinG}
            max={targets.proteinG}
            color="var(--color-body)"
          />
          <MacroRow
            label="Karbohidrat"
            value={today.carbsG}
            max={targets.carbsG}
            color="var(--color-move)"
          />
          <MacroRow
            label="Lemak"
            value={today.fatG}
            max={targets.fatG}
            color="var(--color-sleep)"
          />
          <MacroRow
            label="Serat"
            value={today.fiberG}
            max={targets.fiberG}
            color="var(--color-food)"
          />

          <Link
            href="/nutrition"
            className="mt-1 block rounded-xl bg-brand-500 py-3 text-center text-sm font-semibold text-ink-950"
          >
            + Catat Makanan
          </Link>
        </div>
      </Card>

      <Card>
        <SectionTitle>Ringkasan Hari Ini</SectionTitle>
        {byMeal.length === 0 ? (
          <p className="text-sm text-ink-500">
            Belum ada yang dicatat. Mulai dari sarapan?
          </p>
        ) : (
          <ul className="divide-y divide-ink-800">
            {byMeal.map((row) => (
              <li key={row.meal} className="flex items-center gap-3 py-2.5">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-base"
                >
                  {MEAL_EMOJI[row.meal]}
                </span>
                <span className="flex-1 text-sm font-medium">{MEAL_LABEL[row.meal]}</span>
                <span className="tabular text-sm text-ink-500">
                  {Math.round(row.kcal)} kal
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <section>
        <SectionTitle
          action={
            <span className="tabular text-sm font-medium text-brand-400">
              Skor {score.total}/100
            </span>
          }
        >
          Ringkasan hari ini
        </SectionTitle>

        <div className="grid grid-cols-2 gap-3">
          <StatTile
            label="Air"
            value={formatVolume(today.waterMl)}
            hint={`Target ${formatVolume(targets.waterMl)}`}
            accent="var(--color-water)"
          />
          <StatTile
            label="Tidur"
            value={today.sleepMin === null ? '—' : formatDuration(today.sleepMin)}
            hint={`Target ${formatDuration(targets.sleepMin)}`}
            accent="var(--color-sleep)"
          />
          <StatTile
            label="Langkah"
            value={today.steps === null ? '—' : today.steps.toLocaleString('id-ID')}
            hint={`Target ${targets.steps.toLocaleString('id-ID')}`}
            accent="var(--color-move)"
          />
          <StatTile
            label="Berat"
            value={
              today.weightKg
                ? formatWeight(today.weightKg)
                : latestWeight
                  ? formatWeight(latestWeight.weightKg)
                  : '—'
            }
            hint={today.weightKg ? 'Ditimbang hari ini' : 'Terakhir tercatat'}
            accent="var(--color-body)"
          />
        </div>
      </section>

      <Card>
        <SectionTitle
          action={
            <Link href="/health" className="text-sm text-brand-400 underline-offset-4 hover:underline">
              Catat lainnya
            </Link>
          }
        >
          Tambah air cepat
        </SectionTitle>
        <div className="flex gap-2">
          {QUICK_WATER.map((ml) => (
            <button
              key={ml}
              type="button"
              disabled={addWater.isPending}
              onClick={() =>
                addWater.mutate({ loggedOn: day.selected, amountMl: ml })
              }
              className="flex-1 rounded-xl border border-water/40 bg-water/10 py-3 text-sm font-medium text-water disabled:opacity-50"
            >
              +{ml} ml
            </button>
          ))}
        </div>
        <ProgressBar
          value={today.waterMl}
          max={targets.waterMl}
          color="var(--color-water)"
          label="Progres minum air"
        />
      </Card>
    </div>
  );
}

function MacroRow({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-ink-500">{label}</span>
        <span className="tabular text-ink-300">
          {Math.round(value)} / {max} g
        </span>
      </div>
      <ProgressBar value={value} max={max} color={color} label={`${label} harian`} />
    </div>
  );
}
