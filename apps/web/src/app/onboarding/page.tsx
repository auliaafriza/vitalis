'use client';

import { completeOnboarding } from '@calorya/api';
import {
  ACTIVITY_HINT,
  ACTIVITY_LABEL,
  ACTIVITY_LEVELS,
  bmi,
  bmiCategory,
  BMI_LABEL,
  credentialsSchema,
  deriveTargets,
  formatKcal,
  formatVolume,
  GOAL_LABEL,
  ONBOARDING_STEPS,
  onboardingSchema,
  SEX_LABEL,
  todayKey,
  validateOnboardingStep,
  type ActivityLevel,
  type Goal,
  type Sex,
} from '@calorya/core';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button, Card, Field, inputClass, PasswordInput } from '@/components/ui';
import { getBrowserClient } from '@/lib/supabase/client';

const GOALS: Goal[] = ['lose', 'maintain', 'gain'];
const SEXES: Sex[] = ['female', 'male'];

/**
 * First-login setup, in three steps.
 *
 * One long form was the old shape and it asked for everything at once: name,
 * two dates, two measurements, two choices, before anything could be saved.
 * Split, each screen holds one kind of question — and, more usefully, a wrong
 * answer is caught at the step it belongs to rather than at the very end.
 *
 * The step boundaries and their validation live in @calorya/core so the phone
 * asks the same three questions in the same order.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Asia/Jakarta',
    [],
  );

  const [stepIndex, setStepIndex] = useState(0);
  const step = ONBOARDING_STEPS[stepIndex]!;
  const isLast = stepIndex === ONBOARDING_STEPS.length - 1;

  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('1998-01-01');
  const [sex, setSex] = useState<Sex>('female');
  const [heightCm, setHeightCm] = useState('165');
  const [weightKg, setWeightKg] = useState('60');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('light');
  const [goal, setGoal] = useState<Goal>('maintain');
  /** Optional. Empty means "keep the password chosen at sign-up". */
  const [password, setPassword] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const values = { fullName, birthDate, sex, heightCm, weightKg, activityLevel, goal };

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

  /** Advance only if this step's own fields are valid. */
  function next() {
    const stepErrors = validateOnboardingStep(step.id, values);

    // The optional password is checked here rather than on submit: it belongs
    // to the identity step, and finding out on the last screen that a password
    // typed three steps ago is too short is a miserable way to learn it.
    if (step.id === 'identity' && password.length > 0) {
      const parsed = credentialsSchema.shape.password.safeParse(password);
      if (!parsed.success) {
        stepErrors['password'] = parsed.error.issues[0]?.message ?? 'Sandi tidak valid';
      }
    }

    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) return;
    setStepIndex((i) => i + 1);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isLast) {
      next();
      return;
    }
    setErrors({});

    // The whole object, not just this step: the split above is presentational,
    // and a field cannot become valid by being on a screen the user skipped.
    const parsed = onboardingSchema.safeParse({ ...values, timezone });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      // Jump back to the step that owns the first bad field, otherwise the
      // error is announced on a screen that does not contain the input.
      const owner = ONBOARDING_STEPS.findIndex(
        (s) => Object.keys(validateOnboardingStep(s.id, values)).length > 0,
      );
      if (owner >= 0) setStepIndex(owner);
      return;
    }

    setBusy(true);
    try {
      // Password first, deliberately. If it fails, nothing has been written
      // yet and the user can correct it; doing it after would leave a profile
      // saved and a password silently unchanged.
      if (password.length > 0) {
        const { error } = await getBrowserClient().auth.updateUser({ password });
        if (error) throw error;
      }

      await completeOnboarding(
        getBrowserClient(),
        parsed.data,
        todayKey(parsed.data.timezone),
      );
      // Straight into the intro rather than the dashboard: the numbers only
      // just came into existence, and a dashboard is a poor place to learn
      // what they mean. The app shell would bounce them here anyway.
      router.replace('/tutorial');
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
        <p className="text-sm font-semibold tracking-[0.18em] text-brand-400 uppercase">
          Calorya
        </p>

        {/* Progress: the same bar-and-label pattern as the tutorial, so the two
            first-run screens read as one flow rather than two products. */}
        <ol className="mt-4 flex gap-2" aria-label="Langkah pengaturan">
          {ONBOARDING_STEPS.map((s, i) => (
            <li key={s.id} className="flex-1">
              <div
                className={`h-1.5 rounded-full ${
                  i <= stepIndex ? 'bg-brand-500' : 'bg-ink-800'
                }`}
                aria-current={i === stepIndex ? 'step' : undefined}
              />
              <span
                className={`mt-1.5 block text-xs ${
                  i <= stepIndex ? 'text-ink-300' : 'text-ink-500'
                }`}
              >
                {s.label}
              </span>
            </li>
          ))}
        </ol>

        <h1 className="mt-5 text-2xl font-semibold">{step.title}</h1>
        <p className="mt-1 text-sm text-ink-500">{step.hint}</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {step.id === 'identity' && (
          <>
            <Field label="Nama" error={errors['fullName']}>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
                placeholder="Nama panggilan"
                autoComplete="name"
                autoFocus
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

            <Field
              label="Ganti kata sandi (opsional)"
              hint="Kosongkan kalau sandi yang kamu buat saat daftar sudah pas."
              error={errors['password']}
            >
              <PasswordInput
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
              />
            </Field>
          </>
        )}

        {step.id === 'body' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tinggi (cm)" error={errors['heightCm']}>
                <input
                  type="number"
                  inputMode="decimal"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className={inputClass}
                  autoFocus
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

            {preview && (
              <p className="text-sm text-ink-500">
                BMI-mu{' '}
                <strong className="text-ink-100">
                  {preview.bmiValue} · {preview.bmiLabel}
                </strong>{' '}
                <span className="text-xs">(ambang WHO Asia-Pasifik)</span>
              </p>
            )}
          </>
        )}

        {step.id === 'targets' && (
          <>
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
                    <span className="block text-xs text-ink-500">
                      {ACTIVITY_HINT[level]}
                    </span>
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
                  Dihitung dengan rumus Mifflin-St Jeor. Kategori BMI memakai ambang
                  batas WHO Asia-Pasifik. Ini estimasi, bukan saran medis.
                </p>
              </Card>
            )}
          </>
        )}

        {errors['form'] && (
          <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">
            {errors['form']}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          {stepIndex > 0 && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setErrors({});
                setStepIndex((i) => i - 1);
              }}
            >
              Kembali
            </Button>
          )}
          <Button type="submit" disabled={busy} className="flex-1">
            {busy ? 'Menyimpan…' : isLast ? 'Simpan & mulai' : 'Lanjut'}
          </Button>
        </div>

        <p className="text-center text-xs text-ink-500">
          Langkah {stepIndex + 1} dari {ONBOARDING_STEPS.length} · semuanya bisa diubah
          lagi di Pengaturan
        </p>
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
