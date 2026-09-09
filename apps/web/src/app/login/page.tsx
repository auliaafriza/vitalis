'use client';

import Link from 'next/link';
import { authErrorMessage, credentialsSchema } from '@calorya/core';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button, Field, inputClass, PasswordInput } from '@/components/ui';
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
  /**
   * What happened at sign-up, kept as a shape rather than a sentence.
   *
   * The old version set a one-line `notice` and flipped the form to sign-in.
   * On screen that reads as a rejection: the fields you just filled empty
   * themselves, the button changes, and the only sign of success is a small
   * line most people scroll past. Holding the email and whether a confirmation
   * is pending lets the screen say plainly what was created and what to do.
   */
  const [signedUp, setSignedUp] = useState<{
    email: string;
    /** false = the address was already registered, so nothing was created. */
    created: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setSignedUp(null);

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
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;

        /**
         * Whether a confirmation email is required is a project setting, not
         * something the client can know in advance — so read the answer off
         * the response instead of guessing. With confirmation off, Supabase
         * returns a session and the user is already signed in; telling them to
         * "check your inbox" would strand them on the login screen in front of
         * an email that is never coming.
         */
        if (data.session) {
          // Confirmation is off, so they are already signed in. The app shell
          // sends them to the setup steps; no point pausing on a success card
          // they would have to dismiss.
          router.replace(next);
          router.refresh();
        } else if (data.user && (data.user.identities?.length ?? 0) === 0) {
          /*
           * The address is ALREADY REGISTERED.
           *
           * Supabase refuses to say so — telling a stranger which addresses
           * have accounts is an enumeration attack — so it returns success
           * with a fabricated user whose `identities` array is empty. No
           * error, no session, nothing created.
           *
           * Without this branch that is indistinguishable from "check your
           * inbox", which is how re-testing with the same address produces a
           * confirmation message forever and an email that never arrives.
           */
          setSignedUp({ email: parsed.data.email, created: false });
          setMode('signin');
        } else {
          /*
           * The destination is named out loud.
           *
           * Supabase only honours `emailRedirectTo` when the URL is also on
           * the Redirect URLs allowlist; when it is not, it silently falls
           * back to the project's Site URL — which is http://localhost:3000
           * in a fresh project. Nothing errors, so the first sign that
           * anything is wrong is a dead link in someone's inbox, hours later.
           *
           * Saying which host the link will point at turns that into an
           * immediate, obvious mismatch. It is also simply useful: signing up
           * from a local dev server SHOULD produce a localhost link, and this
           * is what tells the two situations apart.
           */
          setSignedUp({ email: parsed.data.email, created: true });
          setMode('signin');
          setPassword('');
        }
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
      // Said in Indonesian, from the shared table — the phone shows the same
      // sentence for the same failure.
      setErrors({ form: authErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <header className="mb-8">
        <p className="text-2xl font-semibold text-brand-400">Calorya</p>
        <h1 className="mt-2 text-xl font-semibold">
          {mode === 'signin' ? 'Masuk ke akunmu' : 'Buat akun baru'}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Catat nutrisi, air, tidur, langkah, dan berat badan dalam satu tempat.
        </p>
      </header>

      {signedUp && (
        <div
          role="status"
          className={`mb-5 rounded-2xl border p-4 ${
            signedUp.created
              ? 'border-brand-500/40 bg-brand-500/10'
              : 'border-ink-700 bg-ink-900'
          }`}
        >
          <p className="flex items-center gap-2 font-semibold text-brand-400">
            <span aria-hidden="true">{signedUp.created ? '✓' : 'ℹ'}</span>{' '}
            {signedUp.created ? 'Akun berhasil dibuat' : 'Email ini sudah terdaftar'}
          </p>
          <p className="mt-1.5 text-sm text-ink-300">
            {signedUp.created ? (
              <>
                Untuk <strong className="text-ink-100">{signedUp.email}</strong>.
              </>
            ) : (
              <>
                <strong className="text-ink-100">{signedUp.email}</strong> sudah punya
                akun. Masuk saja di bawah — atau pakai &ldquo;Lupa kata sandi?&rdquo;
                kalau sandinya lupa.
              </>
            )}
          </p>
          {signedUp.created && (
            <>
              <p className="mt-2 text-sm text-ink-300">
                Satu langkah lagi: buka tautan konfirmasi yang kami kirim ke email
                itu, lalu masuk di bawah. Setelah masuk pertama kali kamu akan
                dipandu mengisi data diri dan target.
              </p>
              {/* Naming the host makes a misconfigured redirect obvious now
                  rather than when someone clicks a dead link hours later. */}
              <p className="mt-2 text-xs text-ink-500">
                Tautannya menuju {window.location.host}. Belum masuk dalam beberapa
                menit? Periksa folder spam.
              </p>
            </>
          )}
        </div>
      )}

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
          <PasswordInput
            value={password}
            onChange={setPassword}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
          />
        </Field>

        {errors['form'] && (
          <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">
            {errors['form']}
          </p>
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

      {mode === 'signin' && (
        <p className="mt-3 text-center text-sm">
          <Link
            href="/lupa-sandi"
            className="text-ink-500 underline underline-offset-4 hover:text-ink-300"
          >
            Lupa kata sandi?
          </Link>
        </p>
      )}

      <p className="mt-8 text-center text-xs text-ink-500">
        <Link href="/privasi" className="underline underline-offset-4">
          Kebijakan Privasi
        </Link>
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
