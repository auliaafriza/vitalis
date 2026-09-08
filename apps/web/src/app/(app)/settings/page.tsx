'use client';

import { saveTargets, updateProfile } from '@calorya/api';
import {
  ACTIVITY_LABEL,
  ACTIVITY_LEVELS,
  formatVolume,
  GOAL_LABEL,
  targetsSchema,
  type ActivityLevel,
  type Goal,
} from '@calorya/core';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Card, ErrorNote, Field, inputClass, SectionTitle } from '@/components/ui';
import { ThemePicker } from '@/components/theme-picker';
import { qk, useProfile, useTargets } from '@/lib/hooks';
import { getBrowserClient } from '@/lib/supabase/client';
import { useDay } from '@/lib/use-day';

const GOALS: Goal[] = ['lose', 'maintain', 'gain'];

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const day = useDay(profile?.timezone);
  const { data: targets } = useTargets(day.today);

  const [form, setForm] = useState({
    kcal: '',
    proteinG: '',
    carbsG: '',
    fatG: '',
    fiberG: '',
    waterMl: '',
    sleepMin: '',
    steps: '',
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!targets) return;
    setForm({
      kcal: String(targets.kcal),
      proteinG: String(targets.proteinG),
      carbsG: String(targets.carbsG),
      fatG: String(targets.fatG),
      fiberG: String(targets.fiberG),
      waterMl: String(targets.waterMl),
      sleepMin: String(targets.sleepMin),
      steps: String(targets.steps),
    });
  }, [targets]);

  async function handleProfileChange(patch: {
    activityLevel?: ActivityLevel;
    goal?: Goal;
  }) {
    setError(null);
    try {
      await updateProfile(getBrowserClient(), patch);
      await queryClient.invalidateQueries({ queryKey: qk.profile });
    } catch (err) {
      setError(err);
    }
  }

  async function handleTargetsSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = targetsSchema.safeParse(form);
    if (!parsed.success) {
      setError(new Error(parsed.error.issues[0]?.message ?? 'Nilai target tidak valid'));
      return;
    }

    setStatus('saving');
    try {
      // A new target version starts today; history keeps its old goals.
      await saveTargets(getBrowserClient(), parsed.data, day.today);
      await queryClient.invalidateQueries({ queryKey: ['targets'] });
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      setError(err);
      setStatus('idle');
    }
  }

  async function handleSignOut() {
    await getBrowserClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Profil & target</h1>

      <Card>
        <SectionTitle>Akun</SectionTitle>
        <p className="text-sm text-ink-300">{profile?.fullName ?? 'Tanpa nama'}</p>
        <p className="text-xs text-ink-500">Zona waktu: {profile?.timezone}</p>
      </Card>

      <Card>
        <SectionTitle>Tampilan</SectionTitle>
        <ThemePicker />
      </Card>

      <Card>
        <SectionTitle>Tingkat aktivitas</SectionTitle>
        <div className="space-y-2">
          {ACTIVITY_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => handleProfileChange({ activityLevel: level })}
              aria-pressed={profile?.activityLevel === level}
              className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm ${
                profile?.activityLevel === level
                  ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                  : 'border-ink-700 text-ink-300'
              }`}
            >
              {ACTIVITY_LABEL[level]}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Tujuan</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {GOALS.map((goal) => (
            <button
              key={goal}
              type="button"
              onClick={() => handleProfileChange({ goal })}
              aria-pressed={profile?.goal === goal}
              className={`rounded-xl border px-2 py-3 text-xs ${
                profile?.goal === goal
                  ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                  : 'border-ink-700 text-ink-300'
              }`}
            >
              {GOAL_LABEL[goal]}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle
          action={
            status === 'saved' ? (
              <span className="text-sm text-brand-400">Tersimpan</span>
            ) : undefined
          }
        >
          Target harian
        </SectionTitle>

        <form onSubmit={handleTargetsSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Kalori (kkal)"
              value={form.kcal}
              onChange={(v) => setForm({ ...form, kcal: v })}
            />
            <NumberField
              label="Protein (g)"
              value={form.proteinG}
              onChange={(v) => setForm({ ...form, proteinG: v })}
            />
            <NumberField
              label="Karbohidrat (g)"
              value={form.carbsG}
              onChange={(v) => setForm({ ...form, carbsG: v })}
            />
            <NumberField
              label="Lemak (g)"
              value={form.fatG}
              onChange={(v) => setForm({ ...form, fatG: v })}
            />
            <NumberField
              label="Serat (g)"
              value={form.fiberG}
              onChange={(v) => setForm({ ...form, fiberG: v })}
            />
            <NumberField
              label="Air (ml)"
              value={form.waterMl}
              onChange={(v) => setForm({ ...form, waterMl: v })}
              hint={
                Number(form.waterMl) > 0 ? formatVolume(Number(form.waterMl)) : undefined
              }
            />
            <NumberField
              label="Tidur (menit)"
              value={form.sleepMin}
              onChange={(v) => setForm({ ...form, sleepMin: v })}
            />
            <NumberField
              label="Langkah"
              value={form.steps}
              onChange={(v) => setForm({ ...form, steps: v })}
            />
          </div>

          <p className="text-xs text-ink-500">
            Target baru berlaku mulai hari ini. Grafik hari-hari sebelumnya tetap
            dinilai dengan target lama.
          </p>

          {error != null && <ErrorNote error={error} />}

          <Button type="submit" disabled={status === 'saving'} className="w-full">
            {status === 'saving' ? 'Menyimpan…' : 'Simpan target'}
          </Button>
        </form>
      </Card>

      <Button variant="ghost" onClick={handleSignOut} className="w-full">
        Keluar
      </Button>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </Field>
  );
}
