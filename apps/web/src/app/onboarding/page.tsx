'use client';

import { completeOnboarding } from '@vitalis/api';
import {
  ACTIVITY_HINT,
  ACTIVITY_LABEL,
  ACTIVITY_LEVELS,
  bmi,
  bmiCategory,
  BMI_LABEL,
  deriveTargets,
  formatKcal,
  formatVolume,
  GOAL_LABEL,
  onboardingSchema,
  SEX_LABEL,
  todayKey,
  type ActivityLevel,
  type Goal,
  type Sex,
} from '@vitalis/core';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button, Card, Field, inputClass } from '@/components/ui';
import { getBrowserClient } from '@/lib/supabase/client';

const GOALS: Goal[] = ['lose', 'maintain', 'gain'];
const SEXES: Sex[] = ['female', 'male'];

export default function OnboardingPage() {
  const router = useRouter();
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Asia/Jakarta',
    [],
  );

  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('1998-01-01');
  const [sex, setSex] = useState<Sex>('female');
  const [heightCm, setHeightCm] = useState('165');
  const [weightKg, setWeightKg] = useState('60');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('light');
  const [goal, setGoal] = useState<Goal>('maintain');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  /**
   * Live preview of what the answers imply. Showing the calculated targets
   * *while* the user is still choosing is the whole point of doing the maths
   * in a shared, synchronous package instead of on the server.
   */
  const preview = useMemo(() => {
    const h = Number(heightCm);
    const w = Number(weightKg);
    const ageYears = Math.floor(
      (Date.now() - new Date(birthDate).getTime()) / 31_557_600_000,
    );
    if (!Number.isFinite(h) || !Number.isFinite(w) || h < 80 || w < 20 || ageYears < 13) {
      return null;
    }
    const targets = deriveTargets(
      { sex, weightKg: w, heightCm: h, ageYears },
      activityLevel,
      goal,
    );
    const bmiValue = bmi(w, h);
    return { targets, bmiValue, bmiLabel: BMI_LABEL[bmiCategory(bmiValue)], ageYears };
  }, [heightCm, weightKg, birthDate, sex, activityLevel, goal]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});

    const parsed = onboardingSchema.safeParse({
      fullName,
      birthDate,
      sex,
      heightCm,
      weightKg,
      activityLevel,
      goal,
      timezone,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setBusy(true);
    try {
      await completeOnboarding(
        getBrowserClient(),
        parsed.data,
        todayKey(parsed.data.timezone),
      );
      router.replace('/dashboard');
      router.refresh();
    } catch (error) {
      setErrors({
        form: error instanceof Error ? error.message : 'Gagal menyimpan profil',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-5 py-10 pb-24">
      <header className="mb-6">
        <p className="text-sm font-medium text-brand-400">Langkah terakhir</p>
        <h1 className="mt-1 text-2xl font-semibold">Kenalan dulu</h1>
        <p className="mt-1 text-sm text-ink-500">
          Data ini dipakai untuk menghitung target kalori, makro, dan air harianmu.
          Bisa diubah kapan saja di menu Profil.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Field label="Nama" error={errors['fullName']}>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClass}
            placeholder="Nama panggilan"
            autoComplete="name"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal lahir" error={errors['birthDate']}>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Jenis kelamin">
            <div className="grid grid-cols-2 gap-2">
              {SEXES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSex(option)}
                  aria-pressed={sex === option}
                  className={`rounded-xl border px-2 py-2.5 text-sm ${
                    sex === option
                      ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                      : 'border-ink-700 text-ink-300'
                  }`}
                >
                  {SEX_LABEL[option]}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tinggi (cm)" error={errors['heightCm']}>
            <input
              type="number"
              inputMode="decimal"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Berat (kg)" error={errors['weightKg']}>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink-300">
            Tingkat aktivitas
          </legend>
          <div className="space-y-2">
            {ACTIVITY_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setActivityLevel(level)}
                aria-pressed={activityLevel === level}
                className={`w-full rounded-xl border px-3 py-2.5 text-left ${
                  activityLevel === level
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-ink-700'
                }`}
              >
                <span className="block text-sm font-medium text-ink-100">
                  {ACTIVITY_LABEL[level]}
                </span>
                <span className="block text-xs text-ink-500">{ACTIVITY_HINT[level]}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink-300">Tujuan</legend>
          <div className="grid grid-cols-3 gap-2">
            {GOALS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setGoal(option)}
                aria-pressed={goal === option}
                className={`rounded-xl border px-2 py-3 text-xs ${
                  goal === option
                    ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                    : 'border-ink-700 text-ink-300'
                }`}
              >
                {GOAL_LABEL[option]}
              </button>
            ))}
          </div>
        </fieldset>

        {preview && (
          <Card className="space-y-3">
            <p className="text-sm font-medium text-ink-300">Target harianmu nanti</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Preview label="Kalori" value={formatKcal(preview.targets.kcal)} />
              <Preview label="Protein" value={`${preview.targets.proteinG} g`} />
              <Preview label="Karbohidrat" value={`${preview.targets.carbsG} g`} />
              <Preview label="Lemak" value={`${preview.targets.fatG} g`} />
              <Preview label="Air" value={formatVolume(preview.targets.waterMl)} />
              <Preview
                label="BMI"
                value={`${preview.bmiValue} · ${preview.bmiLabel}`}
              />
            </div>
            <p className="text-xs text-ink-500">
              Dihitung dengan rumus Mifflin-St Jeor. Kategori BMI memakai ambang batas
              WHO Asia-Pasifik. Ini estimasi, bukan saran medis.
            </p>
          </Card>
        )}

        {errors['form'] && (
          <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">
            {errors['form']}
          </p>
        )}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Menyimpan…' : 'Mulai pakai Vitalis'}
        </Button>
      </form>
    </main>
  );
}

function Preview({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-500">{label}</p>
      <p className="tabular font-semibold text-ink-100">{value}</p>
    </div>
  );
}
