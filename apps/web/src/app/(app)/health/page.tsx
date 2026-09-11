'use client';

import {
  bmi,
  bmiCategory,
  BMI_LABEL,
  formatDuration,
  formatVolume,
  minutesBetween,
  sleepScore,
} from '@calorya/core';
import { useState } from 'react';
import { DayNav } from '@/components/nav';
import { WaterQuickAdd } from '@/components/water-quick-add';
import {
  Button,
  Card,
  ErrorNote,
  Field,
  inputClass,
  ProgressBar,
  SectionTitle,
  Skeleton,
  Spinner,
} from '@/components/ui';
import {
  useAddMood,
  useDeleteWater,
  useProfile,
  useSaveSleep,
  useSaveSteps,
  useSaveWeight,
  useSleep,
  useSteps,
  useTargets,
  useWaterEntries,
} from '@/lib/hooks';
import { useDay } from '@/lib/use-day';

const MOODS = [
  { score: 1, emoji: '😞', label: 'Buruk' },
  { score: 2, emoji: '🙁', label: 'Kurang' },
  { score: 3, emoji: '😐', label: 'Biasa' },
  { score: 4, emoji: '🙂', label: 'Baik' },
  { score: 5, emoji: '😄', label: 'Hebat' },
] as const;

export default function HealthPage() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const day = useDay(profile?.timezone);
  const { data: targets, isLoading: targetsLoading } = useTargets(day.selected);

  /*
   * Every card below takes its denominator from `targets`, and each one falls
   * back to a hard-coded default — 2000 ml, 480 minutes, 8000 steps. Rendering
   * before the query answers therefore shows five progress bars measured
   * against numbers the user never chose, which then jump when the real
   * targets land. Waiting is both more honest and less jarring.
   */
  if (profileLoading || targetsLoading) {
    return (
      <div className="space-y-5">
        <header className="space-y-3">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-10" />
        </header>
        <Skeleton className="h-44" />
        <Skeleton className="h-72" />
        <Skeleton className="h-40" />
        <Skeleton className="h-32" />
        <Skeleton className="h-28" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <h1 className="text-xl font-semibold">Kesehatan harian</h1>
        <DayNav
          selected={day.selected}
          today={day.today}
          canGoForward={day.canGoForward}
          onPrevious={day.goToPreviousDay}
          onNext={day.goToNextDay}
          onToday={day.goToToday}
        />
      </header>

      <WaterCard day={day.selected} target={targets?.waterMl ?? 2000} />
      <SleepCard day={day.selected} targetMin={targets?.sleepMin ?? 480} />
      <StepsCard day={day.selected} target={targets?.steps ?? 8000} />
      <WeightCard day={day.selected} heightCm={profile?.heightCm ?? null} />
      <MoodCard day={day.selected} />
    </div>
  );
}

