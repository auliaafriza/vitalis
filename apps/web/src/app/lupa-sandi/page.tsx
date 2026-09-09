'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, Field, inputClass } from '@/components/ui';
import { getBrowserClient } from '@/lib/supabase/client';

/**
 * Ask for a reset link.
 *
 * The response is deliberately identical whether or not the address has an
 * account. Saying "email tidak terdaftar" turns this form into a way to test
 * whether someone uses the app, which for a health app is worth avoiding.
 */
export default function LupaSandiPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!trimmed.includes('@')) {
      setError('Masukkan alamat email yang valid.');
      return;
    }

    setBusy(true);
    try {
      const { error: sendError } = await getBrowserClient().auth.resetPasswordForEmail(
        trimmed,
        { redirectTo: `${window.location.origin}/sandi-baru` },
      );
      // A rate-limit or transport failure is worth showing; "no such user" is
      // not something Supabase reports here, and that is the desired shape.
      if (sendError) throw sendError;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim tautan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full max-w-sm flex-col justify-center px-5 py-12">
      <p className="text-sm font-semibold tracking-[0.18em] text-brand-400 uppercase">
        Calorya
      </p>
      <h1 className="mt-2 text-xl font-semibold">Lupa kata sandi</h1>

      {sent ? (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-ink-300">
            Kalau <strong className="text-ink-100">{email.trim()}</strong> terdaftar,
            tautan untuk mengganti kata sandi sudah dikirim ke sana. Tautannya berlaku
            satu jam.
          </p>
          <p className="text-sm text-ink-500">
            Belum masuk juga setelah beberapa menit? Periksa folder spam.
          </p>
          <Link
            href="/login"
            className="inline-block text-sm font-medium text-brand-400 underline underline-offset-4"
          >
            Kembali ke halaman masuk
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <p className="text-sm text-ink-500">
            Masukkan email akunmu. Kami kirimkan tautan untuk membuat kata sandi baru.
          </p>

          <Field label="Email" error={error ?? undefined}>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="nama@email.com"
              className={inputClass}
            />
          </Field>

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Mengirim…' : 'Kirim tautan'}
          </Button>

          <p className="text-center text-sm text-ink-500">
            <Link href="/login" className="text-brand-400 underline underline-offset-4">
              Kembali ke halaman masuk
            </Link>
          </p>
        </form>
      )}
    </main>
  );
}
