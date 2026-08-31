'use client';

import { credentialsSchema } from '@vitalis/core';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button, Field, inputClass } from '@/components/ui';
import { getBrowserClient } from '@/lib/supabase/client';

type Mode = 'signin' | 'signup';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/dashboard';

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setNotice(null);

    const parsed = credentialsSchema.safeParse({ email, password });
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
      const supabase = getBrowserClient();
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        setNotice(
          'Akun dibuat. Jika konfirmasi email diaktifkan di project Supabase kamu, cek inbox dulu sebelum masuk.',
        );
        setMode('signin');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        router.replace(next);
        router.refresh();
      }
    } catch (error) {
      setErrors({
        form: error instanceof Error ? error.message : 'Gagal memproses permintaan',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <header className="mb-8">
        <p className="text-2xl font-semibold text-brand-400">Vitalis</p>
        <h1 className="mt-2 text-xl font-semibold">
          {mode === 'signin' ? 'Masuk ke akunmu' : 'Buat akun baru'}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Catat nutrisi, air, tidur, langkah, dan berat badan dalam satu tempat.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="Email" error={errors['email']}>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="nama@email.com"
          />
        </Field>

        <Field
          label="Kata sandi"
          hint="Minimal 8 karakter"
          error={errors['password']}
        >
          <input
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            placeholder="••••••••"
          />
        </Field>

        {errors['form'] && (
          <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">
            {errors['form']}
          </p>
        )}
        {notice && (
          <p className="rounded-xl bg-brand-500/10 p-3 text-sm text-brand-400">{notice}</p>
        )}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Memproses…' : mode === 'signin' ? 'Masuk' : 'Daftar'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-500">
        {mode === 'signin' ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setErrors({});
          }}
          className="font-medium text-brand-400 underline underline-offset-4"
        >
          {mode === 'signin' ? 'Daftar' : 'Masuk'}
        </button>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