function WaterCard({ day, target }: { day: string; target: number }) {
  const { data: entries } = useWaterEntries(day);
  const removeWater = useDeleteWater(day);

  const total = (entries ?? []).reduce((sum, entry) => sum + entry.amountMl, 0);

  return (
    <Card>
      <SectionTitle
        action={
          <span className="tabular text-sm text-ink-300">
            {formatVolume(total)} / {formatVolume(target)}
          </span>
        }
      >
        💧 Air minum
      </SectionTitle>

      <ProgressBar
        value={total}
        max={target}
        color="var(--color-water)"
        label="Progres minum air"
      />

      <div className="mt-3">
        <WaterQuickAdd day={day} />
      </div>

      {entries && entries.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => removeWater.mutate(entry.id)}
                disabled={removeWater.isPending}
                aria-busy={
                  (removeWater.isPending && removeWater.variables === entry.id) ||
                  undefined
                }
                aria-label={`Hapus catatan ${entry.amountMl} ml`}
                className="inline-flex items-center gap-1.5 rounded-full bg-ink-800 px-2.5 py-1 text-xs text-ink-300 hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50"
              >
                {entry.amountMl} ml
                {removeWater.isPending && removeWater.variables === entry.id ? (
                  <Spinner className="h-3 w-3" />
                ) : (
                  '×'
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

        </Card>
  );
}

function SleepCard({ day, targetMin }: { day: string; targetMin: number }) {
  const { data: sleep } = useSleep(day);
  const save = useSaveSleep(day);

  const [bedtime, setBedtime] = useState('22:30');
  const [wakeAt, setWakeAt] = useState('06:00');
  const [quality, setQuality] = useState(3);

  /**
   * Bedtime belongs to the previous calendar day whenever it is later than
   * the wake time — the ordinary case. Computing it here rather than asking
   * the user for two full dates keeps the form to two taps.
   */
  function computeDuration(): number {
    const wake = new Date(`${day}T${wakeAt}:00`);
    const bed = new Date(`${day}T${bedtime}:00`);
    if (bed >= wake) bed.setDate(bed.getDate() - 1);
    return minutesBetween(bed, wake);
  }

  const duration = computeDuration();

  return (
    <Card>
      <SectionTitle
        action={
          sleep ? (
            <span className="tabular text-sm text-ink-300">
              {formatDuration(sleep.durationMin)} · skor{' '}
              {sleepScore(sleep.durationMin, targetMin)}
            </span>
          ) : undefined
        }
      >
        🌙 Tidur
      </SectionTitle>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const wake = new Date(`${day}T${wakeAt}:00`);
          const bed = new Date(`${day}T${bedtime}:00`);
          if (bed >= wake) bed.setDate(bed.getDate() - 1);
          save.mutate({
            loggedOn: day,
            bedtime: bed.toISOString(),
            wakeAt: wake.toISOString(),
            durationMin: duration,
            quality,
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tidur jam">
            <input
              type="time"
              value={bedtime}
              onChange={(e) => setBedtime(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Bangun jam">
            <input
              type="time"
              value={wakeAt}
              onChange={(e) => setWakeAt(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <p className="text-sm text-ink-500">
          Durasi: <strong className="text-ink-100">{formatDuration(duration)}</strong>
        </p>

        <Field label="Kualitas tidur">
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setQuality(value)}
                aria-pressed={quality === value}
                className={`flex-1 rounded-xl border py-2 text-sm ${
                  quality === value
                    ? 'border-sleep bg-sleep/10 text-sleep'
                    : 'border-ink-700 text-ink-500'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </Field>

        <Button type="submit" variant="ghost" busy={save.isPending} className="w-full">
          {save.isPending ? 'Menyimpan…' : sleep ? 'Perbarui tidur' : 'Simpan tidur'}
        </Button>
        {save.error != null && <ErrorNote error={save.error} />}
      </form>
    </Card>
  );
}

function StepsCard({ day, target }: { day: string; target: number }) {
  const { data: steps } = useSteps(day);
  const save = useSaveSteps(day);
  const [value, setValue] = useState('');

  const current = steps?.steps ?? 0;

  return (
    <Card>
      <SectionTitle
        action={
          <span className="tabular text-sm text-ink-300">
            {current.toLocaleString('id-ID')} / {target.toLocaleString('id-ID')}
          </span>
        }
      >
        👟 Langkah
      </SectionTitle>

      <ProgressBar
        value={current}
        max={target}
        color="var(--color-move)"
        label="Progres langkah"
      />

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(value);
          if (!Number.isFinite(n) || n < 0) return;
          save.mutate({ loggedOn: day, steps: Math.round(n), source: 'manual' });
          setValue('');
        }}
      >
        <input
          type="number"
          inputMode="numeric"
          min={0}
          placeholder={current ? String(current) : 'Jumlah langkah'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={inputClass}
          aria-label="Jumlah langkah"
        />
        <Button type="submit" variant="ghost" busy={save.isPending}>
          {save.isPending ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </form>
      <p className="mt-2 text-xs text-ink-500">
        Di aplikasi mobile angka ini terisi otomatis dari pedometer perangkat.
      </p>
    </Card>
  );
}

function WeightCard({ day, heightCm }: { day: string; heightCm: number | null }) {
  const save = useSaveWeight(day);
  const [value, setValue] = useState('');

  const parsed = Number(value);
  const showBmi = heightCm && Number.isFinite(parsed) && parsed >= 20;
  const bmiValue = showBmi ? bmi(parsed, heightCm) : null;

  return (
    <Card>
      <SectionTitle>⚖️ Berat badan</SectionTitle>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!Number.isFinite(parsed) || parsed < 20 || parsed > 400) return;
          save.mutate({ loggedOn: day, weightKg: parsed });
          setValue('');
        }}
      >
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min={20}
          max={400}
          placeholder="kg"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={inputClass}
          aria-label="Berat badan dalam kilogram"
        />
        <Button type="submit" variant="ghost" busy={save.isPending}>
          {save.isPending ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </form>

      {bmiValue !== null && (
        <p className="mt-2 text-xs text-[#c07d12]">
          BMI {bmiValue} · {BMI_LABEL[bmiCategory(bmiValue)]} (ambang WHO Asia-Pasifik)
        </p>
      )}
      {save.error != null && <ErrorNote error={save.error} />}
    </Card>
  );
}

function MoodCard({ day }: { day: string }) {
  const addMood = useAddMood(day);
  const [saved, setSaved] = useState<number | null>(null);

  return (
    <Card>
      <SectionTitle>🧠 Suasana hati</SectionTitle>
      <div className="flex justify-between gap-2">
        {MOODS.map((mood) => (
          <button
            key={mood.score}
            type="button"
            disabled={addMood.isPending}
            aria-busy={
              (addMood.isPending && addMood.variables?.score === mood.score) || undefined
            }
            onClick={() =>
              addMood.mutate(
                { loggedOn: day, score: mood.score },
                { onSuccess: () => setSaved(mood.score) },
              )
            }
            aria-label={mood.label}
            aria-pressed={saved === mood.score}
            className={`flex-1 rounded-xl border py-3 text-2xl transition-colors ${
              saved === mood.score
                ? 'border-brand-500 bg-brand-500/10'
                : 'border-ink-700 hover:bg-ink-800'
            }`}
          >
            {addMood.isPending && addMood.variables?.score === mood.score ? (
              <Spinner className="mx-auto h-5 w-5" />
            ) : (
              <span aria-hidden="true">{mood.emoji}</span>
            )}
          </button>
        ))}
      </div>
    </Card>
  );
}
