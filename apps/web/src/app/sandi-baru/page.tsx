'use client';

import { authErrorMessage, credentialsSchema } from '@calorya/core';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Field, PasswordInput } from '@/components/ui';
import { getBrowserClient } from '@/lib/supabase/client';

/**
 * Set a new password.
 *
 * Clicking the emailed link puts Supabase into a temporary recovery session —
 * `updateUser` works, but nothing else should be assumed. The page waits for
 * that session before showing the form, because rendering the fields first and
 * failing on submit is the confusing order.
 */
export default function SandiBaruPage() {
  const router = useRouter();
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = getBrowserClient();

    // The link may still be exchanging when this mounts, so listen as well as
    // ask — whichever arrives first wins.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true);
    });

    void supabase.auth.getSession().then(({ data }) => {
      setReady((previous) => previous ?? Boolean(data.session));
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = credentialsSchema.shape.password.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Kata sandi tidak valid');
      return;
    }
    if (password !== confirm) {
      setError('Konfirmasi kata sandi belum sama.');
      return;
    }

    setBusy(true);
    try {
      const { error: updateError } = await getBrowserClient().auth.updateUser({
        password,
      });
      if (updateError) throw updateError;
      setDone(true);
      // Straight in — the recovery session is a real session, so making them
      // type the password they just chose would be pure ceremony.
      setTimeout(() => {
        router.replace('/dashboard');
        router.refresh();
      }, 1200);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full max-w-sm flex-col justify-center px-5 py-12">
      <p className="text-sm font-semibold tracking-[0.18em] text-brand-400 uppercase">
        Calorya
      </p>
      <h1 className="mt-2 text-xl font-semibold">Kata sandi baru</h1>

      {done ? (
        <p className="mt-6 text-sm text-ink-300">
          Kata sandi berhasil diganti. Mengalihkan ke aplikasi…
        </p>
      ) : ready === false ? (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-ink-300">
            Tautan ini sudah kedaluwarsa atau pernah dipakai. Tautan pemulihan hanya
            berlaku satu jam dan sekali pakai.
          </p>
          <Link
            href="/lupa-sandi"
            className="inline-block text-sm font-medium text-brand-400 underline underline-offset-4"
          >
            Minta tautan baru
          </Link>
        </div>
      ) : ready === null ? (
        <p className="mt-6 text-sm text-ink-500">Memeriksa tautan…</p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Kata sandi baru" error={error ?? undefined}>
            <PasswordInput
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />
          </Field>

          <Field label="Ulangi kata sandi">
            <PasswordInput
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
            />
          </Field>

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Menyimpan…' : 'Simpan kata sandi'}
          </Button>
        </form>
      )}
    </main>
  );
}
