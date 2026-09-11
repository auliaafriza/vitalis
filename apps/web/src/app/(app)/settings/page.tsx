'use client';

import Link from 'next/link';
import {
  recomputeTargets,
  saveTargets,
  setTutorialSeen,
  signOutEverywhere,
  updateProfile,
} from '@calorya/api';
import {
  ACTIVITY_LABEL,
  ACTIVITY_LEVELS,
  authErrorMessage,
  credentialsSchema,
  formatVolume,
  GOAL_LABEL,
  onboardingSchema,
  targetsSchema,
  type ActivityLevel,
  type Goal,
} from '@calorya/core';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorNote,
  Field,
  inputClass,
  PasswordInput,
  SectionTitle,
  Skeleton,
  Spinner,
} from '@/components/ui';
import { ThemePicker } from '@/components/theme-picker';
import { qk, useProfile, useTargets } from '@/lib/hooks';
import { getBrowserClient } from '@/lib/supabase/client';
import { useDay } from '@/lib/use-day';

const GOALS: Goal[] = ['lose', 'maintain', 'gain'];

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const day = useDay(profile?.timezone);
  const { data: targets, isLoading: targetsLoading } = useTargets(day.today);

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

  /**
   * A change to any of these is a change to the plan.
   *
   * `day.today` is what turns that from a label change into a recalculation:
   * passing it lets updateProfile derive a fresh set of targets from the new
   * goal, height or activity level. Without it, tapping "Naikkan massa otot"
   * used to highlight a button and leave every number on the dashboard exactly
   * where it was.
   */
  /**
   * Which option is currently being written, so the chip the user pressed can
   * say so.
   *
   * Choosing a goal now triggers a profile update *and* a full target
   * recalculation — two round trips. Before this, the button did not even
   * change colour until both came back, which on a slow connection is several
   * seconds of a screen that looks like it ignored the tap.
   */
  const [pendingChoice, setPendingChoice] = useState<string | null>(null);

  async function handleProfileChange(patch: {
    activityLevel?: ActivityLevel;
    goal?: Goal;
    heightCm?: number;
  }) {
    setError(null);
    setPendingChoice(patch.goal ?? patch.activityLevel ?? 'height');
    try {
      await updateProfile(getBrowserClient(), patch, day.today);
      await queryClient.invalidateQueries({ queryKey: qk.profile });
      await queryClient.invalidateQueries({ queryKey: ['targets'] });
    } catch (err) {
      setError(err);
    } finally {
      setPendingChoice(null);
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
      // 'manual' marks these as the user's own numbers, so the automatic
      // recalculation that follows a weigh-in leaves them alone.
      await saveTargets(getBrowserClient(), parsed.data, day.today, 'manual');
      await queryClient.invalidateQueries({ queryKey: ['targets'] });
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      setError(err);
      setStatus('idle');
    }
  }

  /**
   * The way back from a manual target.
   *
   * Once someone types their own numbers the app stops touching them, which
   * is right — but it would be a trap without a door. This is the door.
   */
  const [recomputing, setRecomputing] = useState(false);

  async function handleRecompute() {
    setError(null);
    setRecomputing(true);
    try {
      const next = await recomputeTargets(getBrowserClient(), day.today, {
        force: true,
      });
      if (!next) {
        setError(
          new Error(
            'Belum bisa dihitung: lengkapi tanggal lahir, jenis kelamin dan tinggi, lalu catat berat badanmu minimal sekali.',
          ),
        );
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['targets'] });
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      setError(err);
    } finally {
      setRecomputing(false);
    }
  }

  /**
   * Height, editable after setup.
   *
   * It was write-once before, which meant a typo during onboarding quietly
   * skewed the BMR — and therefore every calorie target — for good.
   */
  const [heightDraft, setHeightDraft] = useState('');
  const [heightBusy, setHeightBusy] = useState(false);
  const [heightSaved, setHeightSaved] = useState(false);
  const [heightError, setHeightError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.heightCm != null) setHeightDraft(String(profile.heightCm));
  }, [profile?.heightCm]);

  async function saveHeight() {
    setHeightError(null);
    const parsed = onboardingSchema.shape.heightCm.safeParse(heightDraft);
    if (!parsed.success) {
      setHeightError(parsed.error.issues[0]?.message ?? 'Tinggi tidak valid');
      return;
    }
    if (parsed.data === profile?.heightCm) return;

    setHeightBusy(true);
    try {
      await handleProfileChange({ heightCm: parsed.data });
      setHeightSaved(true);
      setTimeout(() => setHeightSaved(false), 2000);
    } finally {
      setHeightBusy(false);
    }
  }

  /**
   * Replay the intro.
   *
   * Clears the column and navigates; the app shell would send them there on
   * the next render anyway, so this is the same gate rather than a second one.
   */
  /**
   * Name and password, editable after setup.
   *
   * Both were write-once before this: the name could only be set during
   * onboarding and the password only at sign-up or through the emailed reset
   * link. Neither is a reasonable place to leave a user — a typo in your own
   * name is not worth a support request, and changing a password should not
   * require pretending to have forgotten it.
   */
  const [nameDraft, setNameDraft] = useState('');
  const [nameSaved, setNameSaved] = useState(false);
  const [nameBusy, setNameBusy] = useState(false);

  useEffect(() => {
    if (profile?.fullName != null) setNameDraft(profile.fullName);
  }, [profile?.fullName]);

  async function saveName() {
    const trimmed = nameDraft.trim();
    if (trimmed.length === 0 || trimmed === (profile?.fullName ?? '')) return;
    setError(null);
    setNameBusy(true);
    try {
      await updateProfile(getBrowserClient(), { fullName: trimmed });
      await queryClient.invalidateQueries({ queryKey: qk.profile });
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } catch (err) {
      setError(err);
    } finally {
      setNameBusy(false);
    }
  }

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordDone, setPasswordDone] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function savePassword() {
    setPasswordError(null);
    const parsed = credentialsSchema.shape.password.safeParse(password);
    if (!parsed.success) {
      setPasswordError(parsed.error.issues[0]?.message ?? 'Kata sandi tidak valid');
      return;
    }
    if (password !== passwordConfirm) {
      setPasswordError('Konfirmasi kata sandi belum sama.');
      return;
    }
    setPasswordBusy(true);
    try {
      const { error: updateError } = await getBrowserClient().auth.updateUser({
        password,
      });
      if (updateError) throw updateError;
      setPassword('');
      setPasswordConfirm('');
      setPasswordDone(true);
      setTimeout(() => setPasswordDone(false), 3000);
    } catch (err) {
      setPasswordError(authErrorMessage(err));
    } finally {
      setPasswordBusy(false);
    }
  }

  async function replayTutorial() {
    await setTutorialSeen(getBrowserClient(), false);
    await queryClient.invalidateQueries({ queryKey: qk.profile });
    router.push('/tutorial');
  }

  /**
   * Signing out, confirmed first.
   *
   * The old version awaited `auth.signOut()` with no catch and no dialog. A
   * global sign-out is a network call that revokes the refresh token, so it
   * throws when offline and returns 403 when the token is already dead — and
   * in both cases the `router.replace` below it never ran. The button did
   * nothing at all, with nothing on screen to explain why.
   */
  const [askSignOut, setAskSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<unknown>(null);

  async function handleSignOut() {
    setSignOutError(null);
    setSigningOut(true);
    try {
      await signOutEverywhere(getBrowserClient());
      // Cached data belongs to the account that just left; the next person to
      // sign in on this browser must not see it for even one frame.
      queryClient.clear();
      router.replace('/login');
      router.refresh();
    } catch (err) {
      setSignOutError(err);
      setSigningOut(false);
    }
  }

  if (profileLoading || targetsLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-28" />
        <Skeleton className="h-56" />
        <Skeleton className="h-36" />
        <Skeleton className="h-44" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Profil & target</h1>

      <Card>
        <SectionTitle
          action={
            nameSaved ? (
              <span className="text-xs text-brand-400">Tersimpan</span>
            ) : undefined
          }
        >
          Nama
        </SectionTitle>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void saveName();
          }}
        >
          <input
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            className={inputClass}
            placeholder="Nama panggilan"
            autoComplete="name"
            maxLength={80}
            aria-label="Nama"
          />
          <Button
            type="submit"
            variant="ghost"
            busy={nameBusy}
            disabled={nameDraft.trim() === (profile?.fullName ?? '')}
          >
            Simpan
          </Button>
        </form>
        <p className="mt-2 text-xs text-ink-500">Zona waktu: {profile?.timezone}</p>
      </Card>

      <Card>
        <SectionTitle>Kata sandi</SectionTitle>
        {passwordDone ? (
          <p className="text-sm text-brand-400">Kata sandi berhasil diganti.</p>
        ) : null}
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void savePassword();
          }}
        >
          <Field label="Kata sandi baru" hint="Minimal 8 karakter">
            <PasswordInput
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Ulangi kata sandi" error={passwordError ?? undefined}>
            <PasswordInput
              value={passwordConfirm}
              onChange={setPasswordConfirm}
              autoComplete="new-password"
            />
          </Field>
          <Button
            type="submit"
            variant="ghost"
            busy={passwordBusy}
            disabled={password.length === 0}
            className="w-full"
          >
            {passwordBusy ? 'Menyimpan…' : 'Ganti kata sandi'}
          </Button>
        </form>
      </Card>

      <Card>
        <SectionTitle>Tampilan</SectionTitle>
        <ThemePicker />
      </Card>

      <Card>
        <SectionTitle>Panduan</SectionTitle>
        <p className="text-sm text-ink-500">
          Perkenalan singkat tentang cara mencatat makanan, air dan progress.
        </p>
        <Button variant="ghost" onClick={replayTutorial} className="mt-3">
          Lihat tutorial lagi
        </Button>
      </Card>

      <Card>
        <SectionTitle>Privasi</SectionTitle>
        <p className="text-sm text-ink-500">
          Catatanmu hanya bisa dibaca oleh akunmu, dan tidak ada iklan atau
          pelacak di aplikasi ini.
        </p>
        <Link
          href="/privasi"
          className="mt-3 inline-block text-sm font-medium text-brand-400 underline underline-offset-4"
        >
          Baca kebijakan privasi
        </Link>
      </Card>

      <Card>
        <SectionTitle
          action={
            heightSaved ? (
              <span className="text-xs text-brand-400">Tersimpan</span>
            ) : undefined
          }
        >
          Tinggi badan
        </SectionTitle>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void saveHeight();
          }}
        >
          <input
            type="number"
            inputMode="numeric"
            value={heightDraft}
            onChange={(event) => setHeightDraft(event.target.value)}
            className={inputClass}
            placeholder="cm"
            aria-label="Tinggi badan dalam sentimeter"
          />
          <Button
            type="submit"
            variant="ghost"
            busy={heightBusy}
            disabled={heightDraft === String(profile?.heightCm ?? '')}
          >
            Simpan
          </Button>
        </form>
        {heightError != null && (
          <p className="mt-2 text-xs text-red-400">{heightError}</p>
        )}
        <p className="mt-2 text-xs text-ink-500">
          Tinggi ikut menentukan kebutuhan kalori dasarmu, jadi mengubahnya di
          sini langsung menghitung ulang target hari ini.
        </p>
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
              aria-busy={pendingChoice === level || undefined}
              disabled={pendingChoice !== null}
              className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm disabled:opacity-60 ${
                profile?.activityLevel === level
                  ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                  : 'border-ink-700 text-ink-300'
              }`}
            >
              {ACTIVITY_LABEL[level]}
              {pendingChoice === level ? <Spinner className="h-4 w-4" /> : null}
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
              aria-busy={pendingChoice === goal || undefined}
              disabled={pendingChoice !== null}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-xs disabled:opacity-60 ${
                profile?.goal === goal
                  ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                  : 'border-ink-700 text-ink-300'
              }`}
            >
              {pendingChoice === goal ? (
                <Spinner className="h-3.5 w-3.5" />
              ) : (
                GOAL_LABEL[goal]
              )}
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

          <Button type="submit" busy={status === 'saving'} className="w-full">
            {status === 'saving' ? 'Menyimpan…' : 'Simpan target'}
          </Button>
        </form>

        <div className="mt-4 border-t border-ink-800 pt-4">
          <p className="text-xs text-ink-500">
            Kalau kamu belum pernah mengisi angka di atas, target ini menyesuaikan
            sendiri setiap kali berat badan, tujuan, tinggi atau tingkat aktivitasmu
            berubah. Begitu kamu menyimpan angkamu sendiri, aplikasi berhenti
            mengubahnya — tombol di bawah mengembalikannya ke perhitungan otomatis.
          </p>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void handleRecompute()}
            busy={recomputing}
            className="mt-3 w-full"
          >
            {recomputing ? 'Menghitung…' : 'Hitung ulang otomatis'}
          </Button>
        </div>
      </Card>

      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          setSignOutError(null);
          setAskSignOut(true);
        }}
        className="w-full"
      >
        Keluar
      </Button>

      <ConfirmDialog
        open={askSignOut}
        title="Keluar dari akun?"
        message="Sesi di browser ini akan dihapus dan token-nya dicabut. Catatanmu tetap tersimpan dan menunggu kamu kembali."
        confirmLabel="Keluar"
        destructive
        busy={signingOut}
        error={signOutError}
        onConfirm={() => void handleSignOut()}
        onCancel={() => setAskSignOut(false)}
      />
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
